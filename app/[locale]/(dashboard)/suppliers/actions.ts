"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { SupplierStatus, SupplierType } from "@/lib/enums";

const supplierSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(Object.values(SupplierType) as [string, ...string[]]).optional(),
  status: z
    .enum(Object.values(SupplierStatus) as [string, ...string[]])
    .optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  defaultTransitTimeDays: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
});

async function nextSupplierCode(orgId: string): Promise<string> {
  const count = await prisma.supplier.count({ where: { orgId } });
  return "SUP-" + String(count + 1).padStart(6, "0");
}

export async function createSupplier(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = supplierSchema.parse(raw);

  let code: string;
  let retries = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    code = data.code?.trim() || (await nextSupplierCode(orgId));
    try {
      const supplier = await prisma.supplier.create({
        data: {
          orgId,
          code,
          name: data.name,
          type: data.type || SupplierType.OTHER,
          status: data.status || SupplierStatus.ACTIVE,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          taxId: data.taxId || null,
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          currency: data.currency || "USD",
          paymentTerms: data.paymentTerms || null,
          defaultTransitTimeDays: data.defaultTransitTimeDays ?? null,
          notes: data.notes || null,
          ownerId:
            data.ownerId && data.ownerId !== "none" ? data.ownerId : null,
        },
      });

      await audit({
        action: "supplier.create",
        entity: "Supplier",
        entityId: supplier.id,
        orgId,
        userId: session.user.id,
        meta: { code },
      });

      revalidatePath("/suppliers");
      return { ok: true, id: supplier.id };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002" &&
        retries < 3 &&
        !data.code
      ) {
        retries++;
        continue;
      }
      throw err;
    }
  }
}

export async function updateSupplier(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = supplierSchema.parse(raw);

  const existing = await prisma.supplier.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true },
  });
  if (existing.orgId !== orgId) throw new Error("Forbidden");

  await prisma.supplier.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type || undefined,
      status: data.status || undefined,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      taxId: data.taxId || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      currency: data.currency || undefined,
      paymentTerms: data.paymentTerms || null,
      defaultTransitTimeDays: data.defaultTransitTimeDays ?? null,
      notes: data.notes || null,
      ownerId: data.ownerId && data.ownerId !== "none" ? data.ownerId : null,
    },
  });

  await audit({
    action: "supplier.update",
    entity: "Supplier",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { ok: true };
}

export async function deleteSupplier(id: string) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.supplier.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true, _count: { select: { offers: true } } },
  });
  if (existing.orgId !== orgId) throw new Error("Forbidden");
  if (existing._count.offers > 0) {
    throw new Error(
      "Supplier has supplier offers attached. Remove or reassign them first.",
    );
  }

  await prisma.supplier.delete({ where: { id } });

  await audit({
    action: "supplier.delete",
    entity: "Supplier",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/suppliers");
  return { ok: true };
}

export async function searchSuppliers(q: string) {
  const { orgId } = await requireOrg();
  const trimmed = q.trim();
  return prisma.supplier.findMany({
    where: {
      orgId,
      status: SupplierStatus.ACTIVE,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
              { code: { contains: trimmed } },
              { taxId: { contains: trimmed } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      currency: true,
      defaultTransitTimeDays: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}
