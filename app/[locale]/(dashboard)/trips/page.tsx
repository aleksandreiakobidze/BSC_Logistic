import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Route } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import { formatDate } from "@/lib/utils";
import { NewTripButton } from "./new-trip-button";
import { ShipmentStatus } from "@/lib/enums";

const STATUS_OPTIONS = Object.values(ShipmentStatus).map((s) => ({ label: s.replace("_", " "), value: s }));

export default async function TripsPage({
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

  const [trips, drivers, vehicles] = await Promise.all([
    prisma.trip.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(q ? {
          OR: [
            { number: { contains: q } },
            { driver: { firstName: { contains: q } } },
            { driver: { lastName: { contains: q } } },
            { vehicle: { plate: { contains: q } } },
          ],
        } : {}),
      },
      include: {
        driver: true,
        vehicle: true,
        _count: { select: { shipments: true, expenses: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.driver.findMany({
      where: { orgId, status: { in: ["AVAILABLE", "ON_DUTY"] } },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.vehicle.findMany({
      where: { orgId, status: "ACTIVE" },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("trips.title")}
        description={t("trips.description")}
        actions={<NewTripButton drivers={drivers} vehicles={vehicles} />}
      />

      <ListFilters
        searchPlaceholder="Search trip number, driver, plate…"
        filters={[
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
        ]}
      />

      {trips.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No trips yet"
          description="Create a trip to group multiple shipments under one driver and vehicle."
          action={<NewTripButton drivers={drivers} vehicles={vehicles} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("drivers.title")}</TableHead>
                  <TableHead>{t("fleet.vehicles")}</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead className="text-right">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">
                      <Link href={`/trips/${tr.id}`} className="hover:underline">{tr.number}</Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="shipment" status={tr.status} />
                    </TableCell>
                    <TableCell>{tr.driver ? `${tr.driver.firstName} ${tr.driver.lastName}` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{tr.vehicle?.plate ?? "—"}</TableCell>
                    <TableCell>{tr._count.shipments}</TableCell>
                    <TableCell>{tr._count.expenses}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tr.plannedStart ? formatDate(tr.plannedStart, locale) : "—"}
                      {tr.plannedEnd ? ` → ${formatDate(tr.plannedEnd, locale)}` : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(tr.createdAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
