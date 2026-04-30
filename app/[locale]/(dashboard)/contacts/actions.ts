"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";

const contactSchema = z.object({
  customerId: z.string().optional(),
  name: z.string().min(1),
  position: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export async function createContact(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  let customerId: string | null = null;
  if (data.customerId) {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { id: data.customerId, orgId },
    });
    customerId = customer.id;
  }

  const contact = await prisma.contact.create({
    data: {
      orgId,
      customerId,
      name: data.name,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      notes: data.notes || null,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.CONTACT,
    recordId: contact.id,
    formData,
  });

  await audit({
    action: "contact.create",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
    meta: customerId ? { customerId } : undefined,
  });

  revalidatePath("/contacts");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  return { ok: true, id: contact.id };
}

export async function updateContact(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true, customerId: true },
  });

  if (existing.orgId !== orgId) throw new Error("Forbidden");

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      notes: data.notes || null,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.CONTACT,
    recordId: contact.id,
    formData,
  });

  await audit({
    action: "contact.update",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
  return { ok: true };
}

export async function deleteContact(id: string) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true, customerId: true },
  });

  if (existing.orgId !== orgId) throw new Error("Forbidden");

  await prisma.contact.delete({ where: { id } });

  await audit({
    action: "contact.delete",
    entity: "Contact",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
}

export async function searchContacts(q: string) {
  const { orgId } = await requireOrg();
  const trimmed = q.trim();
  return prisma.contact.findMany({
    where: {
      orgId,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
              { company: { contains: trimmed } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      position: true,
      customerId: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export async function createContactQuick(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}) {
  const { session, orgId } = await requireOrg();
  if (!input.name?.trim()) throw new Error("Name is required");

  const contact = await prisma.contact.create({
    data: {
      orgId,
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      company: input.company || null,
    },
  });

  await audit({
    action: "contact.create",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
    meta: { source: "quickCreate" },
  });

  revalidatePath("/contacts");
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
  };
}
