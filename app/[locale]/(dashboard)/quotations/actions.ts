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
  ActivityKind,
  QuotationActivityKind,
} from "@/lib/enums";
import {
  nextQuotationNumber,
  recomputeQuotationTotals,
  snapshotQuotation,
} from "@/lib/quotations";
import { sendEmail } from "@/lib/mail";
import { Role } from "@/lib/enums";
import { publishQuotationEvent } from "@/lib/quotation-events";
import {
  diffFields,
  recordQuotationFieldChanges,
} from "@/lib/quotation-activity-diff";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const lineInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
  itemId: z.string().optional().nullable(),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1),
  contactId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  salesManagerId: z.string().optional().nullable(),
  currency: z.string().default("USD"),
  validUntil: z.coerce.date().optional().nullable(),
  taxRate: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  lines: z.array(lineInputSchema).default([]),
  // Optional RFQ header seed fields. Quotations now default to PRICING so the
  // user lands on the Inquiry tab and can fill these in there too.
  requestedTeams: z.array(z.string()).optional(),
  priority: z.string().optional(),
  mode: z.string().optional().nullable(),
  incoterms: z.string().optional().nullable(),
  originPort: z.string().optional().nullable(),
  originAddress: z.string().optional().nullable(),
  destinationPort: z.string().optional().nullable(),
  destinationAddress: z.string().optional().nullable(),
  cargoDescription: z.string().optional().nullable(),
  cargoReadyDate: z.coerce.date().optional().nullable(),
  /** Override the default initial status. Defaults to PRICING for new quotations. */
  initialStatus: z.string().optional(),
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

  const requestedTeams = (() => {
    if (!data.requestedTeams || data.requestedTeams.length === 0) return null;
    const seen = new Set<string>();
    for (const t of data.requestedTeams) {
      const v = String(t).trim().toUpperCase();
      if (v) seen.add(v);
    }
    return seen.size === 0 ? null : Array.from(seen).join(",");
  })();

  const initialStatus = data.initialStatus ?? QuotationStatus.PRICING;

  const result = await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.create({
      data: {
        orgId,
        number: nextQuotationNumber(),
        status: initialStatus,
        customerId: customer.id,
        contactId: data.contactId || null,
        leadId: data.leadId || null,
        ownerId: session.user.id,
        salesManagerId: data.salesManagerId || null,
        currency: data.currency,
        taxRate: data.taxRate,
        discount: data.discount,
        notes: data.notes || null,
        validUntil: data.validUntil ?? null,
        requestedTeams,
        priority: data.priority || "MEDIUM",
        mode: data.mode || null,
        incoterms: data.incoterms || null,
        originPort: data.originPort || null,
        originAddress: data.originAddress || null,
        destinationPort: data.destinationPort || null,
        destinationAddress: data.destinationAddress || null,
        cargoDescription: data.cargoDescription || null,
        cargoReadyDate: data.cargoReadyDate ?? null,
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
          itemId: l.itemId || null,
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
  if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
  return { ok: true, id: result.id, number: result.number };
}

const createQuotationFromLeadSchema = z.object({
  leadId: z.string().min(1),
  validUntil: z.coerce.date().optional().nullable(),
  currency: z.string().optional(),
  taxRate: z.coerce.number().min(0).optional(),
});

export type CreateQuotationFromLeadResult =
  | { ok: true; id: string; number: string }
  | {
      ok: false;
      error:
        | { code: "LEAD_NOT_QUALIFIED"; currentStatus: string }
        | { code: "LEAD_INCOMPLETE" };
    };

/**
 * Quick-create a DRAFT quotation seeded from a QUALIFIED lead. Carries over
 * customerId/contactId/leadId from the lead and delegates totals/audit to
 * the same code path as `createQuotation`. Does NOT mutate Lead.status —
 * the deal's progress now lives on the quotation.
 */
export async function createQuotationFromLead(
  input: z.input<typeof createQuotationFromLeadSchema>,
): Promise<CreateQuotationFromLeadResult> {
  const { orgId } = await requireRole(staffRoles);
  const data = createQuotationFromLeadSchema.parse(input);

  const lead = await prisma.lead.findFirstOrThrow({
    where: { id: data.leadId, orgId },
    select: {
      id: true,
      status: true,
      customerId: true,
      contactId: true,
      currency: true,
    },
  });

  if (lead.status !== "QUALIFIED") {
    return {
      ok: false,
      error: { code: "LEAD_NOT_QUALIFIED", currentStatus: lead.status },
    };
  }
  if (!lead.customerId || !lead.contactId) {
    return { ok: false, error: { code: "LEAD_INCOMPLETE" } };
  }

  const created = await createQuotation({
    customerId: lead.customerId,
    contactId: lead.contactId,
    leadId: lead.id,
    currency: data.currency ?? lead.currency ?? "USD",
    taxRate: data.taxRate ?? 0,
    validUntil: data.validUntil ?? null,
    discount: 0,
    lines: [],
  });

  return { ok: true, id: created.id, number: created.number };
}

const QUOTATION_HEADER_FIELDS = [
  "contactId",
  "currency",
  "validUntil",
  "taxRate",
  "discount",
  "notes",
] as const;

export async function updateQuotationHeader(
  id: string,
  input: z.input<typeof updateQuotationHeaderSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = updateQuotationHeaderSchema.parse(input);

  const existing = await prisma.quotation.findFirstOrThrow({
    where: { id, orgId },
    select: {
      id: true,
      status: true,
      contactId: true,
      currency: true,
      validUntil: true,
      taxRate: true,
      discount: true,
      notes: true,
    },
  });
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

    const after: Record<string, unknown> = {
      contactId: data.contactId === undefined ? undefined : data.contactId,
      currency: data.currency,
      validUntil:
        data.validUntil === undefined ? undefined : (data.validUntil ?? null),
      taxRate: data.taxRate,
      discount: data.discount,
      notes: data.notes === undefined ? undefined : (data.notes || null),
    };

    const changes = diffFields(
      existing as unknown as Record<string, unknown>,
      after,
      QUOTATION_HEADER_FIELDS as unknown as string[],
    );

    await recordQuotationFieldChanges(tx, {
      quotationId: id,
      userId: session.user.id,
      entity: "Quotation",
      changes,
    });
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
    const created = await tx.quotationLine.create({
      data: {
        quotationId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total: data.quantity * data.unitPrice,
        sortOrder: (lastSort._max.sortOrder ?? -1) + 1,
        itemId: data.itemId || null,
      },
    });
    await recomputeQuotationTotals(tx, quotationId);
    await tx.quotationActivity.create({
      data: {
        quotationId,
        userId: session.user.id,
        kind: QuotationActivityKind.FIELD_CHANGE,
        note: `Added line "${data.description}"`,
        meta: JSON.stringify({
          entity: "Line",
          entityId: created.id,
          op: "add",
          line: {
            description: data.description,
            quantity: data.quantity,
            unitPrice: data.unitPrice,
          },
        }),
      },
    });
  });

  await audit({
    action: "quotation.line.add",
    entity: "Quotation",
    entityId: quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${quotationId}`);
  publishQuotationEvent(quotationId, {
    type: "stateChange",
    reason: "lineAdded",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true };
}

const QUOTATION_LINE_FIELDS = [
  "description",
  "quantity",
  "unitPrice",
  "itemId",
] as const;

export async function updateQuotationLine(
  lineId: string,
  input: {
    description?: string;
    quantity?: number;
    unitPrice?: number;
    itemId?: string | null;
  },
) {
  const { session, orgId } = await requireRole(staffRoles);
  const line = await prisma.quotationLine.findUniqueOrThrow({
    where: { id: lineId },
    select: {
      id: true,
      quotationId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      itemId: true,
      quotation: { select: { status: true, orgId: true } },
    },
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
        itemId: input.itemId === undefined ? undefined : (input.itemId || null),
      },
    });
    await recomputeQuotationTotals(tx, line.quotationId);

    const after: Record<string, unknown> = {
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      itemId: input.itemId === undefined ? undefined : (input.itemId || null),
    };

    const changes = diffFields(
      line as unknown as Record<string, unknown>,
      after,
      QUOTATION_LINE_FIELDS as unknown as string[],
    );

    await recordQuotationFieldChanges(tx, {
      quotationId: line.quotationId,
      userId: session.user.id,
      entity: `Line "${line.description}"`,
      entityId: lineId,
      changes,
    });
  });

  await audit({
    action: "quotation.line.update",
    entity: "Quotation",
    entityId: line.quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${line.quotationId}`);
  publishQuotationEvent(line.quotationId, {
    type: "stateChange",
    reason: "lineUpdated",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true };
}

export async function deleteQuotationLine(lineId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const line = await prisma.quotationLine.findUniqueOrThrow({
    where: { id: lineId },
    select: {
      id: true,
      quotationId: true,
      description: true,
      quotation: { select: { status: true, orgId: true } },
    },
  });
  if (line.quotation.orgId !== orgId) throw new Error("Forbidden");
  ensureEditable(line.quotation.status);

  await prisma.$transaction(async (tx) => {
    await tx.quotationLine.delete({ where: { id: lineId } });
    await recomputeQuotationTotals(tx, line.quotationId);
    await tx.quotationActivity.create({
      data: {
        quotationId: line.quotationId,
        userId: session.user.id,
        kind: QuotationActivityKind.FIELD_CHANGE,
        note: `Removed line "${line.description}"`,
        meta: JSON.stringify({
          entity: "Line",
          entityId: lineId,
          op: "delete",
          description: line.description,
        }),
      },
    });
  });

  await audit({
    action: "quotation.line.delete",
    entity: "Quotation",
    entityId: line.quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${line.quotationId}`);
  publishQuotationEvent(line.quotationId, {
    type: "stateChange",
    reason: "lineRemoved",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
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
  publishQuotationEvent(id, {
    type: "stateChange",
    reason: "sent",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
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
  publishQuotationEvent(id, {
    type: "stateChange",
    reason: "accepted",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
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
  publishQuotationEvent(id, {
    type: "stateChange",
    reason: "rejected",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
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
  publishQuotationEvent(id, {
    type: "stateChange",
    reason: "cancelled",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
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
  publishQuotationEvent(q.id, {
    type: "stateChange",
    reason: "converted",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true, orderId };
}

// ─── Negotiation: email send / customer counter / admin response ─────────────

const customerLineSchema = z.object({
  lineId: z.string().min(1),
  status: z.enum(["ACCEPTED", "MODIFIED"]),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

const submitProposalSchema = z.object({
  quotationId: z.string().min(1),
  message: z.string().max(2000).optional(),
  lines: z.array(customerLineSchema).min(1),
});

/**
 * Resolve the customer-portal user for a customer (role=CUSTOMER and
 * customerId=...). Returns null if the customer hasn't been provisioned.
 */
async function findCustomerPortalUser(customerId: string) {
  return prisma.user.findFirst({
    where: { customerId, role: Role.CUSTOMER, isActive: true },
    select: { id: true, email: true, name: true },
  });
}

function quotationPortalUrl(locale: string, quotationId: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return `${base}/${locale}/portal/quotations/${quotationId}`;
}

function buildQuotationEmail(opts: {
  customerName: string;
  number: string;
  url: string;
  message?: string | null;
}) {
  const safeMsg = opts.message
    ? `<p style="white-space:pre-wrap;color:#444">${escapeHtml(opts.message)}</p>`
    : "";
  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1f2937">
      <h2 style="margin:0 0 12px">Quotation ${escapeHtml(opts.number)}</h2>
      <p>Hi ${escapeHtml(opts.customerName)},</p>
      <p>Your quotation is ready for review. Please open the link below, sign in with your password, and let us know what you'd like to accept or adjust.</p>
      ${safeMsg}
      <p style="margin:24px 0">
        <a href="${opts.url}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">
          Review quotation
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">If the button doesn't work, paste this URL into your browser:<br/>${opts.url}</p>
    </div>
  `.trim();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]!);
}

export type SendQuotationEmailResult =
  | { ok: true; emailSent: boolean; emailError?: string }
  | {
      ok: false;
      error:
        | { code: "INVALID_STATE"; currentStatus: string }
        | { code: "NO_PORTAL_USER" };
    };

/**
 * Admin sends the quotation to the customer: snapshots the current state as
 * an ADMIN revision, marks SENT, and emails a portal link. Refuses unless
 * the customer has a portal user provisioned.
 *
 * Returns a discriminated union so input/state errors don't surface as HTTP
 * 500. Email transport failures are captured in `emailError` but the SENT
 * transition still commits — the user can resend from the portal page.
 */
export async function sendQuotationEmail(input: {
  quotationId: string;
  locale?: string;
  message?: string;
}): Promise<SendQuotationEmailResult> {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await prisma.quotation.findFirstOrThrow({
    where: { id: input.quotationId, orgId },
    include: { customer: { select: { id: true, name: true } } },
  });

  if (
    q.status !== QuotationStatus.DRAFT &&
    q.status !== QuotationStatus.COUNTERED
  ) {
    return {
      ok: false,
      error: { code: "INVALID_STATE", currentStatus: q.status },
    };
  }

  const portalUser = await findCustomerPortalUser(q.customerId);
  if (!portalUser) {
    return { ok: false, error: { code: "NO_PORTAL_USER" } };
  }

  await prisma.$transaction(async (tx) => {
    await snapshotQuotation(tx, q.id, {
      source: "ADMIN",
      authorUserId: session.user.id,
      message: input.message ?? null,
    });
    await tx.quotation.update({
      where: { id: q.id },
      data: {
        status: QuotationStatus.SENT,
        sentAt: q.sentAt ?? new Date(),
      },
    });
  });

  const locale = input.locale ?? "en";
  const url = quotationPortalUrl(locale, q.id);
  let emailSent = true;
  let emailError: string | undefined;
  try {
    await sendEmail({
      to: portalUser.email,
      subject: `Your quotation ${q.number}`,
      html: buildQuotationEmail({
        customerName: portalUser.name ?? q.customer.name,
        number: q.number,
        url,
        message: input.message,
      }),
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : "Email transport failed";
    console.error("[sendQuotationEmail] mail transport failed", err);
  }

  await audit({
    action: "quotation.send",
    entity: "Quotation",
    entityId: q.id,
    orgId,
    userId: session.user.id,
    meta: { to: portalUser.email, emailSent, emailError },
  });

  revalidatePath(`/quotations/${q.id}`);
  revalidatePath("/quotations");
  publishQuotationEvent(q.id, {
    type: "stateChange",
    reason: "sent",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true, emailSent, ...(emailError ? { emailError } : {}) };
}

/**
 * Customer-side action (called from /portal/quotations/[id]). Verifies the
 * caller owns the quotation, persists per-line accept/modify choices, and
 * snapshots a CUSTOMER revision. If everything was accepted unchanged the
 * quotation moves to ACCEPTED; otherwise it transitions to COUNTERED for
 * the admin to review.
 */
export async function submitCustomerProposal(
  input: z.input<typeof submitProposalSchema>,
) {
  const { session, orgId: _orgId } = await requireOrg();
  if (session.user.role !== Role.CUSTOMER || !session.user.customerId) {
    throw new Error("Only customers can submit a proposal");
  }
  const data = submitProposalSchema.parse(input);
  void _orgId;

  const q = await prisma.quotation.findFirst({
    where: { id: data.quotationId, customerId: session.user.customerId },
    select: { id: true, status: true, orgId: true },
  });
  if (!q) throw new Error("Quotation not found");
  if (q.status !== QuotationStatus.SENT) {
    throw new Error("Quotation is not awaiting your response");
  }

  // Pre-load current line state so we can compute "all accepted, no edits".
  const lines = await prisma.quotationLine.findMany({
    where: { quotationId: q.id },
    select: { id: true, description: true, quantity: true, unitPrice: true },
  });
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Reject any lineId that doesn't belong to this quotation.
  for (const li of data.lines) {
    if (!lineMap.has(li.lineId)) {
      throw new Error(`Unknown line ${li.lineId}`);
    }
  }

  let everyAcceptedUnchanged = true;
  await prisma.$transaction(async (tx) => {
    for (const incoming of data.lines) {
      const current = lineMap.get(incoming.lineId)!;
      if (incoming.status === "ACCEPTED") {
        await tx.quotationLine.update({
          where: { id: incoming.lineId },
          data: {
            customerStatus: "ACCEPTED",
            customerNote: incoming.note?.trim() || null,
            proposedQuantity: null,
            proposedUnitPrice: null,
            proposedDescription: null,
          },
        });
      } else {
        const desc = (incoming.description ?? "").trim() || current.description;
        const qty =
          incoming.quantity == null ? Number(current.quantity) : incoming.quantity;
        const price =
          incoming.unitPrice == null ? Number(current.unitPrice) : incoming.unitPrice;
        const changed =
          desc !== current.description ||
          qty !== Number(current.quantity) ||
          price !== Number(current.unitPrice);
        if (changed) everyAcceptedUnchanged = false;
        await tx.quotationLine.update({
          where: { id: incoming.lineId },
          data: {
            customerStatus: "MODIFIED",
            customerNote: incoming.note?.trim() || null,
            proposedDescription: desc,
            proposedQuantity: qty,
            proposedUnitPrice: price,
          },
        });
      }
    }

    await snapshotQuotation(tx, q.id, {
      source: "CUSTOMER",
      authorUserId: session.user.id,
      message: data.message ?? null,
    });

    await tx.quotation.update({
      where: { id: q.id },
      data: everyAcceptedUnchanged
        ? { status: QuotationStatus.ACCEPTED, acceptedAt: new Date() }
        : { status: QuotationStatus.COUNTERED },
    });
  });

  await audit({
    action: "quotation.customerProposal",
    entity: "Quotation",
    entityId: q.id,
    orgId: q.orgId,
    userId: session.user.id,
    meta: {
      result: everyAcceptedUnchanged ? "ACCEPTED" : "COUNTERED",
      lines: data.lines.length,
    },
  });

  revalidatePath(`/quotations/${q.id}`);
  revalidatePath(`/portal/quotations/${q.id}`);
  publishQuotationEvent(q.id, {
    type: "stateChange",
    reason: everyAcceptedUnchanged ? "accepted" : "proposal",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true, status: everyAcceptedUnchanged ? "ACCEPTED" : "COUNTERED" };
}

/**
 * Admin accepts the customer's most-recent counter as-is. Copies each line's
 * `proposed*` fields onto the live `QuotationLine`, snapshots a final ADMIN
 * revision, and moves the quotation to ACCEPTED.
 */
export async function acceptCustomerProposal(quotationId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await prisma.quotation.findFirstOrThrow({
    where: { id: quotationId, orgId },
    include: { lines: true },
  });
  if (q.status !== QuotationStatus.COUNTERED) {
    throw new Error("Only COUNTERED quotations can be accepted from a customer counter");
  }

  await prisma.$transaction(async (tx) => {
    for (const l of q.lines) {
      if (l.customerStatus === "MODIFIED") {
        await tx.quotationLine.update({
          where: { id: l.id },
          data: {
            description: l.proposedDescription ?? l.description,
            quantity: l.proposedQuantity ?? l.quantity,
            unitPrice: l.proposedUnitPrice ?? l.unitPrice,
            customerStatus: null,
            customerNote: null,
            proposedDescription: null,
            proposedQuantity: null,
            proposedUnitPrice: null,
          },
        });
      } else {
        // Clear the ACCEPTED flag too so the live row is "clean".
        await tx.quotationLine.update({
          where: { id: l.id },
          data: {
            customerStatus: null,
            customerNote: null,
            proposedDescription: null,
            proposedQuantity: null,
            proposedUnitPrice: null,
          },
        });
      }
    }
    await recomputeQuotationTotals(tx, quotationId);
    await snapshotQuotation(tx, quotationId, {
      source: "ADMIN",
      authorUserId: session.user.id,
      message: "Accepted customer's proposal",
    });
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: QuotationStatus.ACCEPTED, acceptedAt: new Date() },
    });
  });

  await audit({
    action: "quotation.acceptCustomer",
    entity: "Quotation",
    entityId: quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
  publishQuotationEvent(quotationId, {
    type: "stateChange",
    reason: "accepted",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true };
}

/**
 * Admin sends a fresh counter back to the customer. Clears any leftover
 * customer-counter columns (admin is now the source of truth again),
 * snapshots a new ADMIN revision, flips status back to SENT, and emails
 * the portal link again.
 */
export async function sendAdminCounter(input: {
  quotationId: string;
  locale?: string;
  message?: string;
}) {
  const { session, orgId } = await requireRole(staffRoles);
  const q = await prisma.quotation.findFirstOrThrow({
    where: { id: input.quotationId, orgId },
    select: { id: true, status: true, customerId: true, number: true, customer: { select: { name: true } } },
  });
  if (q.status !== QuotationStatus.COUNTERED) {
    throw new Error("Only COUNTERED quotations can receive an admin counter");
  }

  const portalUser = await findCustomerPortalUser(q.customerId);
  if (!portalUser) {
    throw new Error(
      "This customer has no portal access yet. Set up portal access on the customer page first.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Wipe any stale customer-side counter values; the admin's edits to the
    // live `QuotationLine` rows are the new offer.
    await tx.quotationLine.updateMany({
      where: { quotationId: q.id },
      data: {
        customerStatus: null,
        customerNote: null,
        proposedQuantity: null,
        proposedUnitPrice: null,
        proposedDescription: null,
      },
    });
    await recomputeQuotationTotals(tx, q.id);
    await snapshotQuotation(tx, q.id, {
      source: "ADMIN",
      authorUserId: session.user.id,
      message: input.message ?? null,
    });
    await tx.quotation.update({
      where: { id: q.id },
      data: { status: QuotationStatus.SENT, sentAt: new Date() },
    });
  });

  const locale = input.locale ?? "en";
  const url = quotationPortalUrl(locale, q.id);
  await sendEmail({
    to: portalUser.email,
    subject: `Updated quotation ${q.number}`,
    html: buildQuotationEmail({
      customerName: portalUser.name ?? q.customer.name,
      number: q.number,
      url,
      message: input.message,
    }),
  });

  await audit({
    action: "quotation.adminCounter",
    entity: "Quotation",
    entityId: q.id,
    orgId,
    userId: session.user.id,
    meta: { to: portalUser.email },
  });

  revalidatePath(`/quotations/${q.id}`);
  revalidatePath("/quotations");
  publishQuotationEvent(q.id, {
    type: "stateChange",
    reason: "counter",
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });
  return { ok: true };
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
  // PRICING   = collecting supplier offers (Inquiry tab); lines are usually
  //             empty here but we still allow direct edits as an escape hatch.
  // DRAFT     = author is composing the first customer-facing offer.
  // COUNTERED = customer pushed back; admin is preparing a new counter.
  if (
    status !== QuotationStatus.PRICING &&
    status !== QuotationStatus.DRAFT &&
    status !== QuotationStatus.COUNTERED
  ) {
    throw new Error("Quotation is locked: only PRICING, DRAFT, or COUNTERED quotations are editable");
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
 * Apply customer-activation and Lead-won side effects when an Order
 * transitions to a confirmed-or-later state. Called inside the same Prisma
 * transaction that flips the order status.
 *
 * Lead.status is NOT mutated here — qualified leads stay QUALIFIED for their
 * lifetime. We stamp `Lead.wonAt` (once, idempotently) so reports can use
 * `wonAt IS NOT NULL` as the source of truth for "won deals".
 */
export async function applyOrderConfirmationSideEffects(
  tx: import("@prisma/client").Prisma.TransactionClient,
  orderId: string,
): Promise<{
  activatedCustomer: boolean;
  wonLead: boolean;
  wonQuotation: boolean;
}> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      number: true,
      customerId: true,
      leadId: true,
      sourceQuotationId: true,
      customer: { select: { id: true, status: true, firstActivatedAt: true } },
      lead: { select: { id: true, orgId: true, wonAt: true } },
      sourceQuotation: { select: { id: true, status: true, wonAt: true } },
    },
  });

  let activatedCustomer = false;
  let wonLead = false;
  let wonQuotation = false;

  if (order.customer.status === CustomerStatus.PROSPECT) {
    await tx.customer.update({
      where: { id: order.customer.id },
      data: {
        status: CustomerStatus.ACTIVE,
        firstActivatedAt: order.customer.firstActivatedAt ?? new Date(),
      },
    });
    activatedCustomer = true;
  }

  if (order.lead && !order.lead.wonAt) {
    await tx.lead.update({
      where: { id: order.lead.id },
      data: { wonAt: new Date() },
    });
    await tx.leadActivity.create({
      data: {
        leadId: order.lead.id,
        kind: ActivityKind.NOTE,
        note: `Order ${order.number} confirmed — lead marked as won`,
      },
    });
    wonLead = true;
  }

  // Mirror the lead-won contract for quotations: stamp `wonAt` (idempotent)
  // so reports can use `wonAt IS NOT NULL` as the source of truth. We don't
  // overwrite `status` here — the existing CONVERTED / ACCEPTED state is left
  // intact so the customer-facing flow keeps working. Operators can still
  // explicitly switch to WON via the inquiry tab if they want a clean badge.
  if (order.sourceQuotation && !order.sourceQuotation.wonAt) {
    await tx.quotation.update({
      where: { id: order.sourceQuotation.id },
      data: { wonAt: new Date() },
    });
    await tx.quotationActivity.create({
      data: {
        quotationId: order.sourceQuotation.id,
        kind: "STATUS_CHANGE",
        note: `Order ${order.number} confirmed — quotation marked as won`,
      },
    });
    wonQuotation = true;
  }

  return { activatedCustomer, wonLead, wonQuotation };
}

// ─── Quotation chat / per-line comments ─────────────────────────────────────

const postMessageSchema = z.object({
  quotationId: z.string().min(1),
  lineId: z.string().min(1).optional().nullable(),
  body: z.string().trim().min(1).max(4000),
});

export type QuotationMessageDTO = {
  id: string;
  quotationId: string;
  lineId: string | null;
  authorRole: "ADMIN" | "CUSTOMER" | "SYSTEM";
  authorName: string | null;
  body: string;
  createdAt: string;
};

/**
 * Post a chat message on a quotation. If `lineId` is set the message is
 * scoped to that line (per-line thread); otherwise it lives in the whole-quote
 * conversation. Customers can only post on their own quotations; staff must
 * belong to the same org. The message is marked as already-read by the author
 * and unread by the other side so unread badges work without extra writes.
 */
export async function postQuotationMessage(
  input: z.input<typeof postMessageSchema>,
): Promise<{ ok: true; message: QuotationMessageDTO }> {
  const data = postMessageSchema.parse(input);
  const { session } = await requireOrg();

  const quote = await prisma.quotation.findUnique({
    where: { id: data.quotationId },
    select: { id: true, orgId: true, customerId: true },
  });
  if (!quote) throw new Error("Quotation not found");

  let authorRole: "ADMIN" | "CUSTOMER";
  if (session.user.role === Role.CUSTOMER) {
    if (
      !session.user.customerId ||
      session.user.customerId !== quote.customerId
    ) {
      throw new Error("Forbidden");
    }
    authorRole = "CUSTOMER";
  } else if (staffRoles.includes(session.user.role as never)) {
    if (session.user.orgId !== quote.orgId) {
      throw new Error("Forbidden");
    }
    authorRole = "ADMIN";
  } else {
    throw new Error("Forbidden");
  }

  if (data.lineId) {
    const owns = await prisma.quotationLine.findFirst({
      where: { id: data.lineId, quotationId: quote.id },
      select: { id: true },
    });
    if (!owns) throw new Error("Unknown line");
  }

  const created = await prisma.quotationMessage.create({
    data: {
      quotationId: quote.id,
      lineId: data.lineId ?? null,
      authorUserId: session.user.id,
      authorRole,
      body: data.body,
      readByCustomer: authorRole === "CUSTOMER",
      readByAdmin: authorRole === "ADMIN",
    },
    include: { author: { select: { name: true, email: true } } },
  });

  await audit({
    action: "quotation.message.post",
    entity: "Quotation",
    entityId: quote.id,
    orgId: quote.orgId,
    userId: session.user.id,
    meta: {
      messageId: created.id,
      lineId: created.lineId,
      authorRole,
      length: data.body.length,
    },
  });

  revalidatePath(`/quotations/${quote.id}`);
  revalidatePath(`/portal/quotations/${quote.id}`);

  const dto: QuotationMessageDTO = {
    id: created.id,
    quotationId: created.quotationId,
    lineId: created.lineId,
    authorRole: created.authorRole as "ADMIN" | "CUSTOMER" | "SYSTEM",
    authorName: created.author?.name ?? created.author?.email ?? null,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };

  publishQuotationEvent(quote.id, {
    type: "message",
    message: dto,
    recipientRoles: ["ADMIN", "CUSTOMER"],
  });

  return { ok: true, message: dto };
}

/**
 * Mark all messages on a quotation as read by the viewer's side. Called by
 * the page server components on render so the chat badge resets when the
 * page is actually opened. No-op if the viewer's role doesn't apply.
 */
export async function markQuotationMessagesRead(
  quotationId: string,
): Promise<void> {
  const { session } = await requireOrg();
  const quote = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: { id: true, orgId: true, customerId: true },
  });
  if (!quote) return;

  if (session.user.role === Role.CUSTOMER) {
    if (
      !session.user.customerId ||
      session.user.customerId !== quote.customerId
    ) {
      return;
    }
    await prisma.quotationMessage.updateMany({
      where: { quotationId, readByCustomer: false },
      data: { readByCustomer: true },
    });
    return;
  }

  if (
    staffRoles.includes(session.user.role as never) &&
    session.user.orgId === quote.orgId
  ) {
    await prisma.quotationMessage.updateMany({
      where: { quotationId, readByAdmin: false },
      data: { readByAdmin: true },
    });
  }
}
