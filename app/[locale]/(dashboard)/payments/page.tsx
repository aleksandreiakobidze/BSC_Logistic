import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  CircleDollarSign,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ListFilters } from "@/components/app/list-filters";
import { ExportButton } from "@/components/app/export-button";
import { EmptyState } from "@/components/app/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { refreshOverdueInvoices } from "@/lib/payments";
import { InvoiceStatus, PaymentKind, PaymentMethod } from "@/lib/enums";
import { PaymentRowActions } from "./payment-row-actions";
import { PaymentTabs } from "./payment-tabs";

const TABS = ["all", "received", "paidOut", "drivers"] as const;
type TabKey = (typeof TABS)[number];

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  await refreshOverdueInvoices(orgId);

  const tab = (TABS.includes(sp?.tab as TabKey) ? (sp?.tab as TabKey) : "all");

  const q = sp?.q?.trim() ?? "";
  const method = sp?.method ?? "";
  const customerId = sp?.customerId ?? "";
  const driverId = sp?.driverId ?? "";
  const dateFrom = sp?.dateFrom ?? "";
  const dateTo = sp?.dateTo ?? "";

  const where: Prisma.PaymentWhereInput = { orgId };
  if (tab === "received") where.kind = PaymentKind.RECEIVABLE;
  if (tab === "paidOut") where.kind = PaymentKind.SETTLEMENT_PAYOUT;
  if (tab === "drivers") where.kind = PaymentKind.SETTLEMENT_PAYOUT;
  if (method) where.method = method;
  if (customerId) where.customerId = customerId;
  if (driverId) where.driverId = driverId;
  if (dateFrom || dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) range.lte = new Date(dateTo + "T23:59:59.999Z");
    where.paidAt = range;
  }
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { note: { contains: q } },
      { invoice: { number: { contains: q } } },
      { customer: { name: { contains: q } } },
      { driver: { firstName: { contains: q } } },
      { driver: { lastName: { contains: q } } },
    ];
  }

  const [payments, statCards, customers, drivers] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      include: {
        invoice: { select: { id: true, number: true, currency: true } },
        customer: { select: { id: true, name: true } },
        settlement: {
          select: {
            id: true,
            periodFrom: true,
            periodTo: true,
            net: true,
          },
        },
        driver: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { name: true, email: true } },
      },
      take: 200,
    }),
    fetchStatCards(orgId),
    prisma.customer.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.driver.findMany({
      where: { orgId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payments.title")}
        description={t("payments.description")}
        actions={<ExportButton entity="payments" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label={t("payments.statCards.collectedMonth")}
          value={formatCurrency(statCards.collectedMonth, "USD", locale)}
          tone="success"
        />
        <StatCard
          icon={<CircleDollarSign className="h-4 w-4 text-amber-500" />}
          label={t("payments.statCards.outstandingAR")}
          value={formatCurrency(statCards.outstandingAR, "USD", locale)}
          tone="warning"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
          label={t("payments.statCards.dueToDrivers")}
          value={formatCurrency(statCards.dueToDrivers, "USD", locale)}
          tone="danger"
        />
      </div>

      <PaymentTabs current={tab} />

      <ListFilters
        searchPlaceholder={t("payments.searchPlaceholder")}
        filters={[
          {
            key: "method",
            label: t("payments.method"),
            type: "select",
            options: Object.values(PaymentMethod).map((m) => ({
              label: t(`payments.methods.${m}`),
              value: m,
            })),
          },
          {
            key: "customerId",
            label: t("orders.customer"),
            type: "select",
            options: customers.map((c) => ({ label: c.name, value: c.id })),
          },
          {
            key: "driverId",
            label: t("drivers.title"),
            type: "select",
            options: drivers.map((d) => ({
              label: `${d.firstName} ${d.lastName}`,
              value: d.id,
            })),
          },
          { key: "dateFrom", label: t("common.from"), type: "date" },
          { key: "dateTo", label: t("common.to"), type: "date" },
        ]}
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("payments.emptyTitle")}
          description={t("payments.empty")}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("payments.paidAt")}</TableHead>
                  <TableHead>{t("payments.kind")}</TableHead>
                  <TableHead>{t("payments.partyOrInvoice")}</TableHead>
                  <TableHead>{t("payments.method")}</TableHead>
                  <TableHead>{t("payments.reference")}</TableHead>
                  <TableHead className="text-right">{t("payments.amount")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const isPayout = p.kind === PaymentKind.SETTLEMENT_PAYOUT;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {formatDateTime(p.paidAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isPayout ? "warning" : "success"}
                          className="text-[10px]"
                        >
                          {t(`payments.kinds.${p.kind}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {!isPayout ? (
                          <div className="flex flex-col">
                            {p.invoice && (
                              <Link
                                href={`/invoices/${p.invoice.id}`}
                                className="text-xs font-semibold hover:underline"
                              >
                                #{p.invoice.number}
                              </Link>
                            )}
                            {p.customer && (
                              <Link
                                href={`/customers/${p.customer.id}`}
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                {p.customer.name}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            {p.driver && (
                              <span className="text-xs font-semibold">
                                {p.driver.firstName} {p.driver.lastName}
                              </span>
                            )}
                            {p.settlement && (
                              <Link
                                href={`/drivers/settlements/${p.settlement.id}`}
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                {t("settlements.title")} #{p.settlement.id.slice(-6)}
                              </Link>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`payments.methods.${p.method}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.reference || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-mono text-sm font-semibold ${
                            isPayout
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isPayout ? "-" : "+"}
                          {formatCurrency(Number(p.amount), p.currency, locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <PaymentRowActions
                          paymentId={p.id}
                          kind={p.kind as "RECEIVABLE" | "SETTLEMENT_PAYOUT"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function fetchStatCards(orgId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [collected, outstanding, dueDrivers] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        orgId,
        kind: PaymentKind.RECEIVABLE,
        paidAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: {
        orgId,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      select: { total: true, paid: true },
    }),
    prisma.settlement.findMany({
      where: { orgId, paidAt: null },
      select: { net: true },
    }),
  ]);

  const outstandingAR = outstanding.reduce(
    (acc, i) => acc + Math.max(0, Number(i.total) - Number(i.paid)),
    0,
  );
  const dueToDrivers = dueDrivers.reduce((acc, s) => acc + Number(s.net), 0);

  return {
    collectedMonth: Number(collected._sum.amount ?? 0),
    outstandingAR: Math.round(outstandingAR * 100) / 100,
    dueToDrivers: Math.round(dueToDrivers * 100) / 100,
  };
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`font-mono text-2xl font-semibold ${toneClass}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export const dynamic = "force-dynamic";
