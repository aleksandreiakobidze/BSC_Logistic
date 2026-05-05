import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDate } from "@/lib/utils";
import { ListFilters } from "@/components/app/list-filters";
import { ShipmentStatus } from "@/lib/enums";
import { NewShipmentButton } from "./new-shipment-button";

const STATUS_OPTIONS = Object.values(ShipmentStatus).map((s) => ({
  label: s.replace("_", " "),
  value: s,
}));

export default async function ShipmentsPage({
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

  const q = sp?.q?.trim() ?? "";
  const status = sp?.status ?? "";

  const [shipments, drivers, vehicles] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q } },
                { trackingCode: { contains: q } },
                {
                  orderLinks: {
                    some: {
                      order: {
                        OR: [
                          { number: { contains: q } },
                          { customer: { name: { contains: q } } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        orderLinks: {
          orderBy: { sortOrder: "asc" },
          include: {
            order: {
              select: { id: true, number: true, customer: { select: { name: true } } },
            },
          },
        },
        driver: true,
        vehicle: true,
        stops: { orderBy: { sequence: "asc" } },
      },
      take: 200,
    }),
    prisma.driver.findMany({
      where: { orgId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.vehicle.findMany({
      where: { orgId, status: "ACTIVE" },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, make: true, model: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("shipments.title")}
        actions={
          <NewShipmentButton
            drivers={drivers.map((d) => ({
              id: d.id,
              label: `${d.firstName} ${d.lastName}`,
            }))}
            vehicles={vehicles.map((v) => ({
              id: v.id,
              label: `${v.plate} · ${v.make ?? ""} ${v.model ?? ""}`,
            }))}
            locale={locale}
          />
        }
      />

      <ListFilters
        searchPlaceholder="Search number, tracking or customer…"
        filters={[
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
        ]}
      />

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Create a shipment or add an order to start dispatching."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>{t("orders.title")}</TableHead>
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
                  const customerNames = Array.from(
                    new Set(s.orderLinks.map((l) => l.order.customer.name)),
                  );
                  const orderNumbers = s.orderLinks.map((l) => l.order.number);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/shipments/${s.id}`}
                          className="hover:underline"
                        >
                          {s.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {customerNames.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : customerNames.length === 1 ? (
                          customerNames[0]
                        ) : (
                          <span title={customerNames.join(", ")}>
                            {customerNames[0]}
                            <Badge
                              variant="secondary"
                              className="ml-1 font-normal"
                            >
                              +{customerNames.length - 1}
                            </Badge>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {orderNumbers.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {orderNumbers[0]}
                            </span>
                            {orderNumbers.length > 1 && (
                              <Badge
                                variant="secondary"
                                className="font-normal"
                                title={orderNumbers.join(", ")}
                              >
                                +{orderNumbers.length - 1}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {pickup?.city ?? pickup?.address ?? "—"} →{" "}
                        {dropoff?.city ?? dropoff?.address ?? "—"}
                      </TableCell>
                      <TableCell>
                        {s.driver
                          ? `${s.driver.firstName} ${s.driver.lastName}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.vehicle?.plate ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.trackingCode}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind="shipment"
                          status={s.status}
                          label={t(`shipments.status.${s.status}`)}
                        />
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
