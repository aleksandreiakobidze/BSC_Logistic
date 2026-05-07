"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";
import {
  LeadStatus,
  ActivityKind,
  LeadPriority,
  CustomerStatus,
} from "@/lib/enums";
import {
  checkLeadTransition,
  type LeadForCheck,
  type TransitionError,
} from "@/lib/lead-transitions";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";

const PRIORITY_VALUES = Object.values(LeadPriority) as [string, ...string[]];

const STATUS_VALUES = Object.values(LeadStatus) as [string, ...string[]];

// New leads always start NEW. Status field is intentionally omitted from the
// create/update schema; lifecycle transitions go through `updateLeadStatus`
// (which enforces the state machine) and `qualifyLead`.
const leadCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  assignedToId: z.string().optional(),
  contactId: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).default(0),
  currency: z.string().default("USD"),
  score: z.coerce.number().int().min(0).max(100).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  nextFollowUp: z.string().optional(),
  notes: z.string().optional(),
});

// Edit form preserves status only for LOST leads (so the lostReason can be
// updated without forcing a new status change). Status changes go through
// `updateLeadStatus`.
const leadUpdateSchema = leadCreateSchema.extend({
  status: z.enum(STATUS_VALUES).optional(),
  lostReason: z.string().optional(),
});

export async function createLead(formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  const raw = Object.fromEntries(formData.entries());
  const data = leadCreateSchema.parse(raw);

  if (data.contactId) {
    await prisma.contact.findFirstOrThrow({
      where: { id: data.contactId, orgId },
      select: { id: true },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      orgId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      status: LeadStatus.NEW,
      source: data.source || null,
      assignedToId: data.assignedToId || null,
      contactId: data.contactId || null,
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      score: data.score ?? 0,
      priority: data.priority ?? LeadPriority.MEDIUM,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.LEAD,
    recordId: lead.id,
    formData,
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      userId: session.user.id,
      kind: ActivityKind.STATUS_CHANGE,
      note: `Lead created (NEW)`,
    },
  });

  await audit({
    action: "lead.create",
    entity: "Lead",
    entityId: lead.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/leads");
  return { ok: true, id: lead.id };
}

export async function updateLead(id: string, formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  const raw = Object.fromEntries(formData.entries());
  const data = leadUpdateSchema.parse(raw);

  const existing = await prisma.lead.findFirstOrThrow({ where: { id, orgId } });

  if (data.contactId) {
    await prisma.contact.findFirstOrThrow({
      where: { id: data.contactId, orgId },
      select: { id: true },
    });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      // Status is intentionally NOT writable here. Use updateLeadStatus / qualifyLead.
      source: data.source || null,
      assignedToId: data.assignedToId || null,
      contactId: data.contactId || null,
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      score: data.score ?? existing.score,
      priority: data.priority ?? existing.priority,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
      // Allow editing the lostReason text on already-LOST leads.
      lostReason:
        existing.status === LeadStatus.LOST
          ? data.lostReason ?? existing.lostReason ?? null
          : existing.lostReason,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.LEAD,
    recordId: lead.id,
    formData,
  });

  await audit({
    action: "lead.update",
    entity: "Lead",
    entityId: lead.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

const updateLeadStatusSchema = z.object({
  leadId: z.string().min(1),
  nextStatus: z.enum([
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.LOST,
  ]),
  lostReason: z.string().max(500).optional(),
  // Optional: attach a contact at the same time (used by the
  // "Mark Contacted" flow when the user adds a contact inline).
  attachContactId: z.string().min(1).optional(),
});

export type UpdateLeadStatusInput = z.input<typeof updateLeadStatusSchema>;

export type UpdateLeadStatusResult =
  | { ok: true; lead: { id: string; status: string } }
  | {
      ok: false;
      error: TransitionError | { code: "LOST_REASON_REQUIRED" };
    };

export async function updateLeadStatus(
  input: UpdateLeadStatusInput,
): Promise<UpdateLeadStatusResult> {
  const { session, orgId } = await requireRole(staffRoles);
  const data = updateLeadStatusSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    let lead = await tx.lead.findFirstOrThrow({
      where: { id: data.leadId, orgId },
      include: { contact: true },
    });

    if (data.attachContactId) {
      const ct = await tx.contact.findFirstOrThrow({
        where: { id: data.attachContactId, orgId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          customerId: true,
        },
      });
      if (lead.contactId !== ct.id) {
        lead = await tx.lead.update({
          where: { id: lead.id },
          data: { contactId: ct.id },
          include: { contact: true },
        });
      }
    }

    const leadForCheck: LeadForCheck = {
      status: lead.status as LeadStatus,
      contactId: lead.contactId,
      customerId: lead.customerId,
      contact: lead.contact
        ? {
            name: lead.contact.name,
            phone: lead.contact.phone,
            email: lead.contact.email,
          }
        : null,
    };

    const check = checkLeadTransition(leadForCheck, data.nextStatus);
    if (!check.ok) {
      return { ok: false, error: check.error } as const;
    }

    if (data.nextStatus === LeadStatus.LOST && !data.lostReason?.trim()) {
      return {
        ok: false,
        error: { code: "LOST_REASON_REQUIRED" },
      } as const;
    }

    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: data.nextStatus,
        lostReason:
          data.nextStatus === LeadStatus.LOST
            ? data.lostReason ?? null
            : null,
      },
    });

    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: session.user.id,
        kind: ActivityKind.STATUS_CHANGE,
        note:
          data.nextStatus === LeadStatus.LOST && data.lostReason
            ? `Status: ${lead.status} → ${data.nextStatus} (${data.lostReason})`
            : `Status: ${lead.status} → ${data.nextStatus}`,
      },
    });

    await audit({
      action: "lead.updateStatus",
      entity: "Lead",
      entityId: lead.id,
      orgId,
      userId: session.user.id,
      meta: {
        from: lead.status,
        to: data.nextStatus,
        reason: data.lostReason,
      },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);

    return {
      ok: true,
      lead: { id: updated.id, status: updated.status },
    } as const;
  });
}

