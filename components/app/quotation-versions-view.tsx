"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  User2,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatCurrency, formatDateTime } from "@/lib/utils";

/**
 * One line as captured in a `QuotationRevision.linesJson` snapshot. Mirrors
 * `RevisionLineSnapshot` from `lib/quotations.ts` but defined locally so this
 * component stays purely client-side without server imports.
 */
export type VersionLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Customer-side annotation captured at snapshot time. */
  customerStatus?: string | null;
  customerNote?: string | null;
  proposedQuantity?: number | null;
  proposedUnitPrice?: number | null;
  proposedDescription?: string | null;
};

export type QuotationVersion = {
  /** Stable id for the tab. Use revision id, or "live". */
  id: string;
  /** Monotonic version number for display. `null` for the live working copy. */
  version: number | null;
  /** "ADMIN" | "CUSTOMER" | "LIVE". */
  source: "ADMIN" | "CUSTOMER" | "LIVE";
  /** ISO date or null for live. */
  createdAt: string | null;
  authorName: string | null;
  message: string | null;
  total: number;
  currency: string;
  lines: VersionLine[];
};

/**
 * Tabbed comparison view for the lifecycle of a quotation. Renders one tab per
 * revision (oldest → newest) plus an optional "Live (current)" tab for the
 * working copy. The active tab shows a side-by-side comparison with the
 * previous version when one exists, or a single-column listing otherwise.
 *
 * Used in two places:
 * 1. Customer portal `portal/quotations/[id]/page.tsx` (read-only history).
 * 2. Admin dashboard `quotations/[id]/page.tsx` (replaces NegotiationHistory).
 */
