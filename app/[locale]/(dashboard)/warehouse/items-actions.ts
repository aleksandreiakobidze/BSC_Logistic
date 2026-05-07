"use server";

// =============================================================================
// Backwards-compat shim.
//
// Item CRUD has moved to `app/[locale]/(dashboard)/items/actions.ts`. This file
// keeps the legacy server-action names (`createStockItem`, `updateStockItem`,
// `searchStockItems`) working for any caller still importing from
// `warehouse/items-actions`. Next.js's "use server" rule forbids `export { } from`
// re-exports, so each function is wrapped in a real async declaration.
//
// New code should import from `items/actions` directly.
// =============================================================================

import {
  createItem,
  updateItem,
  searchItems,
} from "@/app/[locale]/(dashboard)/items/actions";
import type { ItemInput } from "@/app/[locale]/(dashboard)/items/actions";

export async function createStockItem(input: ItemInput) {
  return createItem(input);
}

export async function updateStockItem(input: ItemInput) {
  return updateItem(input);
}

export async function searchStockItems(q: string) {
  return searchItems(q);
}
