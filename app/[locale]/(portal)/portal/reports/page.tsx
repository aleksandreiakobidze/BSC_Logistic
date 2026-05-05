import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  Package,
  Truck,
  Receipt,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { PortalReportsCharts } from "./reports-charts";

export default async function PortalReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();
  const customerId = session.user.customerId!;

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const orderIds = await prisma.order
    .findMany({ where: { customerId }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  const [
    orders,
    invoices,
    shipments,
    payments,
    monthlyOrders,
    monthlyInvoices,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      select: { id: true, status: true, price: true, currency: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        total: true,
        paid: true,
        dueDate: true,
        issueDate: true,
        currency: true,
      },
    }),
    prisma.shipment.findMany({
      where: {
        orderLinks: {
          some: { orderId: { in: orderIds.length ? orderIds : ["__none__"] } },
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        plannedEnd: true,
      },
    }),
    prisma.payment.findMany({
      where: { customerId },
      select: { amount: true, paidAt: true, currency: true },
    }),
    prisma.order.findMany({
      where: { customerId, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, price: true },
    }),
    prisma.invoice.findMany({
      where: { customerId, issueDate: { gte: twelveMonthsAgo } },
      select: { issueDate: true, total: true, paid: true, status: true, dueDate: true },
    }),
  ]);

  const totalSpend = orders.reduce((s, o) => s + Number(o.price ?? 0), 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

  const totalShipments = shipments.length;
  const deliveredShipments = shipments.filter((s) => s.status === "DELIVERED");
  const onTimeDeliveries = deliveredShipments.filter((s) => {
    if (!s.completedAt || !s.plannedEnd) return true;
    return s.completedAt <= s.plannedEnd;
  });
  const onTimeRate =
    deliveredShipments.length > 0
      ? (onTimeDeliveries.length / deliveredShipments.length) * 100
      : 100;

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid ?? 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
  for (const inv of invoices) {
    const balance = Math.max(0, Number(inv.total) - Number(inv.paid));
    if (balance <= 0) continue;
    if (!["SENT", "PARTIAL", "OVERDUE"].includes(inv.status)) continue;
    const ageDays = Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000);
    if (ageDays <= 0) aging.current += balance;
    else if (ageDays <= 30) aging.d30 += balance;
    else if (ageDays <= 60) aging.d60 += balance;
    else if (ageDays <= 90) aging.d90 += balance;
    else aging.d90plus += balance;
  }

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const spendByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const o of monthlyOrders) {
    const key = o.createdAt.toISOString().slice(0, 7);
    if (spendByMonth.has(key))
      spendByMonth.set(key, (spendByMonth.get(key) ?? 0) + Number(o.price ?? 0));
  }
  const spendChartData = months.map((m) => ({
    month: m.slice(5),
    amount: Math.round(spendByMonth.get(m) ?? 0),
  }));

  const shipmentsByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const s of shipments) {
    const key = s.createdAt.toISOString().slice(0, 7);
    if (shipmentsByMonth.has(key))
      shipmentsByMonth.set(key, (shipmentsByMonth.get(key) ?? 0) + 1);
  }
  const shipmentChartData = months.map((m) => ({
    month: m.slice(5),
    count: shipmentsByMonth.get(m) ?? 0,
  }));

  const statusCounts: Record<string, number> = {};
  for (const s of shipments) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }
  const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  const invoicedByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  const paidByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const inv of monthlyInvoices) {
    const key = inv.issueDate.toISOString().slice(0, 7);
    if (invoicedByMonth.has(key))
      invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + Number(inv.total));
  }
  for (const p of payments) {
    const key = p.paidAt.toISOString().slice(0, 7);
    if (paidByMonth.has(key))
      paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + Number(p.amount));
  }
  const paymentChartData = months.map((m) => ({
    month: m.slice(5),
    invoiced: Math.round(invoicedByMonth.get(m) ?? 0),
    paid: Math.round(paidByMonth.get(m) ?? 0),
  }));

  const spendSpark = months.map((m) => spendByMonth.get(m) ?? 0);
  const shipmentSpark = months.map((m) => shipmentsByMonth.get(m) ?? 0);

  const fmt = (n: number) => formatCurrency(n, "USD", locale);

  return (
    <div className="space-y-6">
      <PageHeader title={t("portal.reports.title")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t("portal.reports.totalSpend")}
          value={fmt(totalSpend)}
          icon={DollarSign}
          accent="primary"
          spark={spendSpark}
        />
        <StatCard
          label={t("portal.reports.orderCount")}
          value={orderCount.toString()}
          icon={Package}
          accent="primary"
          hint={`${t("portal.reports.avgOrder")}: ${fmt(avgOrderValue)}`}
        />
        <StatCard
          label={t("portal.reports.outstandingBalance")}
          value={fmt(outstandingBalance)}
          icon={Receipt}
          accent={outstandingBalance > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t("portal.reports.totalShipments")}
          value={totalShipments.toString()}
          icon={Truck}
          accent="primary"
          spark={shipmentSpark}
        />
        <StatCard
          label={t("portal.reports.onTimeRate")}
          value={`${onTimeRate.toFixed(1)}%`}
          icon={CheckCircle2}
          accent={onTimeRate >= 90 ? "success" : onTimeRate >= 75 ? "warning" : "danger"}
        />
        <StatCard
          label={t("portal.reports.totalInvoiced")}
          value={fmt(totalInvoiced)}
          icon={Receipt}
          accent="primary"
          hint={`${t("portal.reports.totalPaid")}: ${fmt(totalPaid)}`}
        />
      </div>

      <PortalReportsCharts
        spendData={spendChartData}
        shipmentData={shipmentChartData}
        statusData={statusChartData}
        paymentData={paymentChartData}
        aging={aging}
        locale={locale}
      />
    </div>
  );
}
