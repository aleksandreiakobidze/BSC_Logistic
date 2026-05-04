"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DataTableColumnsButton,
  loadColumnPrefs,
  saveColumnPrefs,
  type ColumnDescriptor,
  type ColumnPrefs,
} from "@/components/app/data-table-columns-button";
import { formatCurrency } from "@/lib/utils";
import {
  CustomFieldType,
  type CustomFieldDefinitionView,
  type CustomFieldValueMap,
} from "@/lib/custom-fields";

const FIXED_COLUMN_IDS = ["name", "email", "phone", "orders", "invoices", "credit"] as const;
type FixedColId = (typeof FIXED_COLUMN_IDS)[number];

type FixedLabels = Record<FixedColId, string>;

export type CustomerRow = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  orderCount: number;
  invoiceCount: number;
  creditLimit: number;
  cf: CustomFieldValueMap;
};

/**
 * Client wrapper around the customers list. Renders the fixed columns
 * (name/email/phone/orders/invoices/credit) plus one column per visible custom
 * field. The user picks which custom fields are columns via the toolbar
 * button; the choice is persisted in localStorage so it survives refreshes.
 */
export function CustomersTable({
  customers,
  customFields,
  locale,
  baseCurrency,
  storageScope,
  fixedLabels,
}: {
  customers: CustomerRow[];
  customFields: CustomFieldDefinitionView[];
  locale: string;
  baseCurrency: string;
  storageScope: string;
  fixedLabels: FixedLabels;
}) {
  // Build the unified column descriptor list. Fixed columns are pinned.
  const allColumns: ColumnDescriptor[] = React.useMemo(
    () => [
      ...FIXED_COLUMN_IDS.map((id) => ({
        id,
        label: fixedLabels[id],
        pinned: true as const,
        defaultVisible: true,
      })),
      ...customFields.map((cf) => ({
        id: `cf:${cf.key}`,
        label: cf.label,
        defaultVisible: cf.showInList,
      })),
    ],
    [customFields, fixedLabels],
  );

  // Hydrate prefs after mount so SSR HTML matches the empty-state ordering.
  const [prefs, setPrefs] = React.useState<ColumnPrefs>(() => ({
    visible: allColumns
      .filter((c) => c.pinned || c.defaultVisible)
      .map((c) => c.id),
    order: allColumns.map((c) => c.id),
  }));

  React.useEffect(() => {
    const next = loadColumnPrefs(storageScope, allColumns);
    setPrefs(next);
    saveColumnPrefs(storageScope, next);
  }, [storageScope, allColumns]);

  const cfByKey = React.useMemo(
    () => new Map(customFields.map((cf) => [cf.key, cf])),
    [customFields],
  );

  const visibleSet = React.useMemo(
    () => new Set(prefs.visible),
    [prefs.visible],
  );

  const orderedColumns = React.useMemo(
    () =>
      prefs.order
        .map((id) => allColumns.find((c) => c.id === id))
        .filter((c): c is ColumnDescriptor => !!c)
        .filter((c) => visibleSet.has(c.id)),
    [allColumns, prefs.order, visibleSet],
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DataTableColumnsButton
          storageKey={storageScope}
          columns={allColumns}
          prefs={prefs}
          onChange={setPrefs}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={col.id === "credit" ? "text-right" : ""}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                {orderedColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cellClass(col.id)}
                  >
                    {renderCell(col.id, c, cfByKey, locale, baseCurrency)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function cellClass(id: string): string {
  if (id === "credit") return "text-right font-mono text-sm";
  if (id === "email" || id === "phone") return "text-muted-foreground";
  return "";
}

function renderCell(
  id: string,
  c: CustomerRow,
  cfByKey: Map<string, CustomFieldDefinitionView>,
  locale: string,
  baseCurrency: string,
): React.ReactNode {
  switch (id) {
    case "name":
      return (
        <>
          <Link
            href={`/customers/${c.id}`}
            className="font-medium hover:underline"
          >
            {c.name}
          </Link>
          {c.code && (
            <div className="text-xs text-muted-foreground">{c.code}</div>
          )}
        </>
      );
    case "email":
      return c.email ?? "—";
    case "phone":
      return c.phone ?? "—";
    case "orders":
      return c.orderCount;
    case "invoices":
      return c.invoiceCount;
    case "credit":
      return formatCurrency(c.creditLimit, baseCurrency, locale);
    default:
      if (id.startsWith("cf:")) {
        const key = id.slice(3);
        const def = cfByKey.get(key);
        if (!def) return "—";
        return (
          <CustomCell
            value={c.cf[key]}
            def={def}
            locale={locale}
            currency={baseCurrency}
          />
        );
      }
      return null;
  }
}

function CustomCell({
  value,
  def,
  locale,
  currency,
}: {
  value: unknown;
  def: CustomFieldDefinitionView;
  locale: string;
  currency: string;
}) {
  if (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (def.type) {
    case CustomFieldType.BOOLEAN:
      return value ? "✓" : "—";
    case CustomFieldType.MULTI_SELECT: {
      const labels = new Map(
        (def.options ?? []).map((o) => [o.value, o.label]),
      );
      const arr = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.slice(0, 3).map((v) => (
            <span
              key={v}
              className="rounded-full border bg-muted px-1.5 py-0.5 text-[10px]"
            >
              {labels.get(v) ?? v}
            </span>
          ))}
          {arr.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{arr.length - 3}
            </span>
          )}
        </div>
      );
    }
    case CustomFieldType.DROPDOWN: {
      const labels = new Map(
        (def.options ?? []).map((o) => [o.value, o.label]),
      );
      return <span>{labels.get(String(value)) ?? String(value)}</span>;
    }
    case CustomFieldType.EMAIL:
      return (
        <a
          href={`mailto:${String(value)}`}
          className="text-foreground underline"
        >
          {String(value)}
        </a>
      );
    case CustomFieldType.URL:
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline"
          title={String(value)}
        >
          <span className="block max-w-[180px] truncate">{String(value)}</span>
        </a>
      );
    case CustomFieldType.FILE: {
      const url = String(value);
      const name = url.split("/").pop() ?? url;
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline"
        >
          <span className="block max-w-[140px] truncate">{name}</span>
        </a>
      );
    }
    case CustomFieldType.DATE:
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          new Date(String(value)),
        );
      } catch {
        return String(value);
      }
    case CustomFieldType.CURRENCY:
      return (
        <span className="font-mono">
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(Number(value))}
        </span>
      );
    case CustomFieldType.NUMBER:
      return <span className="font-mono">{String(value)}</span>;
    default: {
      const text = String(value);
      return (
        <span
          className="block max-w-[220px] truncate"
          title={text.length > 30 ? text : undefined}
        >
          {text}
        </span>
      );
    }
  }
}
