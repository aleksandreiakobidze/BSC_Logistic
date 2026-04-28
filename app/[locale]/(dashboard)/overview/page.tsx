import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck, TrendingUp, DollarSign, Users, Package, FileText, AlertTriangle, Activity } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShipmentsChart } from "./shipments-chart";

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  const orgId = session?.user?.orgId;
  if (!orgId) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeShipments,
    deliveredThisMonth,
    totalShipmentsThisMonth,
    revenueMtd,
    openOrders,
    overdueInvoices,
    totalVehicles,
    activeVehicles,
    recentShipments,
    shipmentsByDay,
  ] = await Promise.all([
    prisma.shipment.count({
      where: { orgId, status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } },
    }),
    prisma.shipment.count({
      where: {
        orgId,
        status: "DELIVERED",
        completedAt: { gte: monthStart, lte: now },
      },
    }),
    prisma.shipment.count({
      where: { orgId, createdAt: { gte: monthStart } },
    }),
    prisma.invoice.aggregate({
      where: { orgId, issueDate: { gte: monthStart }, status: { in: ["PAID", "SENT"] } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { orgId, status: { in: ["QUOTE", "CONFIRMED", "IN_PROGRESS"] } } }),
    prisma.invoice.count({ where: { orgId, status: "OVERDUE" } }),
    prisma.vehicle.count({ where: { orgId } }),
    prisma.vehicle.count({ where: { orgId, status: "ACTIVE" } }),
    prisma.shipment.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        order: { include: { customer: true } },
        driver: true,
        vehicle: true,
      },
    }),
    (async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const rows = await prisma.shipment.findMany({
        where: { orgId, createdAt: { gte: since } },
        select: { createdAt: true },
      });
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const key = r.createdAt.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      return [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([day, count]) => ({ day, count }));
    })(),
  ]);

  const onTimeRate =
    totalShipmentsThisMonth > 0
      ? Math.round((deliveredThisMonth / totalShipmentsThisMonth) * 100)
      : 0;
  const fleetUtilization = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
  const revenue = Number(revenueMtd._sum.total ?? 0);

  const chartData = shipmentsByDay.map((r) => ({
    day: r.day.slice(5),
    count: r.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.welcome", { name: session?.user?.name ?? "" })}
        description={t("app.tagline")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t("dashboard.kpi.activeShipments")}
          value={activeShipments}
          icon={Truck}
          accent="primary"
        />
        <StatCard
          label={t("dashboard.kpi.onTimeRate")}
          value={`${onTimeRate}%`}
          icon={TrendingUp}
          accent="success"
          trend={{ delta: 2 }}
        />
        <StatCard
          label={t("dashboard.kpi.revenueMtd")}
          value={formatCurrency(revenue, "USD", locale)}
          icon={DollarSign}
          accent="success"
        />
        <StatCard
          label={t("dashboard.kpi.fleetUtilization")}
          value={`${fleetUtilization}%`}
          icon={Activity}
          accent="primary"
        />
        <StatCard
          label={t("dashboard.kpi.openOrders")}
          value={openOrders}
          icon={Package}
          accent="warning"
        />
        <StatCard
          label={t("dashboard.kpi.overdueInvoices")}
          value={overdueInvoices}
          icon={AlertTriangle}
          accent="destructive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Shipments (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <ShipmentsChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.fleetStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <FleetRow label="Active" value={activeVehicles} total={totalVehicles} color="bg-success" />
              <FleetRow
                label="Maintenance"
                value={totalVehicles - activeVehicles}
                total={totalVehicles}
                color="bg-warning"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.recentShipments")}</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/shipments">{t("dashboard.viewAll")}</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("orders.customer")}</TableHead>
                <TableHead>{t("shipments.tracking")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("drivers.title")}</TableHead>
                <TableHead className="text-right">{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentShipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.number}</TableCell>
                  <TableCell>{s.order.customer.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.trackingCode}</TableCell>
                  <TableCell>
                    <StatusBadge kind="shipment" status={s.status} label={t(`shipments.status.${s.status}`)} />
                  </TableCell>
                  <TableCell>
                    {s.driver ? `${s.driver.firstName} ${s.driver.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDate(s.createdAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
              {recentShipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {t("common.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FleetRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
