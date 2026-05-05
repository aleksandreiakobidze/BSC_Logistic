import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Package, Truck, Receipt, FileSignature, ArrowRight } from "lucide-react";

export default async function PortalDashboardPage({
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

  const orderIds = await prisma.order
    .findMany({ where: { customerId }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  const [
    activeOrderCount,
    activeShipmentCount,
    outstandingAgg,
    openQuotationCount,
    recentOrders,
    upcomingInvoices,
    activeShipments,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        customerId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.shipment.count({
      where: {
        orderLinks: {
          some: {
            orderId: { in: orderIds.length ? orderIds : ["__none__"] },
          },
        },
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
      },
    }),
    prisma.invoice.aggregate({
      where: {
        customerId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      },
      _sum: { total: true, paid: true },
    }),
    prisma.quotation.count({
      where: {
        customerId,
        status: { in: ["SENT", "COUNTERED"] },
      },
    }),
    prisma.order.findMany({
      where: { customerId },
      include: { shipmentLinks: { include: { shipment: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        customerId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.shipment.findMany({
      where: {
        orderLinks: {
          some: {
            orderId: { in: orderIds.length ? orderIds : ["__none__"] },
          },
        },
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const outstandingBalance = Math.max(
    0,
    Number(outstandingAgg._sum.total ?? 0) -
      Number(outstandingAgg._sum.paid ?? 0),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("portal.dash.title")}
        description={
          session.user.name
            ? `${t("dashboard.welcome", { name: session.user.name })}`
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("portal.dash.activeOrders")}
          value={activeOrderCount.toString()}
          icon={Package}
          accent="primary"
        />
        <StatCard
          label={t("portal.dash.activeShipments")}
          value={activeShipmentCount.toString()}
          icon={Truck}
          accent="warning"
        />
        <StatCard
          label={t("portal.dash.outstandingBalance")}
          value={formatCurrency(outstandingBalance, "USD", locale)}
          icon={Receipt}
          accent={outstandingBalance > 0 ? "danger" : "success"}
        />
        <StatCard
          label={t("portal.dash.openQuotations")}
          value={openQuotationCount.toString()}
          icon={FileSignature}
          accent="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("portal.dash.recentOrders")}
            </CardTitle>
            <Link
              href={`/${locale}/portal/orders`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t("portal.dash.viewAll")}{" "}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <EmptyState
                title={t("portal.dash.noOrders")}
                icon={Package}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("shipments.title")}</TableHead>
                    <TableHead className="text-right">
                      {t("orders.price")}
                    </TableHead>
                    <TableHead>{t("common.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/portal/orders/${o.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {o.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} kind="order" />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {o.shipmentLinks.map((l) => (
                            <Link
                              key={l.shipment.id}
                              href={`/${locale}/portal/track/${l.shipment.trackingCode}`}
                              className="rounded-full border px-2 py-0.5 text-xs font-mono hover:bg-accent"
                            >
                              {l.shipment.trackingCode}
                            </Link>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {o.price
                          ? formatCurrency(Number(o.price), o.currency, locale)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(o.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {t("portal.dash.upcomingInvoices")}
            </CardTitle>
            <Link
              href={`/${locale}/portal/invoices`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t("portal.dash.viewAll")}{" "}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingInvoices.length === 0 ? (
              <EmptyState
                title={t("portal.dash.noInvoices")}
                icon={Receipt}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("invoices.dueDate")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.total")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/portal/invoices/${inv.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.dueDate, locale)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} kind="invoice" />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(inv.total), inv.currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Active Shipments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t("portal.dash.activeShipmentsList")}
            </CardTitle>
            <Link
              href={`/${locale}/portal/shipments`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t("portal.dash.viewAll")}{" "}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {activeShipments.length === 0 ? (
              <EmptyState
                title={t("portal.dash.noShipments")}
                icon={Truck}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("shipments.tracking")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeShipments.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/portal/track/${s.trackingCode}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {s.trackingCode}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} kind="shipment" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(s.updatedAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
