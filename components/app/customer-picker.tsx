"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  Combobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { searchCustomers } from "@/app/[locale]/(dashboard)/customers/actions";

export interface CustomerSnapshot {
  id: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
}

interface CustomerPickerProps {
  value?: string;
  initialCustomer?: CustomerSnapshot;
  onChange: (customer: CustomerSnapshot | undefined) => void;
  className?: string;
  placeholder?: string;
}

export function CustomerPicker({
  value,
  initialCustomer,
  onChange,
  className,
  placeholder,
}: CustomerPickerProps) {
  const t = useTranslations();
  const [snapshot, setSnapshot] = React.useState<CustomerSnapshot | undefined>(
    initialCustomer,
  );
  const cacheRef = React.useRef<Map<string, CustomerSnapshot>>(new Map());

  React.useEffect(() => {
    if (initialCustomer) cacheRef.current.set(initialCustomer.id, initialCustomer);
  }, [initialCustomer]);

  const initialOptions: ComboboxOption[] = initialCustomer
    ? [
        {
          value: initialCustomer.id,
          label: initialCustomer.name,
          description:
            initialCustomer.code ||
            initialCustomer.email ||
            initialCustomer.phone ||
            undefined,
        },
      ]
    : [];

  const handleSearch = React.useCallback(async (q: string) => {
    const results = await searchCustomers(q);
    for (const r of results) cacheRef.current.set(r.id, r);
    return results.map((r) => ({
      value: r.id,
      label: r.name,
      description: r.code || r.email || r.phone || undefined,
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

  return (
    <div className={className}>
      <Combobox
        options={initialOptions}
        value={value}
        onValueChange={handleSelect}
        onSearch={handleSearch}
        placeholder={placeholder ?? t("customers.title")}
        searchPlaceholder={t("customers.title")}
        emptyMessage={t("customers.empty") ?? "No results"}
      />
      {snapshot && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{snapshot.name}</div>
            <div className="text-muted-foreground">
              {[snapshot.code, snapshot.email, snapshot.phone]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
          {snapshot.status && (
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {snapshot.status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
