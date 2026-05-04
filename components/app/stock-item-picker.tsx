"use client";

import * as React from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { searchStockItems } from "@/app/[locale]/(dashboard)/warehouse/items-actions";

export type PickedStockItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  taxRate: number;
};

/**
 * Searchable stock-item picker built on the shared Combobox. Calls the
 * `searchStockItems` server action with debounce (Combobox-internal). When
 * the user picks an item, `onPick` receives the full item so the caller can
 * autofill description / unit price / currency / tax rate on the line.
 *
 * The picker stays empty after selection so it can be reused for multiple
 * lines (or to "swap" the item on a single line).
 */
export function StockItemPicker({
  onPick,
  disabled,
  triggerLabel = "Pick item",
}: {
  onPick: (item: PickedStockItem) => void;
  disabled?: boolean;
  triggerLabel?: string;
}) {
  const cacheRef = React.useRef<Map<string, PickedStockItem>>(new Map());

  const handleSearch = React.useCallback(
    async (q: string): Promise<ComboboxOption[]> => {
      const items = await searchStockItems(q);
      const cache = cacheRef.current;
      cache.clear();
      const opts: ComboboxOption[] = items.map((it) => {
        const normalized: PickedStockItem = {
          id: it.id,
          sku: it.sku,
          name: it.name,
          description: it.description,
          unit: it.unit,
          unitPrice: Number(it.unitPrice),
          currency: it.currency,
          taxRate: Number(it.taxRate),
        };
        cache.set(it.id, normalized);
        return {
          value: it.id,
          label: `${it.sku} — ${it.name}`,
          description: `${it.currency} ${Number(it.unitPrice).toFixed(2)} / ${it.unit}`,
        };
      });
      return opts;
    },
    [],
  );

  return (
    <Combobox
      options={[]}
      value={undefined}
      onValueChange={(value) => {
        if (!value) return;
        const picked = cacheRef.current.get(value);
        if (picked) onPick(picked);
      }}
      onSearch={handleSearch}
      placeholder={triggerLabel}
      searchPlaceholder="Search SKU or name…"
      emptyMessage="No items found."
      triggerClassName="h-8 px-2 text-xs"
      disabled={disabled}
    />
  );
}
