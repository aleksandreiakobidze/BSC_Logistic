"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";
import {
  LeadStatus,
  ActivityKind,
  LeadPriority,
  CustomerStatus,
} from "@/lib/enums";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";

const PRIORITY_VALUES = Object.values(LeadPriority) as [string, ...string[]];

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.string().default(LeadStatus.NEW),
  source: z.string().optional(),
  assignedToId: z.string().optional(),
  contactId: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).default(0),
  currency: z.string().default("USD"),
  score: z.coerce.number().int().min(0).max(100).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  nextFollowUp: z.string().optional(),
  notes: z.string().optional(),
  lostReason: z.string().optional(),
});

export async function createLead(formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  const raw = Object.fromEntries(formData.entries());
  const data = leadSchema.parse(raw);

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
      status: data.status,
      source: data.source || null,
      assignedToId: data.assignedToId || null,
      contactId: data.contactId || null,
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      score: data.score ?? 0,
      priority: data.priority ?? LeadPriority.MEDIUM,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
      lostReason:
        data.status === LeadStatus.LOST ? data.lostReason || null : null,
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
      note: `Lead created with status ${data.status}`,
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
  const data = leadSchema.parse(raw);

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
      status: data.status,
      source: data.source || null,
      assignedToId: data.assignedToId || null,
      contactId: data.contactId || null,
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      score: data.score ?? existing.score,
      priority: data.priority ?? existing.priority,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
      lostReason:
        data.status === LeadStatus.LOST ? data.lostReason || null : null,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.LEAD,
    recordId: lead.id,
    formData,
  });

  if (existing.status !== data.status) {
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: session.user.id,
        kind: ActivityKind.STATUS_CHANGE,
        note:
          data.status === LeadStatus.LOST && data.lostReason
            ? `Status changed from ${existing.status} to ${data.status}: ${data.lostReason}`
            : `Status changed from ${existing.status} to ${data.status}`,
      },
    });
  }

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

export async function updateLeadStatus(id: string, status: string) {
  const { session, orgId } = await requireRole(staffRoles);

  const existing = await prisma.lead.findFirstOrThrow({ where: { id, orgId } });

  await prisma.lead.update({ where: { id }, data: { status } });

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId: session.user.id,
      kind: ActivityKind.STATUS_CHANGE,
      note: `Status changed from ${existing.status} to ${status}`,
    },
  });

  await audit({
    action: "lead.status",
    entity: "Lead",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { from: existing.status, to: status },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
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

const contactInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
});

const qualifyLeadSchema = z.object({
  customer: z.discriminatedUnion("strategy", [
    z.object({ strategy: z.literal("link"), customerId: z.string().min(1) }),
    z.object({ strategy: z.literal("create"), data: customerInputSchema }),
  ]),
  contact: z
    .discriminatedUnion("strategy", [
      z.object({ strategy: z.literal("skip") }),
      z.object({ strategy: z.literal("link"), contactId: z.string().min(1) }),
      z.object({ strategy: z.literal("create"), data: contactInputSchema }),
    ])
    .default({ strategy: "skip" } as const),
});

export type QualifyLeadInput = z.input<typeof qualifyLeadSchema>;

export async function qualifyLead(id: string, input: QualifyLeadInput) {
  const { session, orgId } = await requireRole(staffRoles);
  const opts = qualifyLeadSchema.parse(input);
  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, orgId },
    include: { contact: true },
  });

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

    let contactId: string | null = lead.contactId;
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
    } else if (opts.contact.strategy === "create") {
      const created = await tx.contact.create({
        data: {
          orgId,
          customerId,
          name: opts.contact.data.name,
          email: opts.contact.data.email || null,
          phone: opts.contact.data.phone || null,
          position: opts.contact.data.position || null,
          company: opts.contact.data.company || null,
        },
      });
      contactId = created.id;
    } else if (lead.contact && !lead.contact.customerId) {
      // No explicit contact strategy, but the lead already had a contact —
      // attach it to the new customer for continuity.
      await tx.contact.update({
        where: { id: lead.contact.id },
        data: { customerId },
      });
      contactId = lead.contact.id;
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
      note: `Lead qualified — linked to customer`,
    },
  });

  await audit({
    action: "lead.qualify",
    entity: "Lead",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { customerId: result.customerId, contactId: result.contactId },
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
 * Backward-compatible wrapper for the legacy `convertToCustomer` flow.
 * The new canonical entry point is `qualifyLead` which leaves Lead in
 * `QUALIFIED` (not `WON`), and creates a Quotation in a separate step.
 */
export async function convertToCustomer(
  id: string,
  options: { createOrder?: boolean } = {},
) {
  const { orgId } = await requireRole(staffRoles);
  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, orgId },
    select: { id: true, name: true, company: true, email: true, phone: true, notes: true, contactId: true },
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
      ? { strategy: "skip" }
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

  return { ok: res.ok, customerId: res.customerId, orderId: null };
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
