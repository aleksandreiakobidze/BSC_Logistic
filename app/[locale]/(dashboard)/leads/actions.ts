"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";
import { LeadStatus, ActivityKind } from "@/lib/enums";

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.string().default(LeadStatus.NEW),
  source: z.string().optional(),
  assignedToId: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).default(0),
  currency: z.string().default("USD"),
  nextFollowUp: z.string().optional(),
  notes: z.string().optional(),
});

export async function createLead(formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  const raw = Object.fromEntries(formData.entries());
  const data = leadSchema.parse(raw);

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
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
    },
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
      estimatedValue: data.estimatedValue,
      currency: data.currency,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      notes: data.notes || null,
    },
  });

  if (existing.status !== data.status) {
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: session.user.id,
        kind: ActivityKind.STATUS_CHANGE,
        note: `Status changed from ${existing.status} to ${data.status}`,
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

export async function convertToCustomer(id: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const lead = await prisma.lead.findFirstOrThrow({ where: { id, orgId } });

  if (lead.customerId) return { ok: true, customerId: lead.customerId };

  const customer = await prisma.customer.create({
    data: {
      orgId,
      name: lead.company || lead.name,
      email: lead.email || null,
      phone: lead.phone || null,
      notes: lead.notes || null,
    },
  });

  await prisma.lead.update({
    where: { id },
    data: {
      status: LeadStatus.WON,
      customerId: customer.id,
      convertedAt: new Date(),
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId: session.user.id,
      kind: ActivityKind.STATUS_CHANGE,
      note: `Converted to customer: ${customer.name}`,
    },
  });

  await audit({
    action: "lead.convert",
    entity: "Lead",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { customerId: customer.id },
  });

  revalidatePath("/leads");
  revalidatePath("/customers");
  return { ok: true, customerId: customer.id };
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
