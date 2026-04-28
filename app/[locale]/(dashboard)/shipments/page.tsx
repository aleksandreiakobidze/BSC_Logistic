import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDate } from "@/lib/utils";

export default async function ShipmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const shipments = await prisma.shipment.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      order: { include: { customer: true } },
      driver: true,
      vehicle: true,
      stops: { orderBy: { sequence: "asc" } },
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("shipments.title")} />

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Create an order to automatically generate a shipment."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>Pickup → Dropoff</TableHead>
                  <TableHead>{t("drivers.title")}</TableHead>
                  <TableHead>{t("fleet.vehicles")}</TableHead>
                  <TableHead>{t("shipments.tracking")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => {
                  const pickup = s.stops[0];
                  const dropoff = s.stops[s.stops.length - 1];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link href={`/shipments/${s.id}`} className="hover:underline">{s.number}</Link>
                      </TableCell>
                      <TableCell>{s.order.customer.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {pickup?.city ?? pickup?.address ?? "—"} → {dropoff?.city ?? dropoff?.address ?? "—"}
                      </TableCell>
                      <TableCell>{s.driver ? `${s.driver.firstName} ${s.driver.lastName}` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.vehicle?.plate ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.trackingCode}</TableCell>
                      <TableCell>
                        <StatusBadge kind="shipment" status={s.status} label={t(`shipments.status.${s.status}`)} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(s.createdAt, locale)}
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
