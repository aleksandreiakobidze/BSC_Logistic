"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";

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
    },
  });
  await audit({ action: "customer.create", entity: "Customer", entityId: c.id, orgId, userId: session.user.id });
  revalidatePath("/customers");
  return { ok: true, id: c.id };
}
