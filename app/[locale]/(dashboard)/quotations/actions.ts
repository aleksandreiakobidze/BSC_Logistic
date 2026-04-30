"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";
import {
  QuotationStatus,
  OrderStatus,
  CustomerStatus,
  LeadStatus,
} from "@/lib/enums";
import {
  nextQuotationNumber,
  recomputeQuotationTotals,
} from "@/lib/quotations";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const lineInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1),
  contactId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  currency: z.string().default("USD"),
  validUntil: z.coerce.date().optional().nullable(),
  taxRate: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  lines: z.array(lineInputSchema).default([]),
});

const updateQuotationHeaderSchema = z.object({
  contactId: z.string().optional().nullable(),
  currency: z.string().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  taxRate: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createQuotation(
  input: z.input<typeof createQuotationSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = createQuotationSchema.parse(input);

  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: data.customerId, orgId },
    select: { id: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.create({
      data: {
        orgId,
        number: nextQuotationNumber(),
        status: QuotationStatus.DRAFT,
        customerId: customer.id,
        contactId: data.contactId || null,
        leadId: data.leadId || null,
        ownerId: session.user.id,
        currency: data.currency,
        taxRate: data.taxRate,
        discount: data.discount,
        notes: data.notes || null,
        validUntil: data.validUntil ?? null,
      },
    });

    if (data.lines.length > 0) {
      await tx.quotationLine.createMany({
        data: data.lines.map((l, i) => ({
          quotationId: q.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice,
          sortOrder: l.sortOrder ?? i,
        })),
      });
    }
    await recomputeQuotationTotals(tx, q.id);
    return q;
  });

  await audit({
    action: "quotation.create",
    entity: "Quotation",
    entityId: result.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/quotations");
  return { ok: true, id: result.id, number: result.number };
}

export async function updateQuotationHeader(
  id: string,
  input: z.input<typeof updateQuotationHeaderSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = updateQuotationHeaderSchema.parse(input);

  const existing = await loadQuotation(id, orgId);
  ensureEditable(existing.status);

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id },
      data: {
        contactId: data.contactId === undefined ? undefined : data.contactId,
        currency: data.currency,
        validUntil:
          data.validUntil === undefined ? undefined : (data.validUntil ?? null),
        taxRate: data.taxRate,
        discount: data.discount,
        notes: data.notes === undefined ? undefined : (data.notes || null),
      },
    });
    await recomputeQuotationTotals(tx, id);
  });

  await audit({
    action: "quotation.update",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

// ─── Lines ────────────────────────────────────────────────────────────────────

export async function addQuotationLine(
  quotationId: string,
  input: z.input<typeof lineInputSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = lineInputSchema.parse(input);
  const existing = await loadQuotation(quotationId, orgId);
  ensureEditable(existing.status);

  await prisma.$transaction(async (tx) => {
    const lastSort = await tx.quotationLine.aggregate({
      where: { quotationId },
      _max: { sortOrder: true },
    });
    await tx.quotationLine.create({
      data: {
        quotationId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total: data.quantity * data.unitPrice,
        sortOrder: (lastSort._max.sortOrder ?? -1) + 1,
      },
    });
    await recomputeQuotationTotals(tx, quotationId);
  });

  await audit({
    action: "quotation.line.add",
    entity: "Quotation",
    entityId: quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true };
}

export async function updateQuotationLine(
  lineId: string,
  input: { description?: string; quantity?: number; unitPrice?: number },
) {
  const { session, orgId } = await requireRole(staffRoles);
  const line = await prisma.quotationLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { id: true, quotationId: true, quotation: { select: { status: true, orgId: true } } },
  });
  if (line.quotation.orgId !== orgId) throw new Error("Forbidden");
  ensureEditable(line.quotation.status);

  await prisma.$transaction(async (tx) => {
    await tx.quotationLine.update({
      where: { id: lineId },
      data: {
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      },
    });
    await recomputeQuotationTotals(tx, line.quotationId);
  });

  await audit({
    action: "quotation.line.update",
    entity: "Quotation",
    entityId: line.quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${line.quotationId}`);
  return { ok: true };
}

export async function deleteQuotationLine(lineId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const line = await prisma.quotationLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { id: true, quotationId: true, quotation: { select: { status: true, orgId: true } } },
  });
  if (line.quotation.orgId !== orgId) throw new Error("Forbidden");
  ensureEditable(line.quotation.status);

  await prisma.$transaction(async (tx) => {
    await tx.quotationLine.delete({ where: { id: lineId } });
    await recomputeQuotationTotals(tx, line.quotationId);
  });

  await audit({
    action: "quotation.line.delete",
    entity: "Quotation",
    entityId: line.quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${line.quotationId}`);
  return { ok: true };
}

// ─── State transitions ───────────────────────────────────────────────────────

export async function sendQuotation(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await loadQuotation(id, orgId);
  if (q.status !== QuotationStatus.DRAFT) {
    throw new Error("Only DRAFT quotations can be sent");
  }
  await prisma.quotation.update({
    where: { id },
    data: { status: QuotationStatus.SENT, sentAt: new Date() },
  });
  await audit({
    action: "quotation.send",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function acceptQuotation(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await loadQuotation(id, orgId);
  if (
    q.status !== QuotationStatus.SENT &&
    q.status !== QuotationStatus.DRAFT
  ) {
    throw new Error("Quotation cannot be accepted from its current state");
  }
  await prisma.quotation.update({
    where: { id },
    data: {
      status: QuotationStatus.ACCEPTED,
      acceptedAt: new Date(),
      sentAt: q.status === QuotationStatus.DRAFT ? new Date() : undefined,
    },
  });
  await audit({
    action: "quotation.accept",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function rejectQuotation(id: string, reason?: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await loadQuotation(id, orgId);
  if (
    q.status !== QuotationStatus.SENT &&
    q.status !== QuotationStatus.DRAFT
  ) {
    throw new Error("Quotation cannot be rejected from its current state");
  }
  await prisma.quotation.update({
    where: { id },
    data: {
      status: QuotationStatus.REJECTED,
      rejectedAt: new Date(),
      rejectReason: reason || null,
    },
  });
  await audit({
    action: "quotation.reject",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: reason ? { reason } : undefined,
  });
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function cancelQuotation(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await loadQuotation(id, orgId);
  if (
    q.status === QuotationStatus.CONVERTED ||
    q.status === QuotationStatus.CANCELLED
  ) {
    throw new Error("Already finalized");
  }
  await prisma.quotation.update({
    where: { id },
    data: { status: QuotationStatus.CANCELLED },
  });
  await audit({
    action: "quotation.cancel",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true };
}

export async function deleteQuotation(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await loadQuotation(id, orgId);
  if (q.status !== QuotationStatus.DRAFT) {
    throw new Error("Only DRAFT quotations can be deleted");
  }
  await prisma.quotation.delete({ where: { id } });
  await audit({
    action: "quotation.delete",
    entity: "Quotation",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/quotations");
  return { ok: true };
}

// ─── Conversion to Sales Order ───────────────────────────────────────────────

export async function convertQuotationToOrder(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await prisma.quotation.findFirstOrThrow({
    where: { id, orgId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (q.status !== QuotationStatus.ACCEPTED) {
    throw new Error("Only ACCEPTED quotations can be converted");
  }

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orgId,
        number: generateOrderNumber(),
        status: OrderStatus.QUOTE,
        customerId: q.customerId,
        leadId: q.leadId ?? null,
        sourceQuotationId: q.id,
        currency: q.currency,
        price: q.total,
        notes: q.notes,
      },
    });
    if (q.lines.length > 0) {
      await tx.orderLine.createMany({
        data: q.lines.map((l, i) => ({
          orderId: order.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
          sortOrder: l.sortOrder ?? i,
        })),
      });
    }
    await tx.quotation.update({
      where: { id: q.id },
      data: {
        status: QuotationStatus.CONVERTED,
        convertedAt: new Date(),
      },
    });
    return order.id;
  });

  await audit({
    action: "quotation.convert",
    entity: "Quotation",
    entityId: q.id,
    orgId,
    userId: session.user.id,
    meta: { orderId },
  });

  revalidatePath(`/quotations/${q.id}`);
  revalidatePath("/quotations");
  revalidatePath("/orders");
  return { ok: true, orderId };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadQuotation(id: string, orgId: string) {
  const q = await prisma.quotation.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, customerId: true, leadId: true },
  });
  if (!q) throw new Error("Quotation not found");
  return q;
}

function ensureEditable(status: string) {
  if (status !== QuotationStatus.DRAFT) {
    throw new Error("Quotation is locked: only DRAFT quotations are editable");
  }
}

function generateOrderNumber(): string {
  const d = new Date();
  const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SO-${yymm}-${rand}`;
}

// ─── Side effects on order confirmation (called from orders/actions.ts) ──────

/**
 * Apply the customer-activation and Lead-WON side effects when an Order
 * transitions to a confirmed-or-later state. Call inside the same Prisma
 * transaction that flips the order status.
 */
export async function applyOrderConfirmationSideEffects(
  tx: import("@prisma/client").Prisma.TransactionClient,
  orderId: string,
): Promise<{ activatedCustomer: boolean; wonLead: boolean }> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      customerId: true,
      leadId: true,
      sourceQuotationId: true,
      customer: { select: { id: true, status: true } },
      lead: { select: { id: true, status: true } },
    },
  });

  let activatedCustomer = false;
  let wonLead = false;

  if (order.customer.status === CustomerStatus.PROSPECT) {
    await tx.customer.update({
      where: { id: order.customer.id },
      data: { status: CustomerStatus.ACTIVE, firstActivatedAt: new Date() },
    });
    activatedCustomer = true;
  }

  if (order.lead && order.lead.status !== LeadStatus.WON) {
    await tx.lead.update({
      where: { id: order.lead.id },
      data: { status: LeadStatus.WON, convertedAt: new Date() },
    });
    wonLead = true;
  }

  return { activatedCustomer, wonLead };
}