export function QuotationVersionsView({
  versions,
  locale,
  defaultVersionId,
}: {
  versions: QuotationVersion[];
  locale: string;
  defaultVersionId?: string;
}) {
  const t = useTranslations();

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {tx("quotations.portal.versionsTitle", "Versions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {tx("quotations.portal.noVersions", "No versions yet.")}
        </CardContent>
      </Card>
    );
  }

  const sorted = [...versions].sort((a, b) => {
    // Live always last; otherwise by version asc.
    if (a.source === "LIVE") return 1;
    if (b.source === "LIVE") return -1;
    return (a.version ?? 0) - (b.version ?? 0);
  });

  const initial =
    defaultVersionId && sorted.some((v) => v.id === defaultVersionId)
      ? defaultVersionId
      : sorted[sorted.length - 1].id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {tx("quotations.portal.versionsTitle", "Versions")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={initial} className="w-full">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
            {sorted.map((v) => (
              <TabsTrigger
                key={v.id}
                value={v.id}
                className="gap-1.5 text-xs"
              >
                <SourceIcon source={v.source} />
                <VersionLabel version={v} tx={tx} />
              </TabsTrigger>
            ))}
          </TabsList>

          {sorted.map((v, idx) => {
            const prev = idx > 0 ? sorted[idx - 1] : null;
            return (
              <TabsContent key={v.id} value={v.id} className="mt-3 space-y-3">
                <VersionHeader version={v} locale={locale} tx={tx} />
                {prev ? (
                  <SideBySideTable
                    previous={prev}
                    current={v}
                    locale={locale}
                    tx={tx}
                  />
                ) : (
                  <SingleColumnTable
                    version={v}
                    locale={locale}
                    tx={tx}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SourceIcon({ source }: { source: QuotationVersion["source"] }) {
  if (source === "ADMIN")
    return <Building2 className="h-3 w-3 text-muted-foreground" />;
  if (source === "CUSTOMER")
    return <User2 className="h-3 w-3 text-muted-foreground" />;
  return <Activity className="h-3 w-3 text-muted-foreground" />;
}

function VersionLabel({
  version,
  tx,
}: {
  version: QuotationVersion;
  tx: (k: string, f: string) => string;
}) {
  if (version.source === "LIVE") {
    return <span>{tx("quotations.portal.liveCurrent", "Live")}</span>;
  }
  const sourceLabel =
    version.source === "ADMIN"
      ? tx("quotations.portal.sourceAdmin", "Vendor")
      : tx("quotations.portal.sourceCustomer", "Customer");
  return (
    <span>
      v{version.version} · {sourceLabel}
    </span>
  );
}

function VersionHeader({
  version,
  locale,
  tx,
}: {
  version: QuotationVersion;
  locale: string;
  tx: (k: string, f: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 font-medium">
          <SourceIcon source={version.source} />
          {version.source === "LIVE" ? (
            <span>
              {tx(
                "quotations.portal.liveCurrentLong",
                "Live (current working copy)",
              )}
            </span>
          ) : (
            <span>
              v{version.version} ·{" "}
              {version.source === "ADMIN"
                ? tx("quotations.portal.sourceAdminLong", "Sent by vendor")
                : tx(
                    "quotations.portal.sourceCustomerLong",
                    "Customer response",
                  )}
            </span>
          )}
          {version.authorName && (
            <span className="text-muted-foreground">
              · {version.authorName}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground" suppressHydrationWarning>
          {version.createdAt ? formatDateTime(version.createdAt, locale) : "—"}
        </div>
        {version.message && (
          <div className="mt-1 italic text-muted-foreground">
            “{version.message}”
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {tx("quotations.total", "Total")}
        </div>
        <div className="font-mono text-sm font-semibold">
          {formatCurrency(version.total, version.currency, locale)}
        </div>
      </div>
    </div>
  );
}

function SingleColumnTable({
  version,
  locale,
  tx,
}: {
  version: QuotationVersion;
  locale: string;
  tx: (k: string, f: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">
              {tx("quotations.lines.description", "Description")}
            </th>
            <th className="px-3 py-2 text-right w-20">
              {tx("quotations.lines.quantity", "Qty")}
            </th>
            <th className="px-3 py-2 text-right w-28">
              {tx("quotations.lines.unitPrice", "Unit price")}
            </th>
            <th className="px-3 py-2 text-right w-28">
              {tx("quotations.lines.lineTotal", "Total")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {version.lines.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2">
                <div>{l.description}</div>
                {l.customerNote && (
                  <div className="mt-1 italic text-[11px] text-muted-foreground">
                    “{l.customerNote}”
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono">{l.quantity}</td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(l.unitPrice, version.currency, locale)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(l.total, version.currency, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function effectiveValues(line: VersionLine): {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
} {
  // For a CUSTOMER snapshot, the customer's counter values live in the
  // proposed* fields. For ADMIN snapshots, the proposed* fields are usually
  // null and the canonical values are description/quantity/unitPrice.
  if (line.customerStatus === "MODIFIED") {
    const q = line.proposedQuantity ?? line.quantity;
    const p = line.proposedUnitPrice ?? line.unitPrice;
    return {
      description: line.proposedDescription ?? line.description,
      quantity: q,
      unitPrice: p,
      total: round2(q * p),
    };
  }
  return {
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function SideBySideTable({
  previous,
  current,
  locale,
  tx,
}: {
  previous: QuotationVersion;
  current: QuotationVersion;
  locale: string;
  tx: (k: string, f: string) => string;
}) {
  // Index previous lines by id so we can match them up. Lines are usually 1:1
  // because the schema doesn't add/remove lines mid-negotiation.
  const prevById = new Map(previous.lines.map((l) => [l.id, l]));

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-2 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div className="border-r px-3 py-1.5 flex items-center gap-1">
          <SourceIcon source={previous.source} />
          {tx("quotations.portal.compareFrom", "From")}{" "}
          {previous.source === "LIVE"
            ? tx("quotations.portal.liveCurrent", "Live")
            : `v${previous.version}`}
        </div>
        <div className="px-3 py-1.5 flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          <SourceIcon source={current.source} />
          {tx("quotations.portal.compareTo", "To")}{" "}
          {current.source === "LIVE"
            ? tx("quotations.portal.liveCurrent", "Live")
            : `v${current.version}`}
        </div>
      </div>
      <ul className="divide-y">
        {current.lines.map((curRaw) => {
          const cur = effectiveValues(curRaw);
          const prevRaw = prevById.get(curRaw.id);
          const prev = prevRaw ? effectiveValues(prevRaw) : null;
          const descChanged = prev ? prev.description !== cur.description : true;
          const qtyDelta = prev ? cur.quantity - prev.quantity : 0;
          const priceDelta = prev ? cur.unitPrice - prev.unitPrice : 0;
          const totalDelta = prev ? cur.total - prev.total : 0;
          return (
            <li key={curRaw.id} className="grid grid-cols-2">
              <div className="border-r px-3 py-2 text-sm">
                {prev ? (
                  <LineCell
                    description={prev.description}
                    quantity={prev.quantity}
                    unitPrice={prev.unitPrice}
                    total={prev.total}
                    currency={previous.currency}
                    locale={locale}
                    note={prevRaw?.customerNote ?? null}
                  />
                ) : (
                  <div className="text-xs italic text-muted-foreground">
                    {tx("quotations.portal.newLine", "(new line)")}
                  </div>
                )}
              </div>
              <div className="px-3 py-2 text-sm">
                <LineCell
                  description={cur.description}
                  quantity={cur.quantity}
                  unitPrice={cur.unitPrice}
                  total={cur.total}
                  currency={current.currency}
                  locale={locale}
                  note={curRaw.customerNote ?? null}
                  highlight={{
                    desc: prev ? descChanged : false,
                    qty: prev ? qtyDelta !== 0 : false,
                    price: prev ? priceDelta !== 0 : false,
                  }}
                  delta={
                    prev
                      ? {
                          qty: qtyDelta,
                          price: priceDelta,
                          total: totalDelta,
                        }
                      : null
                  }
                  currencyForDelta={current.currency}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LineCell({
  description,
  quantity,
  unitPrice,
  total,
  currency,
  locale,
  note,
  highlight,
  delta,
  currencyForDelta,
}: {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  locale: string;
  note: string | null;
  highlight?: { desc: boolean; qty: boolean; price: boolean };
  delta?: {
    qty: number;
    price: number;
    total: number;
  } | null;
  currencyForDelta?: string;
}) {
  return (
    <div className="space-y-1">
      <div
        className={
          highlight?.desc
            ? "rounded bg-amber-100/70 px-1 py-0.5 font-medium dark:bg-amber-900/30"
            : "font-medium"
        }
      >
        {description}
      </div>
      <div className="flex flex-wrap items-baseline gap-2 font-mono text-xs">
        <span
          className={
            highlight?.qty
              ? "rounded bg-amber-100/70 px-1 dark:bg-amber-900/30"
              : ""
          }
        >
          {quantity}
        </span>
        <span className="text-muted-foreground">×</span>
        <span
          className={
            highlight?.price
              ? "rounded bg-amber-100/70 px-1 dark:bg-amber-900/30"
              : ""
          }
        >
          {formatCurrency(unitPrice, currency, locale)}
        </span>
        <span className="text-muted-foreground">=</span>
        <span className="font-semibold">
          {formatCurrency(total, currency, locale)}
        </span>
      </div>
      {delta && (delta.qty !== 0 || delta.price !== 0 || delta.total !== 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {delta.qty !== 0 && (
            <DeltaPill value={delta.qty} suffix="" locale={locale} />
          )}
          {delta.price !== 0 && (
            <DeltaPill
              value={delta.price}
              suffix=""
              currency={currencyForDelta}
              locale={locale}
            />
          )}
          {delta.total !== 0 && (
            <DeltaPill
              value={delta.total}
              prefix="Δ "
              currency={currencyForDelta}
              locale={locale}
              strong
            />
          )}
        </div>
      )}
      {note && (
        <div className="italic text-[11px] text-muted-foreground">
          “{note}”
        </div>
      )}
    </div>
  );
}

function DeltaPill({
  value,
  prefix = "",
  suffix = "",
  currency,
  locale,
  strong,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  currency?: string;
  locale: string;
  strong?: boolean;
}) {
  const positive = value > 0;
  const cls = positive
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  const Icon = positive ? TrendingUp : TrendingDown;
  const text = currency
    ? formatCurrency(Math.abs(value), currency, locale)
    : Math.abs(value).toString();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${cls} ${strong ? "font-semibold" : ""}`}
    >
      <Icon className="h-3 w-3" />
      {prefix}
      {positive ? "+" : "−"}
      {text}
      {suffix}
    </span>
  );
}
