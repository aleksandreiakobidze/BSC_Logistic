"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";

const itemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  unit: z.string().min(1).max(20).default("pcs"),
  unitPrice: z.coerce.number().min(0).default(0),
  currency: z.string().min(1).max(8).default("USD"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  weightKg: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type StockItemInput = {
  id?: string;
  sku: string;
  name: string;
  description?: string | null;
  unit?: string;
  unitPrice?: number | string;
  currency?: string;
  taxRate?: number | string;
  weightKg?: number | string | null;
  notes?: string | null;
};

function clean(input: StockItemInput) {
  const data = itemSchema.parse(input);
  return {
    sku: data.sku.trim(),
    name: data.name.trim(),
    description: data.description ? String(data.description).trim() || null : null,
    unit: data.unit.trim() || "pcs",
    unitPrice: data.unitPrice,
    currency: data.currency.trim().toUpperCase(),
    taxRate: data.taxRate,
    weightKg: data.weightKg === "" || data.weightKg == null ? null : Number(data.weightKg),
    notes: data.notes ? String(data.notes).trim() || null : null,
  };
}

export async function createStockItem(input: StockItemInput) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = clean(input);

  const item = await prisma.stockItem.create({
    data: { orgId, ...data },
  });

  await audit({
    action: "stockItem.create",
    entity: "StockItem",
    entityId: item.id,
    orgId,
    userId: session.user.id,
    meta: { sku: item.sku },
  });
  revalidatePath("/warehouse");
  return { ok: true, id: item.id };
}

export async function updateStockItem(input: StockItemInput) {
  const { session, orgId } = await requireRole(staffRoles);
  const id = z.string().min(1).parse(input.id);
  const data = clean(input);

  await prisma.stockItem.findFirstOrThrow({ where: { id, orgId } });

  const item = await prisma.stockItem.update({
    where: { id },
    data,
  });

  await audit({
    action: "stockItem.update",
    entity: "StockItem",
    entityId: item.id,
    orgId,
    userId: session.user.id,
    meta: { sku: item.sku },
  });
  revalidatePath("/warehouse");
  return { ok: true, id: item.id };
}

/**
 * Lightweight search used by the quotation line item picker.
 *
 * Prisma's `Decimal` is not serializable across the Server → Client boundary,
 * so we coerce `unitPrice` and `taxRate` to plain numbers here before
 * returning the rows.
 */
export async function searchStockItems(q: string) {
  const { orgId } = await requireRole(staffRoles);
  const trimmed = q.trim();
  const rows = await prisma.stockItem.findMany({
    where: {
      orgId,
      ...(trimmed
        ? {
            OR: [
              { sku: { contains: trimmed } },
              { name: { contains: trimmed } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 30,
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      unit: true,
      unitPrice: true,
      currency: true,
      taxRate: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    description: r.description,
    unit: r.unit,
    currency: r.currency,
    unitPrice: Number(r.unitPrice),
    taxRate: Number(r.taxRate),
  }));
}
