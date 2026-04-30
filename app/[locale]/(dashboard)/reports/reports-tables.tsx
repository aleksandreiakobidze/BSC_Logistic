"use client";

import React, { useState, useMemo } from "react";
import { Columns2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColDef<T> = {
  key: keyof T & string;
  label: string;
  defaultVisible?: boolean;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /**
   * Aggregate kind to render in the subtotal footer for this column.
   * Combined with `aggregateKey`/`aggregateRender` to compute and format the cell.
   */
  aggregate?: "sum" | "count" | "avg";
  /** Numeric mirror key (e.g. "totalNumeric") used to compute the aggregate. */
  aggregateKey?: keyof T & string;
  /** Custom renderer for the aggregate cell. Receives the underlying rows. */
  aggregateRender?: (rows: T[]) => React.ReactNode;
};

type SortDir = "asc" | "desc" | null;

// ─── Status badge helper ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  LOST: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  NEW: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  QUALIFIED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PROPOSAL_SENT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NEGOTIATION: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONTACTED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  QUOTE: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Column toggle dropdown ───────────────────────────────────────────────────

function ColumnToggle<T>({
  cols,
  visible,
  onToggle,
}: {
  cols: ColDef<T>[];
  visible: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Columns2 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {cols.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visible.has(col.key)}
            onCheckedChange={() => onToggle(col.key)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Generic sortable table ───────────────────────────────────────────────────

function SortableTable<T extends Record<string, unknown>>({
  cols,
  rows,
  emptyLabel = "No data",
  locale,
}: {
  cols: ColDef<T>[];
  rows: T[];
  emptyLabel?: string;
  locale: string;
}) {
  const t = useTranslations();

  const defaultVisible = new Set(
    cols.filter((c) => c.defaultVisible !== false).map((c) => c.key),
  );
  const [visible, setVisible] = useState<Set<string>>(defaultVisible);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function toggleCol(key: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const visibleCols = cols.filter((c) => visible.has(c.key));

  const hasAggregates = visibleCols.some(
    (c) => c.aggregate || c.aggregateRender,
  );

  // Index of the first visible column without an aggregate — that's where we
  // anchor the "Subtotal · N rows" label so it doesn't collide with numbers.
  const labelColIdx = Math.max(
    0,
    visibleCols.findIndex((c) => !c.aggregate && !c.aggregateRender),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <ColumnToggle cols={cols} visible={visible} onToggle={toggleCol} />
      </div>

      <div
        className={cn(
          "relative max-h-[640px] overflow-auto rounded-2xl border bg-card",
          "ring-1 ring-border/50",
        )}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-primary" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={visibleCols.length}
                  className="py-10 text-center text-xs text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
            {sorted.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  "group border-b last:border-0 transition-colors",
                  "hover:bg-muted/40",
                  "relative",
                )}
              >
                {visibleCols.map((col, ci) => (
                  <td
                    key={col.key}
                    className={cn(
                      "relative px-3 py-2.5 whitespace-nowrap",
                      ci === 0 &&
                        "before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary before:opacity-0 group-hover:before:opacity-70 before:transition-opacity",
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasAggregates && sorted.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                {visibleCols.map((col, ci) => {
                  const isLabelCol = ci === labelColIdx;
                  if (col.aggregateRender) {
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 font-mono text-xs font-semibold",
                          col.className,
                        )}
                      >
                        {col.aggregateRender(sorted)}
                      </td>
                    );
                  }
                  if (col.aggregate && col.aggregateKey) {
                    const nums = sorted
                      .map((r) => Number(r[col.aggregateKey!] ?? 0))
                      .filter((v) => Number.isFinite(v));
                    let agg = 0;
                    if (col.aggregate === "sum")
                      agg = nums.reduce((a, b) => a + b, 0);
                    else if (col.aggregate === "count") agg = nums.length;
                    else if (col.aggregate === "avg")
                      agg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
                    const formatted =
                      col.aggregate === "count"
                        ? formatNumberCompact(agg, locale, 0)
                        : formatNumberCompact(agg, locale);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 font-mono text-xs font-semibold text-foreground",
                          col.className,
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground">Σ </span>
                        {formatted}
                      </td>
                    );
                  }
                  if (isLabelCol) {
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                          col.className,
                        )}
                      >
                        {t("reports.subtotal")} ·{" "}
                        <span className="font-mono">{sorted.length}</span>{" "}
                        {t("reports.rows")}
                      </td>
                    );
                  }
                  return <td key={col.key} className={col.className} />;
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-right text-xs text-muted-foreground">
        {sorted.length} {t("reports.rows")}
      </p>
    </div>
  );
}

function formatNumberCompact(
  n: number,
  locale: string,
  fractionDigits = 2,
): string {
  if (!Number.isFinite(n)) return "—";
  // Pinning the locale prevents server (Node ICU defaults) and client
  // (browser ICU) from disagreeing on separators during hydration.
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(n);
}

// ─── Data types ───────────────────────────────────────────────────────────────

export type InvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: string;
  paid: string;
  balance: string;
  totalNumeric: number;
  paidNumeric: number;
  balanceNumeric: number;
  currency: string;
};

export type OrderRow = {
  id: string;
  number: string;
  customerName: string;
  status: string;
  createdAt: string;
  price: string;
  priceNumeric: number;
  currency: string;
};

export type LeadRow = {
  id: string;
  name: string;
  company: string;
  status: string;
  source: string;
  estimatedValue: string;
  estimatedValueNumeric: number;
  currency: string;
  assignedTo: string;
  createdAt: string;
};

// ─── Column definitions ───────────────────────────────────────────────────────

const INVOICE_COLS: ColDef<InvoiceRow>[] = [
  { key: "number", label: "Invoice #", sortable: true, render: (r) => <span className="font-mono font-medium">{r.number}</span> },
  { key: "customerName", label: "Customer", sortable: true },
  { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
  { key: "issueDate", label: "Issue Date", sortable: true },
  { key: "dueDate", label: "Due Date", sortable: true },
  { key: "currency", label: "Currency", defaultVisible: false },
  {
    key: "total",
    label: "Total",
    sortable: true,
    className: "text-right font-mono",
    render: (r) => <span className="font-medium">{r.total}</span>,
    aggregate: "sum",
    aggregateKey: "totalNumeric",
  },
  {
    key: "paid",
    label: "Paid",
    sortable: true,
    className: "text-right font-mono text-emerald-600 dark:text-emerald-400",
    aggregate: "sum",
    aggregateKey: "paidNumeric",
  },
  {
    key: "balance",
    label: "Balance",
    sortable: true,
    className: "text-right font-mono text-amber-600 dark:text-amber-400",
    aggregate: "sum",
    aggregateKey: "balanceNumeric",
  },
];

const ORDER_COLS: ColDef<OrderRow>[] = [
  { key: "number", label: "Order #", sortable: true, render: (r) => <span className="font-mono font-medium">{r.number}</span> },
  { key: "customerName", label: "Customer", sortable: true },
  { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
  { key: "createdAt", label: "Date", sortable: true },
  { key: "currency", label: "Currency", defaultVisible: false },
  {
    key: "price",
    label: "Price",
    sortable: true,
    className: "text-right font-mono",
    render: (r) => <span className="font-medium">{r.price}</span>,
    aggregate: "sum",
    aggregateKey: "priceNumeric",
  },
];

const LEAD_COLS: ColDef<LeadRow>[] = [
  { key: "name", label: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "company", label: "Company", sortable: true },
  { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
  { key: "source", label: "Source", defaultVisible: true },
  { key: "currency", label: "Currency", defaultVisible: false },
  {
    key: "estimatedValue",
    label: "Est. Value",
    sortable: true,
    className: "text-right font-mono",
    aggregate: "sum",
    aggregateKey: "estimatedValueNumeric",
  },
  { key: "assignedTo", label: "Assigned To", defaultVisible: true },
  { key: "createdAt", label: "Created", sortable: true },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function ReportTables({
  invoices,
  orders,
  leads,
  locale,
}: {
  invoices: InvoiceRow[];
  orders: OrderRow[];
  leads: LeadRow[];
  locale: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold">Data Tables</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="invoices">
          <TabsList className="mb-4">
            <TabsTrigger value="invoices">
              Invoices
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {invoices.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="orders">
              Orders
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {orders.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="leads">
              Leads
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {leads.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <SortableTable
              cols={INVOICE_COLS}
              rows={invoices}
              emptyLabel="No invoices found"
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="orders">
            <SortableTable
              cols={ORDER_COLS}
              rows={orders}
              emptyLabel="No orders found"
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="leads">
            <SortableTable
              cols={LEAD_COLS}
              rows={leads}
              emptyLabel="No leads found"
              locale={locale}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
