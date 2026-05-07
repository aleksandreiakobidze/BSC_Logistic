import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { NewVehicleButton } from "./new-vehicle-button";
import { ExportButton } from "@/components/app/export-button";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../../settings/custom-fields/actions";
import { ListFilters } from "@/components/app/list-filters";
import { VehicleStatus, VehicleType } from "@/lib/enums";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = Object.values(VehicleStatus).map((s) => ({ label: s, value: s }));
const TYPE_OPTIONS = Object.values(VehicleType).map((t) => ({ label: t, value: t }));

export default async function VehiclesPage({
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
  const type = sp?.type ?? "";

  const [vehicles, customFields] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(q ? {
          OR: [
            { plate: { contains: q } },
            { make: { contains: q } },
            { model: { contains: q } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.VEHICLE),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("fleet.title")}
        actions={
          <>
            <ExportButton entity="vehicles" />
            <NewVehicleButton customFields={customFields} />
          </>
        }
      />

      <ListFilters
        searchPlaceholder="Search plate, make, model…"
        filters={[
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
          { key: "type", label: "Type", type: "select", options: TYPE_OPTIONS },
        ]}
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vehicles yet"
          description="Add vehicles to your fleet to start dispatching shipments."
          action={<NewVehicleButton customFields={customFields} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fleet.plate")}</TableHead>
                  <TableHead>{t("fleet.type")}</TableHead>
                  <TableHead>{t("fleet.make")}</TableHead>
                  <TableHead>{t("fleet.model")}</TableHead>
                  <TableHead>{t("fleet.year")}</TableHead>
                  <TableHead>{t("fleet.capacity")}</TableHead>
                  <TableHead>{t("fleet.odometer")}</TableHead>
                  <TableHead>{t("fleet.status")}</TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    {t("common.created")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.plate}</TableCell>
                    <TableCell className="text-xs uppercase tracking-wider text-muted-foreground">
                      {v.type}
                    </TableCell>
                    <TableCell>{v.make ?? "—"}</TableCell>
                    <TableCell>{v.model ?? "—"}</TableCell>
                    <TableCell>{v.year ?? "—"}</TableCell>
                    <TableCell>{v.capacityKg ? `${v.capacityKg} kg` : "—"}</TableCell>
                    <TableCell>{v.odometerKm.toLocaleString()} km</TableCell>
                    <TableCell>
                      <StatusBadge kind="vehicle" status={v.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(v.createdAt, locale)}
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
