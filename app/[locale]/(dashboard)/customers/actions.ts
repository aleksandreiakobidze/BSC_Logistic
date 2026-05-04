"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { staffRoles } from "@/lib/rbac";
import { CustomerStatus } from "@/lib/enums";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";

const CUSTOMER_STATUS_VALUES = Object.values(CustomerStatus) as [
  string,
  ...string[],
];

const customerSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  status: z.enum(CUSTOMER_STATUS_VALUES).optional(),
});

export async function createCustomer(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = customerSchema.parse(raw);

  const c = await prisma.customer.create({
    data: {
      orgId,
      name: data.name,
      code: data.code || null,
      email: data.email || null,
      phone: data.phone || null,
      taxId: data.taxId || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      creditLimit: data.creditLimit,
      notes: data.notes || null,
      status: data.status ?? CustomerStatus.PROSPECT,
    },
  });
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.CUSTOMER,
    recordId: c.id,
    formData,
  });
  await audit({ action: "customer.create", entity: "Customer", entityId: c.id, orgId, userId: session.user.id });
  revalidatePath("/customers");
  return { ok: true, id: c.id };
}

/**
 * Update a customer's editable fields. Mirrors `createCustomer`'s schema so
 * the same dialog can be reused for create/edit. Status is intentionally
 * NOT updated here — use `setCustomerStatus` for that (it has the activation
 * timestamp logic).
 */
export async function updateCustomer(id: string, formData: FormData) {
  const { session, orgId } = await requireRole(staffRoles);
  const existing = await prisma.customer.findFirstOrThrow({
    where: { id, orgId },
    select: { id: true },
  });

  const raw = Object.fromEntries(formData.entries());
  const data = customerSchema.parse(raw);

  await prisma.customer.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      code: data.code || null,
      email: data.email || null,
      phone: data.phone || null,
      taxId: data.taxId || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      creditLimit: data.creditLimit,
      notes: data.notes || null,
    },
  });

  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.CUSTOMER,
    recordId: existing.id,
    formData,
  });

  await audit({
    action: "customer.update",
    entity: "Customer",
    entityId: existing.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${existing.id}`);
  return { ok: true, id: existing.id };
}

/**
 * Manual override of a customer's lifecycle status. The system also flips
 * `PROSPECT → ACTIVE` automatically when the first Sales Order is confirmed
 * (see [orders/actions.ts](app/[locale]/(dashboard)/orders/actions.ts)).
 */
export async function setCustomerStatus(
  id: string,
  status: (typeof CUSTOMER_STATUS_VALUES)[number],
) {
  const { session, orgId } = await requireRole(staffRoles);
  const existing = await prisma.customer.findFirstOrThrow({
    where: { id, orgId },
    select: { id: true, status: true, firstActivatedAt: true },
  });

  await prisma.customer.update({
    where: { id },
    data: {
      status,
      firstActivatedAt:
        status === CustomerStatus.ACTIVE && !existing.firstActivatedAt
          ? new Date()
          : existing.firstActivatedAt,
    },
  });

  await audit({
    action: "customer.setStatus",
    entity: "Customer",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { from: existing.status, to: status },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

/** Search customers by name/code/email/phone. Mirrors searchContacts shape. */
export async function searchCustomers(q: string) {
  const { orgId } = await requireOrg();
  const trimmed = q.trim();
  return prisma.customer.findMany({
    where: {
      orgId,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed } },
              { code: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      status: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}
