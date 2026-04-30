import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, DollarSign, Truck, Users, AlertCircle } from "lucide-react";
import { ExportButton } from "@/components/app/export-button";
import {
  RevenueWidget,
  ShipmentsWidget,
  LeadsWidget,
  ExpensesWidget,
  CashFlowWidget,
  MethodMixWidget,
} from "./reports-charts";
import { ReportTables } from "./reports-tables";
import type { InvoiceRow, OrderRow, LeadRow } from "./reports-tables";
import { ARSection } from "./ar-section";
import { refreshOverdueInvoices } from "@/lib/payments";
import { InvoiceStatus, PaymentKind } from "@/lib/enums";
import { ProfitabilityTables, type PnLRow, type PnLTotals } from "./profitability-tables";
import {
  getOrderProfitability,
  getTripProfitability,
  getCustomerProfitability,
  getVehicleProfitability,
  getDriverProfitability,
} from "@/lib/profitability";
import { cn } from "@/lib/utils";
import { resolveRange, bucketKeys, bucketKeyOf, type RangePreset } from "./range";
import { DateRangeToolbar } from "./date-range-toolbar";
import { Sparkline } from "./sparkline";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  icon,
  accent,
  spotlight,
  spark,
  sparkColor,
  delay = 0,
}: {
  title: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon: React.ReactNode;
  accent: string;
  /** Tailwind color used for the radial spotlight, e.g. `from-primary/30`. */
  spotlight: string;
  spark?: number[];
  sparkColor?: string;
  delay?: number;
}) {
  const isPositive = (delta ?? 0) >= 0;
  const hasData = delta !== undefined && deltaLabel;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm",
        "ring-1 ring-border/60 transition-all hover:shadow-md hover:ring-border",
        "motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-radial blur-2xl opacity-60",
          spotlight,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground truncate">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground leading-none">
            {value}
          </p>
          {hasData && (
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                delta === 0
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-500"
                    : "text-red-500",
              )}
            >
              {delta === 0 ? (
                <Minus className="h-3 w-3" />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {delta > 0 ? "+" : ""}
                {delta!.toFixed(1)}% {deltaLabel}
              </span>
            </div>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accent)}>
          {icon}
        </div>
      </div>
      {spark && spark.length > 1 && (
        <div className="relative mt-4 -mx-1 opacity-90">
          <Sparkline
            data={spark}
            color={sparkColor ?? "currentColor"}
            width={220}
            height={36}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  await refreshOverdueInvoices(orgId);

  // ── Date range ──
  const range = resolveRange({
    range: typeof sp.range === "string" ? sp.range : undefined,
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
  });

  const inRangeIssue = { gte: range.from, lte: range.to };
  const inRangeCreated = { gte: range.from, lte: range.to };
  const inRangePrev = { gte: range.prevFrom, lte: range.prevTo };

  // Bucket keys for cash flow chart and KPI sparklines (last 12 monthly buckets).
  const cashFlowKeys = bucketKeys(range.from, range.to, range.bucket);
  const sparklineFrom = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 11,
    1,
  );
  const sparklineKeys = bucketKeys(sparklineFrom, new Date(), "month");

  // ── All queries in parallel ──
  const [
    revenueByMonthRaw,
    shipmentsByStatus,
    leadsByStatus,
    expensesByCategory,
    revenueAgg,
    revenuePrevAgg,
    activeShipmentsCount,
    shipmentsPrevCount,
    pipelineValueAgg,
    pipelinePrevAgg,
    outstandingAgg,
    recentInvoicesRaw,
    recentOrdersRaw,
    recentLeadsRaw,
    revenueSparkRaw,
    leadsSparkRaw,
    shipmentsSparkRaw,
  ] = await Promise.all([
    (async () => {
      const invoices = await prisma.invoice.findMany({
        where: { orgId, status: { in: ["PAID", "SENT"] }, issueDate: inRangeIssue },
        select: { issueDate: true, total: true },
      });
      const byKey = new Map<string, number>();
      for (const inv of invoices) {
        const key = bucketKeyOf(inv.issueDate, range.bucket);
        byKey.set(key, (byKey.get(key) ?? 0) + Number(inv.total));
      }
      return cashFlowKeys.map((key) => ({
        month: key.length > 7 ? key.slice(5) : key.slice(5),
        total: Math.round(byKey.get(key) ?? 0),
      }));
    })(),

    prisma.shipment.groupBy({
      by: ["status"],
      where: { orgId, createdAt: inRangeCreated },
      _count: { _all: true },
    }),

    prisma.lead.groupBy({
      by: ["status"],
      where: { orgId, createdAt: inRangeCreated },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),

    prisma.expense.groupBy({
      by: ["category"],
      where: { orgId, incurredAt: inRangeCreated },
      _sum: { amount: true },
    }),

    prisma.invoice.aggregate({
      where: { orgId, issueDate: inRangeIssue, status: { in: ["PAID", "SENT"] } },
      _sum: { total: true },
    }),

    prisma.invoice.aggregate({
      where: {
        orgId,
        issueDate: inRangePrev,
        status: { in: ["PAID", "SENT"] },
      },
      _sum: { total: true },
    }),

    prisma.shipment.count({
      where: {
        orgId,
        createdAt: inRangeCreated,
        status: { in: ["PLANNED", "IN_TRANSIT", "LOADING", "IN_CUSTOMS"] },
      },
    }),

    prisma.shipment.count({
      where: {
        orgId,
        createdAt: inRangePrev,
        status: { in: ["PLANNED", "IN_TRANSIT", "LOADING", "IN_CUSTOMS"] },
      },
    }),

    prisma.lead.aggregate({
      where: {
        orgId,
        createdAt: inRangeCreated,
        status: { notIn: ["WON", "LOST"] },
      },
      _sum: { estimatedValue: true },
    }),

    prisma.lead.aggregate({
      where: {
        orgId,
        createdAt: inRangePrev,
        status: { notIn: ["WON", "LOST"] },
      },
      _sum: { estimatedValue: true },
    }),

    // Outstanding is an as-of-now snapshot, scoped to invoices issued in range.
    prisma.invoice.aggregate({
      where: {
        orgId,
        issueDate: inRangeIssue,
        status: { in: ["SENT", "OVERDUE", InvoiceStatus.PARTIAL] },
      },
      _sum: { total: true, paid: true },
    }),

    prisma.invoice.findMany({
      where: { orgId, issueDate: inRangeIssue },
      orderBy: { issueDate: "desc" },
      take: 500,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        paid: true,
        currency: true,
        customer: { select: { name: true } },
      },
    }),

    prisma.order.findMany({
      where: { orgId, createdAt: inRangeCreated },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        price: true,
        currency: true,
        customer: { select: { name: true } },
      },
    }),

    prisma.lead.findMany({
      where: { orgId, createdAt: inRangeCreated },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        company: true,
        status: true,
        source: true,
        estimatedValue: true,
        currency: true,
        createdAt: true,
        assignedTo: { select: { name: true } },
      },
    }),

    // Sparkline raw data: last 12 months, irrespective of selected range.
    prisma.invoice.findMany({
      where: {
        orgId,
        status: { in: ["PAID", "SENT"] },
        issueDate: { gte: sparklineFrom },
      },
      select: { issueDate: true, total: true },
    }),

    prisma.lead.findMany({
      where: { orgId, createdAt: { gte: sparklineFrom } },
      select: { createdAt: true },
    }),

    prisma.shipment.findMany({
      where: { orgId, createdAt: { gte: sparklineFrom } },
      select: { createdAt: true },
    }),
  ]);

  // ── Cash flow & method mix scoped to range ──
  const [paymentsRows, openInvoices] = await Promise.all([
    prisma.payment.findMany({
      where: { orgId, paidAt: { gte: range.from, lte: range.to } },
      select: { kind: true, method: true, amount: true, paidAt: true },
    }),
    prisma.invoice.findMany({
      where: {
        orgId,
        issueDate: inRangeIssue,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      select: {
        total: true,
        paid: true,
        dueDate: true,
        currency: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  const cashFlowMap = new Map<
    string,
    { collected: number; paidOut: number }
  >();
  for (const k of cashFlowKeys) {
    cashFlowMap.set(k, { collected: 0, paidOut: 0 });
  }
  const methodMixMap = new Map<string, number>();
  for (const p of paymentsRows) {
    const key = bucketKeyOf(p.paidAt, range.bucket);
    const slot = cashFlowMap.get(key);
    const amt = Number(p.amount);
    if (slot) {
      if (p.kind === PaymentKind.RECEIVABLE) slot.collected += amt;
      else slot.paidOut += amt;
    }
    if (p.kind === PaymentKind.RECEIVABLE) {
      methodMixMap.set(p.method, (methodMixMap.get(p.method) ?? 0) + amt);
    }
  }
  const cashFlowData = [...cashFlowMap.entries()].map(([key, v]) => ({
    month: key.length > 7 ? key.slice(5) : key.slice(5),
    collected: Math.round(v.collected),
    paidOut: Math.round(v.paidOut),
    net: Math.round(v.collected - v.paidOut),
  }));
  const methodMixData = [...methodMixMap.entries()].map(([method, amount]) => ({
    method,
    amount: Math.round(amount),
  }));

  const aging = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
  const customerOutstanding = new Map<string, { name: string; amount: number }>();
  for (const inv of openInvoices) {
    const balance = Math.max(0, Number(inv.total) - Number(inv.paid));
    if (balance <= 0) continue;
    const ageDays = Math.floor(
      (Date.now() - inv.dueDate.getTime()) / 86400000,
    );
    if (ageDays < 31) aging.b0_30 += balance;
    else if (ageDays < 61) aging.b31_60 += balance;
    else if (ageDays < 91) aging.b61_90 += balance;
    else aging.b90plus += balance;

    const cur = customerOutstanding.get(inv.customer.id) ?? {
      name: inv.customer.name,
      amount: 0,
    };
    cur.amount += balance;
    customerOutstanding.set(inv.customer.id, cur);
  }
  const topOutstanding = [...customerOutstanding.entries()]
    .map(([id, v]) => ({ id, name: v.name, amount: Math.round(v.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // ── KPI deltas vs previous equal-length window ──
  const thisRev = Number(revenueAgg._sum.total ?? 0);
  const prevRev = Number(revenuePrevAgg._sum.total ?? 0);
  const revDelta = prevRev > 0 ? ((thisRev - prevRev) / prevRev) * 100 : 0;

  const pipelineVal = Number(pipelineValueAgg._sum.estimatedValue ?? 0);
  const prevPipelineVal = Number(pipelinePrevAgg._sum.estimatedValue ?? 0);
  const pipelineDelta =
    prevPipelineVal > 0 ? ((pipelineVal - prevPipelineVal) / prevPipelineVal) * 100 : 0;

  const shipmentsDelta =
    shipmentsPrevCount > 0
      ? ((activeShipmentsCount - shipmentsPrevCount) / shipmentsPrevCount) * 100
      : 0;

  const outstandingTotal = Number(outstandingAgg._sum.total ?? 0);
  const outstandingPaid = Number(outstandingAgg._sum.paid ?? 0);
  const outstanding = outstandingTotal - outstandingPaid;

  // ── Sparkline series (last 12 months) ──
  const revenueSparkMap = new Map<string, number>(
    sparklineKeys.map((k) => [k, 0]),
  );
  for (const r of revenueSparkRaw) {
    const key = r.issueDate.toISOString().slice(0, 7);
    if (revenueSparkMap.has(key))
      revenueSparkMap.set(key, (revenueSparkMap.get(key) ?? 0) + Number(r.total));
  }
  const revenueSpark = sparklineKeys.map((k) => revenueSparkMap.get(k) ?? 0);

  const leadsSparkMap = new Map<string, number>(
    sparklineKeys.map((k) => [k, 0]),
  );
  for (const l of leadsSparkRaw) {
    const key = l.createdAt.toISOString().slice(0, 7);
    if (leadsSparkMap.has(key))
      leadsSparkMap.set(key, (leadsSparkMap.get(key) ?? 0) + 1);
  }
  const leadsSpark = sparklineKeys.map((k) => leadsSparkMap.get(k) ?? 0);

  const shipmentsSparkMap = new Map<string, number>(
    sparklineKeys.map((k) => [k, 0]),
  );
  for (const s of shipmentsSparkRaw) {
    const key = s.createdAt.toISOString().slice(0, 7);
    if (shipmentsSparkMap.has(key))
      shipmentsSparkMap.set(key, (shipmentsSparkMap.get(key) ?? 0) + 1);
  }
  const shipmentsSpark = sparklineKeys.map(
    (k) => shipmentsSparkMap.get(k) ?? 0,
  );

  // Outstanding sparkline: derive monthly-ish balance from open invoices
  // bucketed by issue month (proxy — full reconstruction would need history).
  const outstandingSparkMap = new Map<string, number>(
    sparklineKeys.map((k) => [k, 0]),
  );
  for (const inv of openInvoices) {
    const balance = Math.max(0, Number(inv.total) - Number(inv.paid));
    if (balance <= 0) continue;
    const key = inv.dueDate.toISOString().slice(0, 7);
    if (outstandingSparkMap.has(key))
      outstandingSparkMap.set(
        key,
        (outstandingSparkMap.get(key) ?? 0) + balance,
      );
  }
  const outstandingSpark = sparklineKeys.map(
    (k) => outstandingSparkMap.get(k) ?? 0,
  );

  // ── Chart data ──
  const shipmentsChartData = shipmentsByStatus.map((s) => ({
    status: s.status,
    count: s._count._all,
  }));

  const leadsChartData = leadsByStatus.map((l) => ({
    status: l.status,
    count: l._count._all,
    value: Math.round(Number(l._sum.estimatedValue ?? 0)),
  }));

  const expensesChartData = expensesByCategory.map((e) => ({
    category: e.category,
    amount: Math.round(Number(e._sum.amount ?? 0)),
  }));

  // ── Table data ──
  const fmt = (n: unknown, cur = "USD") => formatCurrency(Number(n ?? 0), cur, locale);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const invoiceRows: InvoiceRow[] = recentInvoicesRaw.map((i) => {
    const totalNum = Number(i.total);
    const paidNum = Number(i.paid);
    const balance = Math.max(0, Math.round((totalNum - paidNum) * 100) / 100);
    return {
      id: i.id,
      number: i.number,
      customerName: i.customer.name,
      status: i.status,
      issueDate: fmtDate(i.issueDate),
      dueDate: fmtDate(i.dueDate),
      total: fmt(i.total, i.currency),
      paid: fmt(i.paid, i.currency),
      balance: fmt(balance, i.currency),
      totalNumeric: totalNum,
      paidNumeric: paidNum,
      balanceNumeric: balance,
      currency: i.currency,
    };
  });

  const orderRows: OrderRow[] = recentOrdersRaw.map((o) => ({
    id: o.id,
    number: o.number,
    customerName: o.customer.name,
    status: o.status,
    createdAt: fmtDate(o.createdAt),
    price: fmt(o.price, o.currency),
    priceNumeric: Number(o.price ?? 0),
    currency: o.currency,
  }));

  const leadRows: LeadRow[] = recentLeadsRaw.map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company ?? "—",
    status: l.status,
    source: l.source ?? "—",
    estimatedValue: fmt(l.estimatedValue, l.currency),
    estimatedValueNumeric: Number(l.estimatedValue ?? 0),
    currency: l.currency,
    assignedTo: l.assignedTo?.name ?? "—",
    createdAt: fmtDate(l.createdAt),
  }));

  const presetLabel = t(`reports.presets.${range.preset}`);
  const vsPrev = t("reports.vsPrevPeriod");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        actions={<ExportButton entity="shipments" />}
      />

      {/* ── Date range toolbar (sticky) ── */}
      <DateRangeToolbar
        range={range.preset as RangePreset}
        dateFrom={typeof sp.dateFrom === "string" ? sp.dateFrom : null}
        dateTo={typeof sp.dateTo === "string" ? sp.dateTo : null}
        fromLabel={t("common.from")}
        toLabel={t("common.to")}
      />

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("reports.kpiRevenue")}
          value={fmt(thisRev)}
          delta={revDelta}
          deltaLabel={vsPrev}
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          accent="bg-primary/10"
          spotlight="from-primary/30 to-transparent bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.35),transparent_60%)]"
          spark={revenueSpark}
          sparkColor="hsl(var(--primary))"
          delay={0}
        />
        <KpiCard
          title={t("reports.kpiShipments")}
          value={activeShipmentsCount.toString()}
          delta={shipmentsDelta}
          deltaLabel={vsPrev}
          icon={<Truck className="h-5 w-5 text-blue-500" />}
          accent="bg-blue-500/10"
          spotlight="bg-[radial-gradient(circle_at_top_right,rgb(59_130_246/.32),transparent_60%)]"
          spark={shipmentsSpark}
          sparkColor="rgb(59 130 246)"
          delay={60}
        />
        <KpiCard
          title={t("reports.kpiPipeline")}
          value={fmt(pipelineVal)}
          delta={pipelineDelta}
          deltaLabel={vsPrev}
          icon={<Users className="h-5 w-5 text-violet-500" />}
          accent="bg-violet-500/10"
          spotlight="bg-[radial-gradient(circle_at_top_right,rgb(139_92_246/.32),transparent_60%)]"
          spark={leadsSpark}
          sparkColor="rgb(139 92 246)"
          delay={120}
        />
        <KpiCard
          title={t("reports.kpiOutstanding")}
          value={fmt(outstanding)}
          icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
          accent="bg-amber-500/10"
          spotlight="bg-[radial-gradient(circle_at_top_right,rgb(245_158_11/.32),transparent_60%)]"
          spark={outstandingSpark}
          sparkColor="rgb(245 158 11)"
          delay={180}
        />
      </div>

      {/* ── Charts: bento layout ── */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow={t("reports.dateRange")}
          title={t("reports.chartRevenue")}
          description={`${presetLabel} · ${fmtDate(range.from)} → ${fmtDate(range.to)}`}
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
              {presetLabel}
            </span>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div
            className="lg:col-span-2 xl:col-span-4 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "60ms" }}
          >
            <RevenueWidget
              data={revenueByMonthRaw}
              title={t("reports.chartRevenue")}
              description={t("reports.chartRevenueDesc")}
            />
          </div>
          <div
            className="xl:col-span-2 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "120ms" }}
          >
            <ShipmentsWidget
              data={shipmentsChartData}
              title={t("reports.chartShipments")}
              description={t("reports.chartShipmentsDesc")}
            />
          </div>
          <div
            className="xl:col-span-2 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "180ms" }}
          >
            <LeadsWidget
              data={leadsChartData}
              title={t("reports.chartLeads")}
              description={t("reports.chartLeadsDesc")}
            />
          </div>
          <div
            className="lg:col-span-2 xl:col-span-4 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "240ms" }}
          >
            <CashFlowWidget
              data={cashFlowData}
              title={t("reports.chartCashFlow")}
              description={t("reports.chartCashFlowDesc")}
            />
          </div>
          <div
            className="xl:col-span-2 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "300ms" }}
          >
            <MethodMixWidget
              data={methodMixData}
              title={t("reports.chartMethodMix")}
              description={t("reports.chartMethodMixDesc")}
            />
          </div>
          <div
            className="xl:col-span-2 motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "360ms" }}
          >
            <ExpensesWidget
              data={expensesChartData}
              title={t("reports.chartExpenses")}
              description={t("reports.chartExpensesDesc")}
            />
          </div>
        </div>
      </section>

      {/* ── AR aging & top outstanding customers ── */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow={t("reports.dateRange")}
          title={t("reports.arAging")}
          description={t("reports.arAgingDesc")}
        />
        <ARSection
          aging={aging}
          topOutstanding={topOutstanding}
          locale={locale}
        />
      </section>

      {/* ── Profitability ── */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow={t("reports.dateRange")}
          title="Profitability"
          description="Revenue minus direct + allocated costs across operational dimensions."
        />
        <ProfitabilitySection orgId={orgId} locale={locale} from={range.from} to={range.to} />
      </section>

      {/* ── Data Tables ── */}
      <ReportTables
        invoices={invoiceRows}
        orders={orderRows}
        leads={leadRows}
        locale={locale}
      />
    </div>
  );
}

async function ProfitabilitySection({
  orgId,
  locale,
  from,
  to,
}: {
  orgId: string;
  locale: string;
  from: Date;
  to: Date;
}) {
  const inRange = { gte: from, lte: to };

  const [orders, trips, customers, vehicles, drivers] = await Promise.all([
    prisma.order.findMany({
      where: { orgId, createdAt: inRange },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, number: true, currency: true, customer: { select: { name: true } } },
    }),
    prisma.trip.findMany({
      where: { orgId, createdAt: inRange },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, number: true },
    }),
    prisma.customer.findMany({
      where: { orgId, createdAt: inRange },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true },
    }),
    prisma.vehicle.findMany({
      where: { orgId, createdAt: inRange },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, plate: true },
    }),
    prisma.driver.findMany({
      where: { orgId, createdAt: inRange },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const fmtCur = (n: number, currency = "USD") => formatCurrency(n, currency, locale);

  const toRow = (
    id: string,
    label: string,
    sub: string | undefined,
    currency: string,
    p: { revenue: number; cost: number; margin: number; marginPct: number },
  ): PnLRow => ({
    id,
    label,
    sub,
    revenue: fmtCur(p.revenue, currency),
    cost: fmtCur(p.cost, currency),
    margin: fmtCur(p.margin, currency),
    marginPct: p.marginPct,
    marginNumeric: p.margin,
    revenueNumeric: p.revenue,
    costNumeric: p.cost,
    currency,
  });

  const [byOrder, byTrip, byCustomer, byVehicle, byDriver] = await Promise.all([
    Promise.all(
      orders.map(async (o) =>
        toRow(o.id, o.number, o.customer.name, o.currency, await getOrderProfitability(o.id)),
      ),
    ),
    Promise.all(
      trips.map(async (t) =>
        toRow(t.id, t.number, undefined, "USD", await getTripProfitability(t.id)),
      ),
    ),
    Promise.all(
      customers.map(async (c) =>
        toRow(c.id, c.name, undefined, "USD", await getCustomerProfitability(c.id)),
      ),
    ),
    Promise.all(
      vehicles.map(async (v) =>
        toRow(v.id, v.plate, undefined, "USD", await getVehicleProfitability(v.id)),
      ),
    ),
    Promise.all(
      drivers.map(async (d) =>
        toRow(
          d.id,
          `${d.firstName} ${d.lastName}`,
          undefined,
          "USD",
          await getDriverProfitability(d.id),
        ),
      ),
    ),
  ]);

  const byOrderF = byOrder.filter((r) => r.marginNumeric !== 0).slice(0, 30);
  const byTripF = byTrip.filter((r) => r.marginNumeric !== 0).slice(0, 30);
  const byCustomerF = byCustomer.filter((r) => r.marginNumeric !== 0).slice(0, 30);
  const byVehicleF = byVehicle.filter((r) => r.marginNumeric !== 0).slice(0, 30);
  const byDriverF = byDriver.filter((r) => r.marginNumeric !== 0).slice(0, 30);

  const buildTotals = (rows: PnLRow[]): PnLTotals => {
    const revenueNum = rows.reduce((acc, r) => acc + r.revenueNumeric, 0);
    const costNum = rows.reduce((acc, r) => acc + r.costNumeric, 0);
    const marginNum = rows.reduce((acc, r) => acc + r.marginNumeric, 0);
    const marginPct = revenueNum > 0 ? (marginNum / revenueNum) * 100 : 0;
    const cur = rows[0]?.currency ?? "USD";
    return {
      revenue: fmtCur(revenueNum, cur),
      cost: fmtCur(costNum, cur),
      margin: fmtCur(marginNum, cur),
      marginNumeric: marginNum,
      marginPct,
    };
  };

  return (
    <ProfitabilityTables
      byOrder={byOrderF}
      byTrip={byTripF}
      byCustomer={byCustomerF}
      byVehicle={byVehicleF}
      byDriver={byDriverF}
      totals={{
        order: buildTotals(byOrderF),
        trip: buildTotals(byTripF),
        customer: buildTotals(byCustomerF),
        vehicle: buildTotals(byVehicleF),
        driver: buildTotals(byDriverF),
      }}
    />
  );
}
