import Link from "next/link";
import { redirect, notFound } from "next/navigation";
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
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, FileDown, Package, Truck, Receipt } from "lucide-react";

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();

  const orderRaw = await prisma.order.findFirst({
    where: { id, customerId: session.user.customerId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      shipmentLinks: {
        orderBy: { createdAt: "asc" },
        include: {
          shipment: {
            include: { stops: { orderBy: { sequence: "asc" } } },
          },
        },
      },
      invoices: true,
    },
  });

  if (!orderRaw) return notFound();
  const order = {
    ...orderRaw,
    shipments: orderRaw.shipmentLinks.map((l) => l.shipment),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={`/${locale}/portal/orders`}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("portal.orders.title")}
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{order.number}</span>
            <StatusBadge status={order.status} kind="order" />
          </span>
        }
        description={
          order.price
            ? formatCurrency(Number(order.price), order.currency, locale)
            : undefined
        }
      />

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t("portal.orders.orderLines")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {order.lines.length === 0 ? (
            <EmptyState title={t("common.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.description")}</TableHead>
                  <TableHead className="text-right">{t("invoices.quantity")}</TableHead>
                  <TableHead className="text-right">{t("invoices.unitPrice")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(line.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(line.unitPrice), order.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(line.total), order.currency, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shipments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {t("portal.orders.orderShipments")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {order.shipments.length === 0 ? (
            <EmptyState title={t("common.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("shipments.tracking")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("portal.orders.route")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.shipments.map((s) => {
                  const first = s.stops[0];
                  const last = s.stops[s.stops.length - 1];
                  const route =
                    first && last
                      ? `${first.city ?? first.address} → ${last.city ?? last.address}`
                      : "—";
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/portal/shipments/${s.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {s.trackingCode}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} kind="shipment" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {route}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t("portal.orders.orderInvoices")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {order.invoices.length === 0 ? (
            <EmptyState title={t("common.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.number")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("invoices.dueDate")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/${locale}/portal/invoices/${inv.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} kind="invoice" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.dueDate, locale)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(inv.total), inv.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                        >
                          <FileDown className="mr-1 h-3 w-3" />
                          PDF
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