export async function deleteLead(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  await prisma.lead.findFirstOrThrow({ where: { id, orgId } });
  await prisma.lead.delete({ where: { id } });

  await audit({
    action: "lead.delete",
    entity: "Lead",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/leads");
}

// ─── Qualification (Lead → Customer + Contact) ────────────────────────────────

const customerInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const contactInputSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().optional().nullable(),
    position: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
  })
  .refine(
    (c) => !!c.phone?.toString().trim() || !!c.email?.toString().trim(),
    { message: "Either phone or email is required", path: ["phone"] },
  );

// Qualification always requires both a customer (link or create) and a
// contact (link or create). The legacy "skip contact" branch is intentionally
// removed: a QUALIFIED lead must have a real point-of-contact.
const qualifyLeadSchema = z.object({
  customer: z.discriminatedUnion("strategy", [
    z.object({ strategy: z.literal("link"), customerId: z.string().min(1) }),
    z.object({ strategy: z.literal("create"), data: customerInputSchema }),
  ]),
  contact: z.discriminatedUnion("strategy", [
    z.object({ strategy: z.literal("link"), contactId: z.string().min(1) }),
    z.object({ strategy: z.literal("create"), data: contactInputSchema }),
  ]),
});

export type QualifyLeadInput = z.input<typeof qualifyLeadSchema>;

export type QualifyLeadResult =
  | { ok: true; customerId: string; contactId: string }
  | {
      ok: false;
      error:
        | { code: "LEAD_NOT_QUALIFIABLE"; currentStatus: string }
        | { code: "VALIDATION"; message: string };
    };

