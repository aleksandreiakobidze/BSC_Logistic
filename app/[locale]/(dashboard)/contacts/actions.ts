"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";

const contactSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1),
  position: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export async function createContact(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: data.customerId, orgId },
  });

  const contact = await prisma.contact.create({
    data: {
      customerId: customer.id,
      name: data.name,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
    },
  });

  await audit({
    action: "contact.create",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
    meta: { customerId: customer.id },
  });

  revalidatePath("/contacts");
  revalidatePath(`/customers/${customer.id}`);
  return { ok: true, id: contact.id };
}

export async function updateContact(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    include: { customer: { select: { orgId: true } } },
  });

  if (existing.customer.orgId !== orgId) throw new Error("Forbidden");

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
    },
  });

  await audit({
    action: "contact.update",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  revalidatePath(`/customers/${data.customerId}`);
  return { ok: true };
}

export async function deleteContact(id: string) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    include: { customer: { select: { id: true, orgId: true } } },
  });

  if (existing.customer.orgId !== orgId) throw new Error("Forbidden");

  await prisma.contact.delete({ where: { id } });

  await audit({
    action: "contact.delete",
    entity: "Contact",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  revalidatePath(`/customers/${existing.customer.id}`);
}
