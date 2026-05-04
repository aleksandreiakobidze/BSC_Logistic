import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { QuotationStatus } from "@/lib/enums";
import { generateNumber } from "@/lib/utils";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface QuotationTotals {
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
}

/**
 * Generates the next quotation number for an org, using the project-wide
 * `generateNumber` helper. Mirrors the convention used by invoices/orders.
 */
export function nextQuotationNumber(): string {
  return generateNumber("Q");
}

/**
 * Recalculates a quotation's totals from its lines, applying its current
 * `taxRate` and `discount`. Returns the new totals and persists them.
 */
export async function recomputeQuotationTotals(
  tx: Tx,
  quotationId: string,
): Promise<QuotationTotals> {
  const quote = await tx.quotation.findUnique({
    where: { id: quotationId },
    select: { id: true, taxRate: true, discount: true },
  });
  if (!quote) throw new Error("Quotation not found");

  const lines = await tx.quotationLine.findMany({
    where: { quotationId },
    select: { quantity: true, unitPrice: true },
  });

  const subtotal = lines.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unitPrice),
    0,
  );
  const discount = Math.min(Number(quote.discount ?? 0), subtotal);
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Number(quote.taxRate ?? 0);
  const taxAmount = Math.round(taxable * taxRate) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;

  const next: QuotationTotals = {
    subtotal: round2(subtotal),
    taxAmount: round2(taxAmount),
    discount: round2(discount),
    total: round2(total),
  };

  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal: next.subtotal,
      taxAmount: next.taxAmount,
      discount: next.discount,
      total: next.total,
    },
  });

  // Recompute the per-line `total` for convenience too — used by the editor.
  for (const l of await tx.quotationLine.findMany({
    where: { quotationId },
    select: { id: true, quantity: true, unitPrice: true },
  })) {
    const lineTotal = round2(Number(l.quantity) * Number(l.unitPrice));
    await tx.quotationLine.update({
      where: { id: l.id },
      data: { total: lineTotal },
    });
  }

  return next;
}

/**
 * Sets `status = EXPIRED` for SENT quotations that have a `validUntil` in the
 * past. Cheap to call on every list-page load (mirrors `refreshOverdueInvoices`).
 */
export async function expireQuotations(orgId: string): Promise<number> {
  const r = await prisma.quotation.updateMany({
    where: {
      orgId,
      status: QuotationStatus.SENT,
      validUntil: { lt: new Date() },
    },
    data: { status: QuotationStatus.EXPIRED },
  });
  return r.count;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Negotiation: revisions + diff ──────────────────────────────────────────

export type RevisionLineSnapshot = {
  id: string;
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  customerStatus: string | null;
  customerNote: string | null;
  proposedQuantity: number | null;
  proposedUnitPrice: number | null;
  proposedDescription: string | null;
};

export type RevisionSnapshot = {
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  lines: RevisionLineSnapshot[];
};

/**
 * Snapshot the current state of a quotation into a `QuotationRevision` row.
 * The snapshot is JSON-serialized in `linesJson`, which keeps the schema
 * simple and avoids cascading deletes affecting history.
 */
export async function snapshotQuotation(
  tx: Tx,
  quotationId: string,
  opts: { source: "ADMIN" | "CUSTOMER"; authorUserId?: string | null; message?: string | null },
): Promise<{ id: string; version: number }> {
  const q = await tx.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    select: {
      currency: true,
      subtotal: true,
      taxRate: true,
      taxAmount: true,
      discount: true,
      total: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  const last = await tx.quotationRevision.aggregate({
    where: { quotationId },
    _max: { version: true },
  });
  const version = (last._max.version ?? 0) + 1;

  const snapshot: RevisionSnapshot = {
    currency: q.currency,
    subtotal: Number(q.subtotal),
    taxRate: Number(q.taxRate),
    taxAmount: Number(q.taxAmount),
    discount: Number(q.discount),
    total: Number(q.total),
    lines: q.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      total: Number(l.total),
      sortOrder: l.sortOrder,
      customerStatus: l.customerStatus,
      customerNote: l.customerNote,
      proposedQuantity:
        l.proposedQuantity == null ? null : Number(l.proposedQuantity),
      proposedUnitPrice:
        l.proposedUnitPrice == null ? null : Number(l.proposedUnitPrice),
      proposedDescription: l.proposedDescription,
    })),
  };

  const created = await tx.quotationRevision.create({
    data: {
      quotationId,
      version,
      source: opts.source,
      authorUserId: opts.authorUserId ?? null,
      message: opts.message ?? null,
      currency: snapshot.currency,
      subtotal: snapshot.subtotal,
      taxRate: snapshot.taxRate,
      taxAmount: snapshot.taxAmount,
      discount: snapshot.discount,
      total: snapshot.total,
      linesJson: JSON.stringify(snapshot),
    },
    select: { id: true, version: true },
  });

  return created;
}

export type LineDiff = {
  lineId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  customerStatus: "ACCEPTED" | "MODIFIED" | "PENDING";
  customerNote: string | null;
  proposed: {
    quantity: number;
    unitPrice: number;
    description: string;
    total: number;
  } | null;
  /** True when the customer's counter actually differs from admin's offer. */
  changed: boolean;
};

/**
 * Build a per-line diff between the admin's current offer (the live
 * `QuotationLine`) and the customer's most-recent counter-proposal stored
 * inline on the same row. Used by the admin negotiation panel.
 */
export function buildLineDiff(
  lines: Array<{
    id: string;
    description: string;
    quantity: number | string | { toString(): string };
    unitPrice: number | string | { toString(): string };
    customerStatus: string | null;
    customerNote: string | null;
    proposedQuantity: number | string | { toString(): string } | null;
    proposedUnitPrice: number | string | { toString(): string } | null;
    proposedDescription: string | null;
  }>,
): LineDiff[] {
  return lines.map((l) => {
    const quantity = Number(l.quantity);
    const unitPrice = Number(l.unitPrice);
    const status: LineDiff["customerStatus"] =
      l.customerStatus === "ACCEPTED"
        ? "ACCEPTED"
        : l.customerStatus === "MODIFIED"
          ? "MODIFIED"
          : "PENDING";

    let proposed: LineDiff["proposed"] = null;
    let changed = false;
    if (status === "MODIFIED") {
      const pq = l.proposedQuantity == null ? quantity : Number(l.proposedQuantity);
      const pu = l.proposedUnitPrice == null ? unitPrice : Number(l.proposedUnitPrice);
      const pd = l.proposedDescription ?? l.description;
      proposed = {
        quantity: pq,
        unitPrice: pu,
        description: pd,
        total: round2(pq * pu),
      };
      changed = pq !== quantity || pu !== unitPrice || pd !== l.description;
    }

    return {
      lineId: l.id,
      description: l.description,
      quantity,
      unitPrice,
      customerStatus: status,
      customerNote: l.customerNote,
      proposed,
      changed,
    };
  });
}
