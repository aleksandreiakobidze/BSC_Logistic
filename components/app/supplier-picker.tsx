"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import {
  Combobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { searchSuppliers } from "@/app/[locale]/(dashboard)/suppliers/actions";

export interface SupplierSnapshot {
  id: string;
  code: string | null;
  name: string;
  type: string;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  defaultTransitTimeDays?: number | null;
}

interface SupplierPickerProps {
  value?: string;
  initialSupplier?: SupplierSnapshot;
  onChange: (supplier: SupplierSnapshot | undefined) => void;
  className?: string;
  placeholder?: string;
}

export function SupplierPicker({
  value,
  initialSupplier,
  onChange,
  className,
  placeholder,
}: SupplierPickerProps) {
  const t = useTranslations();
  const [snapshot, setSnapshot] = React.useState<SupplierSnapshot | undefined>(
    initialSupplier,
  );
  const [options, setOptions] = React.useState<ComboboxOption[]>(
    initialSupplier
      ? [
          {
            value: initialSupplier.id,
            label: initialSupplier.name,
            description: describe(initialSupplier),
          },
        ]
      : [],
  );
  const cacheRef = React.useRef<Map<string, SupplierSnapshot>>(new Map());

  React.useEffect(() => {
    if (initialSupplier) {
      cacheRef.current.set(initialSupplier.id, initialSupplier);
    }
  }, [initialSupplier]);

  const handleSearch = React.useCallback(async (q: string) => {
    const results = await searchSuppliers(q);
    for (const r of results) {
      cacheRef.current.set(r.id, r);
    }
    return results.map((r) => ({
      value: r.id,
      label: r.name,
      description: describe(r),
    }));
  }, []);

  const handleSelect = (newValue: string | undefined) => {
    if (!newValue) {
      setSnapshot(undefined);
      onChange(undefined);
      return;
    }
    const found = cacheRef.current.get(newValue);
    if (found) {
      setSnapshot(found);
      onChange(found);
    }
  };

  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  return (
    <div className={className}>
      <Combobox
        options={options}
        value={value}
        onValueChange={handleSelect}
        onSearch={handleSearch}
        placeholder={
          placeholder ?? tx("suppliers.pickerPlaceholder", "Search supplier...")
        }
        searchPlaceholder={tx(
          "suppliers.searchPlaceholder",
          "Search suppliers...",
        )}
        emptyMessage={tx("suppliers.empty", "No suppliers")}
      />
      {snapshot && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{snapshot.name}</div>
            <div className="text-muted-foreground">
              {describe(snapshot) || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function describe(s: SupplierSnapshot): string | undefined {
  const parts = [
    s.code,
    s.email,
    s.phone,
    s.currency,
    s.defaultTransitTimeDays != null ? `${s.defaultTransitTimeDays}d` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
