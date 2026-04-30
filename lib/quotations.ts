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
