"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";

// =============================================================================
// Items (StockItem) — staff CRUD + lightweight search.
//
// This module replaces the original `warehouse/items-actions.ts`. The latter
// is kept as a thin re-export so existing imports (StockItemPicker, etc.) keep
// working without code changes.
// =============================================================================

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

export type ItemInput = {
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

function clean(input: ItemInput) {
  const data = itemSchema.parse(input);
  return {
    sku: data.sku.trim(),
    name: data.name.trim(),
    description: data.description ? String(data.description).trim() || null : null,
    unit: data.unit.trim() || "pcs",
    unitPrice: data.unitPrice,
    currency: data.currency.trim().toUpperCase(),
    taxRate: data.taxRate,
    weightKg:
      data.weightKg === "" || data.weightKg == null ? null : Number(data.weightKg),
    notes: data.notes ? String(data.notes).trim() || null : null,
  };
}

function revalidate(itemId?: string) {
  revalidatePath("/items");
  revalidatePath("/warehouse");
  if (itemId) revalidatePath(`/items/${itemId}`);
}

/**
 * Returns the same plain-object shape the StockItemPicker expects. Used by
 * `createItem` so the inline "+ New item" footer in the picker can auto-pick
 * the freshly created row.
 */
export type CreatedItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  taxRate: number;
};

export async function createItem(
  input: ItemInput,
): Promise<{ ok: true; id: string; item: CreatedItem } | { ok: false; error: string }> {
  const { session, orgId } = await requireRole(staffRoles);
  const data = clean(input);

  try {
    const item = await prisma.stockItem.create({
      data: { orgId, ...data },
    });

    await audit({
      action: "item.create",
      entity: "StockItem",
      entityId: item.id,
      orgId,
      userId: session.user.id,
      meta: { sku: item.sku },
    });
    revalidate(item.id);

    return {
      ok: true,
      id: item.id,
      item: {
        id: item.id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        currency: item.currency,
        taxRate: Number(item.taxRate),
      },
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: `SKU "${data.sku}" already exists.` };
    }
    throw err;
  }
}

export async function updateItem(
  input: ItemInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { session, orgId } = await requireRole(staffRoles);
  const id = z.string().min(1).parse(input.id);
  const data = clean(input);

  await prisma.stockItem.findFirstOrThrow({ where: { id, orgId } });

  try {
    const item = await prisma.stockItem.update({
      where: { id },
      data,
    });

    await audit({
      action: "item.update",
      entity: "StockItem",
      entityId: item.id,
      orgId,
      userId: session.user.id,
      meta: { sku: item.sku },
    });
    revalidate(item.id);
    return { ok: true, id: item.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: `SKU "${data.sku}" already exists.` };
    }
    throw err;
  }
}

/**
 * Soft-guarded delete: if the item is referenced by any quotation line or
 * stock movement we refuse to delete it (would orphan history). The caller
 * gets a typed error message instead of a 500 so the UI can show a toast.
 */
export async function deleteItem(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, orgId } = await requireRole(staffRoles);
  const item = await prisma.stockItem.findFirstOrThrow({
    where: { id, orgId },
    select: {
      id: true,
      sku: true,
      _count: { select: { quotationLines: true, movements: true } },
    },
  });

  if (item._count.quotationLines > 0 || item._count.movements > 0) {
    return {
      ok: false,
      error: `Item is referenced by ${item._count.quotationLines} quotation lines and ${item._count.movements} stock movements. Remove those first or archive the item.`,
    };
  }

  await prisma.stockItem.delete({ where: { id } });
  await audit({
    action: "item.delete",
    entity: "StockItem",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { sku: item.sku },
  });
  revalidate();
  return { ok: true };
}

/**
 * Lightweight search used by the quotation line item picker.
 *
 * Prisma's `Decimal` is not serializable across the Server → Client boundary,
 * so we coerce `unitPrice` and `taxRate` to plain numbers here before
 * returning the rows.
 */
export async function searchItems(q: string) {
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

/**
 * Look up a list of item ids in a single query. Used by the picker to render
 * "Recently used" chips after the user reopens the popover (the localStorage
 * cache only stores ids — we always re-fetch to get fresh prices).
 */
export async function getItemsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const { orgId } = await requireRole(staffRoles);
  const rows = await prisma.stockItem.findMany({
    where: { orgId, id: { in: ids } },
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
