import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatDate } from "@/lib/utils";
import { Truck } from "lucide-react";

const STATUSES = [
  "PLANNED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

export default async function PortalShipmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();
  const statusFilter = typeof sp.status === "string" ? sp.status : "";

  const orderIds = await prisma.order
    .findMany({
      where: { customerId: session.user.customerId! },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const shipments = await prisma.shipment.findMany({
    where: {
      orderLinks: {
        some: { orderId: { in: orderIds.length ? orderIds : ["__none__"] } },
      },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      orderLinks: {
        where: { orderId: { in: orderIds.length ? orderIds : ["__none__"] } },
        orderBy: { sortOrder: "asc" },
        include: { order: { select: { number: true } } },
      },
      stops: { orderBy: { sequence: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("portal.shipments.title")} />

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`/${locale}/portal/shipments`}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !statusFilter
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
        >
          {t("portal.shipments.allStatuses")}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/portal/shipments?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {s.replace(/_/g, " ").toLowerCase()}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {shipments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={t("portal.shipments.empty")}
              description={t("portal.shipments.emptyDesc")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("shipments.tracking")}</TableHead>
                  <TableHead>{t("orders.number")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("portal.orders.route")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => {
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
                          href={`/${locale}/portal/track/${s.trackingCode}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {s.trackingCode}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {s.orderLinks.length === 0
                          ? "—"
                          : s.orderLinks.length === 1
                          ? s.orderLinks[0].order.number
                          : `${s.orderLinks[0].order.number} +${s.orderLinks.length - 1}`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} kind="shipment" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {route}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(s.updatedAt, locale)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