export async function qualifyLead(
  id: string,
  input: QualifyLeadInput,
): Promise<QualifyLeadResult> {
  const { session, orgId } = await requireRole(staffRoles);
  const parsed = qualifyLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }
  const opts = parsed.data;

  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, orgId },
    include: { contact: true },
  });

  if (
    lead.status === LeadStatus.LOST ||
    lead.status === LeadStatus.QUALIFIED
  ) {
    return {
      ok: false,
      error: { code: "LEAD_NOT_QUALIFIABLE", currentStatus: lead.status },
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    let customerId: string;
    if (opts.customer.strategy === "link") {
      const c = await tx.customer.findFirstOrThrow({
        where: { id: opts.customer.customerId, orgId },
        select: { id: true },
      });
      customerId = c.id;
    } else {
      const created = await tx.customer.create({
        data: {
          orgId,
          name: opts.customer.data.name,
          code: opts.customer.data.code || null,
          email: opts.customer.data.email || null,
          phone: opts.customer.data.phone || null,
          taxId: opts.customer.data.taxId || null,
          address: opts.customer.data.address || null,
          city: opts.customer.data.city || null,
          country: opts.customer.data.country || null,
          notes: opts.customer.data.notes || null,
          status: CustomerStatus.PROSPECT,
        },
      });
      customerId = created.id;
    }

    let contactId: string;
    if (opts.contact.strategy === "link") {
      const c = await tx.contact.findFirstOrThrow({
        where: { id: opts.contact.contactId, orgId },
        select: { id: true, customerId: true },
      });
      if (c.customerId !== customerId) {
        await tx.contact.update({
          where: { id: c.id },
          data: { customerId },
        });
      }
      contactId = c.id;
    } else {
      const created = await tx.contact.create({
        data: {
          orgId,
          customerId,
          name: opts.contact.data.name,
          email: opts.contact.data.email || null,
          phone: opts.contact.data.phone || null,
          jobTitle: opts.contact.data.position || null,
          company: opts.contact.data.company || null,
        },
      });
      contactId = created.id;
    }

    await tx.lead.update({
      where: { id },
      data: {
        status: LeadStatus.QUALIFIED,
        customerId,
        contactId,
        convertedAt: new Date(),
      },
    });

    return { customerId, contactId };
  });

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId: session.user.id,
      kind: ActivityKind.STATUS_CHANGE,
      note: `Qualified — Customer: ${result.customerId}, Contact: ${result.contactId}`,
    },
  });

  await audit({
    action: "lead.qualify",
    entity: "Lead",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: {
      customerStrategy: opts.customer.strategy,
      contactStrategy: opts.contact.strategy,
      customerId: result.customerId,
      contactId: result.contactId,
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/customers");
  return {
    ok: true,
    customerId: result.customerId,
    contactId: result.contactId,
  };
}

/**
 * Legacy wrapper for the old "convert to customer" button. Routes through
 * `qualifyLead`. If the lead has neither contact info, it fabricates a
 * minimal contact (the legacy code path always created one) so the new
 * "contact required" gate is satisfied.
 */
export async function convertToCustomer(
  id: string,
  options: { createOrder?: boolean } = {},
) {
  const { orgId } = await requireRole(staffRoles);
  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, orgId },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      notes: true,
      contactId: true,
    },
  });

  void options; // legacy `createOrder` flag is ignored; quotations are now their own flow
  const res = await qualifyLead(id, {
    customer: {
      strategy: "create",
      data: {
        name: lead.company || lead.name,
        email: lead.email || null,
        phone: lead.phone || null,
        notes: lead.notes || null,
      },
    },
    contact: lead.contactId
      ? { strategy: "link", contactId: lead.contactId }
      : {
          strategy: "create",
          data: {
            name: lead.name,
            email: lead.email || null,
            phone: lead.phone || null,
            company: lead.company || null,
          },
        },
  });

  if (!res.ok) {
    return { ok: false, error: res.error, customerId: null, orderId: null };
  }
  return { ok: true, customerId: res.customerId, orderId: null };
}

export async function addActivity(leadId: string, formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  await prisma.lead.findFirstOrThrow({ where: { id: leadId, orgId } });

  const kind = (formData.get("kind") as string) || ActivityKind.NOTE;
  const note = formData.get("note") as string;

  if (!note?.trim()) return { ok: false, error: "Note is required" };

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: session.user.id,
      kind,
      note: note.trim(),
    },
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lead Tasks
// ---------------------------------------------------------------------------

const taskSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  notes: z.string().optional(),
});

export async function createLeadTask(leadId: string, formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  await prisma.lead.findFirstOrThrow({ where: { id: leadId, orgId } });

  const raw = Object.fromEntries(formData.entries());
  const data = taskSchema.parse(raw);

  const task = await prisma.leadTask.create({
    data: {
      leadId,
      title: data.title,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      assignedToId: data.assignedToId || null,
      priority: data.priority ?? LeadPriority.MEDIUM,
      notes: data.notes || null,
    },
  });

  await audit({
    action: "leadTask.create",
    entity: "LeadTask",
    entityId: task.id,
    orgId,
    userId: session.user.id,
    meta: { leadId },
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, id: task.id };
}

export async function completeLeadTask(taskId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const task = await prisma.leadTask.findFirstOrThrow({
    where: { id: taskId, lead: { orgId } },
    select: { id: true, leadId: true, completedAt: true },
  });

  await prisma.leadTask.update({
    where: { id: taskId },
    data: { completedAt: task.completedAt ? null : new Date() },
  });

  await audit({
    action: task.completedAt ? "leadTask.reopen" : "leadTask.complete",
    entity: "LeadTask",
    entityId: taskId,
    orgId,
    userId: session.user.id,
    meta: { leadId: task.leadId },
  });

  revalidatePath(`/leads/${task.leadId}`);
  return { ok: true };
}

export async function deleteLeadTask(taskId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const task = await prisma.leadTask.findFirstOrThrow({
    where: { id: taskId, lead: { orgId } },
    select: { id: true, leadId: true },
  });

  await prisma.leadTask.delete({ where: { id: taskId } });

  await audit({
    action: "leadTask.delete",
    entity: "LeadTask",
    entityId: taskId,
    orgId,
    userId: session.user.id,
    meta: { leadId: task.leadId },
  });

  revalidatePath(`/leads/${task.leadId}`);
  return { ok: true };
}
