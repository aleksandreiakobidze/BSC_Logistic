import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Truck,
  TrendingUp,
  DollarSign,
  Activity,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
  MoreHorizontal,
  Filter,
  Map as MapIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { ShipmentsChart } from "./shipments-chart";
import { FleetDonut } from "./fleet-donut";
import { LiveShipmentsCanvas } from "./live-shipments-canvas";

function dateRange(daysBack: number) {
  const out: string[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function fillDailySeries(points: { day: string; count: number }[], daysBack: number) {
  const map = new Map(points.map((p) => [p.day, p.count]));
  return dateRange(daysBack).map((day) => ({ day, count: map.get(day) ?? 0 }));
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  const orgId = session?.user?.orgId;
  if (!orgId) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last7Start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const prev7Start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const last14Start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    activeShipments,
    activeShipmentsPrev7,
    activeShipmentsLast7,
    deliveredThisMonth,
    totalShipmentsThisMonth,
    deliveredPrevMonth,
    totalShipmentsPrevMonth,
    revenueMtd,
    revenuePrevMonth,
    openOrders,
    openOrdersPrev7,
    openOrdersLast7,
    overdueInvoices,
    overdueInvoicesLast7,
    totalVehicles,
    activeVehicles,
    maintenanceVehicles,
    inactiveVehicles,
    delayedShipments,
    recentShipments,
    shipmentsByDay,
    revenueByDay,
    topDriversRaw,
    inTransitShipments,
  ] = await Promise.all([
    prisma.shipment.count({
      where: { orgId, status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } },
    }),
    prisma.shipment.count({
      where: {
        orgId,
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
    prisma.shipment.count({
      where: {
        orgId,
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
        createdAt: { gte: last7Start },
      },
    }),
    prisma.shipment.count({
      where: {
        orgId,
        status: "DELIVERED",
        completedAt: { gte: monthStart, lte: now },
      },
    }),
    prisma.shipment.count({ where: { orgId, createdAt: { gte: monthStart } } }),
    prisma.shipment.count({
      where: {
        orgId,
        status: "DELIVERED",
        completedAt: { gte: prevMonthStart, lt: monthStart },
      },
    }),
    prisma.shipment.count({
      where: { orgId, createdAt: { gte: prevMonthStart, lt: monthStart } },
    }),
    prisma.invoice.aggregate({
      where: {
        orgId,
        issueDate: { gte: monthStart },
        status: { in: ["PAID", "SENT"] },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        orgId,
        issueDate: { gte: prevMonthStart, lt: monthStart },
        status: { in: ["PAID", "SENT"] },
      },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { orgId, status: { in: ["QUOTE", "CONFIRMED", "IN_PROGRESS"] } },
    }),
    prisma.order.count({
      where: {
        orgId,
        status: { in: ["QUOTE", "CONFIRMED", "IN_PROGRESS"] },
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
    prisma.order.count({
      where: {
        orgId,
        status: { in: ["QUOTE", "CONFIRMED", "IN_PROGRESS"] },
        createdAt: { gte: last7Start },
      },
    }),
    prisma.invoice.count({ where: { orgId, status: "OVERDUE" } }),
    prisma.invoice.count({
      where: { orgId, status: "OVERDUE", updatedAt: { gte: last7Start } },
    }),
    prisma.vehicle.count({ where: { orgId } }),
    prisma.vehicle.count({ where: { orgId, status: "ACTIVE" } }),
    prisma.vehicle.count({ where: { orgId, status: "MAINTENANCE" } }),
    prisma.vehicle.count({ where: { orgId, status: "INACTIVE" } }),
    prisma.shipment.count({
      where: {
        orgId,
        status: "IN_TRANSIT",
        plannedEnd: { lt: now },
      },
    }),
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
      const rows = await prisma.shipment.findMany({
        where: { orgId, createdAt: { gte: last14Start } },
        select: { createdAt: true },
      });
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const key = r.createdAt.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      const series = [...byDay.entries()].map(([day, count]) => ({ day, count }));
      return fillDailySeries(series, 14);
    })(),
    (async () => {
      const rows = await prisma.invoice.findMany({
        where: { orgId, issueDate: { gte: last14Start } },
        select: { issueDate: true, total: true },
      });
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const key = r.issueDate.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + Number(r.total));
      }
      const series = [...byDay.entries()].map(([day, count]) => ({ day, count }));
      return fillDailySeries(series, 14);
    })(),
    (async () => {
      const rows = await prisma.shipment.groupBy({
        by: ["driverId"],
        where: {
          orgId,
          driverId: { not: null },
          createdAt: { gte: monthStart },
        },
        _count: { _all: true },
        orderBy: { _count: { driverId: "desc" } },
        take: 4,
      });
      if (rows.length === 0) return [] as Array<{
        driver: { id: string; firstName: string; lastName: string };
        trips: number;
        delivered: number;
        otp: number;
      }>;
      const ids = rows.map((r) => r.driverId!).filter(Boolean) as string[];
      const drivers = await prisma.driver.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true },
      });
      const delivered = await prisma.shipment.groupBy({
        by: ["driverId"],
        where: {
          orgId,
          driverId: { in: ids },
          status: "DELIVERED",
          completedAt: { gte: monthStart },
        },
        _count: { _all: true },
      });
      const dMap = new Map(delivered.map((d) => [d.driverId!, d._count._all]));
      return rows
        .map((r) => {
          const driver = drivers.find((x) => x.id === r.driverId);
          if (!driver) return null;
          const trips = r._count._all;
          const dCount = dMap.get(r.driverId!) ?? 0;
          const otp = trips > 0 ? Math.round((dCount / trips) * 100) : 0;
          return { driver, trips, delivered: dCount, otp };
        })
        .filter(Boolean) as Array<{
          driver: { id: string; firstName: string; lastName: string };
          trips: number;
          delivered: number;
          otp: number;
        }>;
    })(),
    prisma.shipment.findMany({
      where: { orgId, status: { in: ["IN_TRANSIT", "PICKED_UP", "ASSIGNED"] } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, number: true, status: true },
    }),
  ]);

  const onTimeRate =
    totalShipmentsThisMonth > 0
      ? Math.round((deliveredThisMonth / totalShipmentsThisMonth) * 100)
      : 0;
  const onTimeRatePrev =
    totalShipmentsPrevMonth > 0
      ? Math.round((deliveredPrevMonth / totalShipmentsPrevMonth) * 100)
      : 0;
  const fleetUtilization =
    totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
  const revenue = Number(revenueMtd._sum.total ?? 0);
  const revenuePrev = Number(revenuePrevMonth._sum.total ?? 0);

  const sparkShipments = shipmentsByDay.map((p) => p.count);
  const sparkRevenue = revenueByDay.map((p) => p.count);
  const accent = ((p: number) => (p >= 80 ? "success" : p >= 50 ? "warning" : "danger")) as (
    p: number,
  ) => "success" | "warning" | "danger";

  const greeting = greetingFor(now);
  const username = (session.user.name ?? session.user.email ?? "").split(/[ @]/)[0] || "";

  const dateLabel = formatDate(now, locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const fleetSlices = [
    { label: "Active", count: activeVehicles, color: "hsl(var(--success))" },
    {
      label: "Maintenance",
      count: maintenanceVehicles,
      color: "hsl(var(--warning))",
    },
    {
      label: "Inactive",
      count: inactiveVehicles,
      color: "hsl(var(--text-dim))",
    },
  ];

  const chartData = shipmentsByDay.map((r) => ({
    day: r.day.slice(5),
    count: r.count,
  }));
  const periodTotal = shipmentsByDay.reduce((a, p) => a + p.count, 0);
  const periodTotalPrev = sparkShipments.slice(0, 7).reduce((a, n) => a + n, 0);
  const periodTotalNow = sparkShipments.slice(-7).reduce((a, n) => a + n, 0);
  const periodDelta = pctDelta(periodTotalNow, periodTotalPrev);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={dateLabel}
        title={
          username
            ? `${greeting}, ${username[0].toUpperCase() + username.slice(1)}`
            : greeting
        }
        description={
          <span>
            {delayedShipments > 0 ? (
              <>
                <span className="font-medium" style={{ color: "hsl(var(--warning))" }}>
                  {delayedShipments}
                </span>{" "}
                shipment{delayedShipments === 1 ? "" : "s"} need attention.{" "}
              </>
            ) : (
              <>{activeShipments} active shipment{activeShipments === 1 ? "" : "s"}. </>
            )}
            Fleet is operating{" "}
            <span
              className="font-medium"
              style={{
                color:
                  fleetUtilization >= 60
                    ? "hsl(var(--success))"
                    : "hsl(var(--warning))",
              }}
            >
              {fleetUtilization >= 60 ? "nominally" : "below capacity"}
            </span>
            .
          </span>
        }
        actions={
          <>
            <Link href="/reports" className="btn">
              <Filter className="h-3.5 w-3.5" />
              {t("nav.reports")}
            </Link>
            <Link href="/orders" className="btn btn-primary">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              {t("shipments.newShipment")}
            </Link>
          </>
        }
      />

      {delayedShipments > 0 && (
        <div
          className="card flex items-center gap-3 p-3"
          style={{
            borderColor: "hsl(var(--warning) / 0.4)",
            background: "hsl(var(--warning) / 0.1)",
          }}
        >
          <div
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            style={{ background: "hsl(var(--warning))", color: "white" }}
          >
            <AlertTriangle className="h-[13px] w-[13px]" strokeWidth={2.2} />
          </div>
          <div
            className="flex-1 text-[13px]"
            style={{ color: "hsl(var(--warning))" }}
          >
            <span className="font-medium">
              {delayedShipments} shipment{delayedShipments === 1 ? "" : "s"} delayed
            </span>{" "}
            <span className="opacity-80">— planned arrival has passed</span>
          </div>
          <Link
            href="/shipments?status=IN_TRANSIT"
            className="btn"
            style={{
              background: "transparent",
              borderColor: "transparent",
              color: "hsl(var(--warning))",
            }}
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t("dashboard.kpi.activeShipments")}
          value={activeShipments}
          icon={Truck}
          accent="primary"
          spark={sparkShipments}
          trend={{ delta: pctDelta(activeShipmentsLast7, activeShipmentsPrev7) }}
        />
        <StatCard
          label={t("dashboard.kpi.onTimeRate")}
          value={`${onTimeRate}%`}
          icon={TrendingUp}
          accent={accent(onTimeRate)}
          spark={sparkShipments}
          trend={{ delta: onTimeRate - onTimeRatePrev, suffix: "pp" }}
        />
        <StatCard
          label={t("dashboard.kpi.revenueMtd")}
          value={formatCurrency(revenue, "USD", locale)}
          icon={DollarSign}
          accent="success"
          spark={sparkRevenue}
          trend={{ delta: pctDelta(revenue, revenuePrev) }}
        />
        <StatCard
          label={t("dashboard.kpi.fleetUtilization")}
          value={`${fleetUtilization}%`}
          icon={Activity}
          accent={accent(fleetUtilization)}
        />
        <StatCard
          label={t("dashboard.kpi.openOrders")}
          value={openOrders}
          icon={Package}
          accent="warning"
          trend={{ delta: pctDelta(openOrdersLast7, openOrdersPrev7) }}
        />
        <StatCard
          label={t("dashboard.kpi.overdueInvoices")}
          value={overdueInvoices}
          icon={AlertTriangle}
          accent="danger"
          trend={{
            delta: overdueInvoicesLast7,
            suffix: "",
            label: "this week",
            deltaInvert: true,
          }}
        />
      </div>

      {/* Volume chart + Fleet donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-dim text-[11.5px] font-medium uppercase tracking-wider">
                Shipment volume
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="big-num text-[24px]">{periodTotal}</div>
                {Number.isFinite(periodDelta) && (
                  <span
                    className={`pill num ${periodDelta >= 0 ? "pill-success" : "pill-danger"}`}
                  >
                    {periodDelta >= 0 ? "↑" : "↓"} {Math.abs(periodDelta).toFixed(1)}%
                  </span>
                )}
                <span className="text-dim text-[12px]">last 14 days</span>
              </div>
            </div>
          </div>
          <ShipmentsChart data={chartData} />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-dim text-[11.5px] font-medium uppercase tracking-wider">
              Fleet status
            </div>
            <Link
              href="/fleet/vehicles"
              className="text-dim hover:text-app"
              aria-label="More"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <FleetDonut total={totalVehicles} slices={fleetSlices} />
            <div className="flex-1 space-y-2.5">
              {fleetSlices.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1 text-[12.5px]">{s.label}</span>
                  <span className="num text-[12.5px] font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="divider my-4" />
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-soft">Avg utilization</span>
            <span className="num font-medium">{fleetUtilization}%</span>
          </div>
        </div>
      </div>

      {/* Live shipments + Top drivers */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden p-0 lg:col-span-3">
          <div className="flex items-center justify-between border-b border-app p-4">
            <div>
              <div className="text-[14px] font-semibold">Live shipments</div>
              <div className="text-dim text-[12px]">
                {inTransitShipments.length} in transit · updated{" "}
                {formatDate(now, locale, { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="pill pill-success">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "hsl(var(--success))" }}
                />
                Live
              </span>
              <Link href="/tracking" className="btn">
                <MapIcon className="h-3.5 w-3.5" />
                Open map
              </Link>
            </div>
          </div>
          <LiveShipmentsCanvas shipments={inTransitShipments} />
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold">Top drivers</div>
              <div className="text-dim text-[12px]">
                By shipments completed this month
              </div>
            </div>
            <Link
              href="/drivers"
              className="text-dim hover:text-app"
              aria-label="More"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Link>
          </div>
          {topDriversRaw.length === 0 ? (
            <div className="text-soft py-8 text-center text-[12.5px]">
              No driver activity yet this month.
            </div>
          ) : (
            <div className="space-y-3">
              {topDriversRaw.map((d, i) => (
                <Link
                  key={d.driver.id}
                  href={`/drivers/${d.driver.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[hsl(var(--surface-2))]"
                >
                  <div className="text-dim w-4 font-mono text-[11px]">{i + 1}</div>
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                    style={{
                      background: "hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    {initials(`${d.driver.firstName} ${d.driver.lastName}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {d.driver.firstName} {d.driver.lastName}
                    </div>
                    <div className="text-dim flex items-center gap-2 text-[11px]">
                      <span className="num">{d.trips} trips</span>
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ background: "hsl(var(--text-dim))" }}
                      />
                      <span
                        className="num"
                        style={{ color: "hsl(var(--success))" }}
                      >
                        {d.otp}% OTP
                      </span>
                    </div>
                  </div>
                  <div className="num text-[12.5px] font-medium">
                    {d.delivered}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent shipments */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-app p-4">
          <div>
            <div className="text-[14px] font-semibold">
              {t("dashboard.recentShipments")}
            </div>
            <div className="text-dim text-[12px]">Most recently created</div>
          </div>
          <Link href="/shipments" className="btn">
            {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentShipments.length === 0 ? (
          <div className="text-soft py-12 text-center text-[12.5px]">
            {t("common.empty")}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("orders.customer")}</th>
                <th>{t("shipments.tracking")}</th>
                <th>{t("common.status")}</th>
                <th>{t("drivers.title")}</th>
                <th className="pr-4 text-right">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {recentShipments.map((s) => (
                <tr key={s.id}>
                  <td className="num font-medium">{s.number}</td>
                  <td>{s.order.customer.name}</td>
                  <td className="font-mono text-[11.5px] text-soft">
                    {s.trackingCode}
                  </td>
                  <td>
                    <StatusBadge
                      kind="shipment"
                      status={s.status}
                      label={t(`shipments.status.${s.status}`)}
                    />
                  </td>
                  <td>
                    {s.driver
                      ? `${s.driver.firstName} ${s.driver.lastName}`
                      : "—"}
                  </td>
                  <td className="num pr-4 text-right text-soft">
                    {formatDate(s.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
