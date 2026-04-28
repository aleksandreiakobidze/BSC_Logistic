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

export default async function VehiclesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const vehicles = await prisma.vehicle.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("fleet.title")}
        actions={
          <>
            <ExportButton entity="vehicles" />
            <NewVehicleButton />
          </>
        }
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vehicles yet"
          description="Add vehicles to your fleet to start dispatching shipments."
          action={<NewVehicleButton />}
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
