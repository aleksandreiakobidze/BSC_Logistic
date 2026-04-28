import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { MapPin, Truck, User, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime, formatDate } from "@/lib/utils";
import { AssignShipmentForm } from "./assign-form";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const s = await prisma.shipment.findFirst({
    where: { id, orgId },
    include: {
      order: { include: { customer: true } },
      driver: true,
      vehicle: true,
      stops: { orderBy: { sequence: "asc" } },
      events: { orderBy: { at: "desc" } },
      pods: true,
    },
  });
  if (!s) notFound();

  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({ where: { orgId }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { orgId, status: "ACTIVE" }, orderBy: { plate: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("shipments.title")} · ${s.number}`}
        description={`${t("orders.customer")}: ${s.order.customer.name}`}
        actions={
          <StatusBadge kind="shipment" status={s.status} label={t(`shipments.status.${s.status}`)} />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent>
            <div className="relative space-y-5 border-l pl-6">
              {s.stops.map((stop, i) => (
                <div key={stop.id} className="relative">
                  <div className="absolute -left-[30px] top-1 h-4 w-4 rounded-full border-4 border-background bg-primary" />
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {stop.kind} · Stop {i + 1}
                  </div>
                  <div className="mt-1 font-medium">{stop.address}</div>
                  <div className="text-sm text-muted-foreground">
                    {[stop.city, stop.country].filter(Boolean).join(", ")}
                  </div>
                  {stop.windowStart && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(stop.windowStart, locale)}
                      {stop.windowEnd ? ` – ${formatDateTime(stop.windowEnd, locale)}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
            <CardContent>
              <AssignShipmentForm
                shipmentId={s.id}
                currentDriverId={s.driverId}
                currentVehicleId={s.vehicleId}
                drivers={drivers.map((d) => ({ id: d.id, label: `${d.firstName} ${d.lastName}` }))}
                vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.make ?? ""} ${v.model ?? ""}` }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cargo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Type" value={s.cargoType ?? "—"} />
              <Row label="Weight" value={s.cargoWeightKg ? `${s.cargoWeightKg} kg` : "—"} />
              <Row label="Volume" value={s.cargoVolumeM3 ? `${s.cargoVolumeM3} m³` : "—"} />
              <Row label="Temperature" value={s.temperature ?? "—"} />
              <Row label="Planned start" value={s.plannedStart ? formatDate(s.plannedStart, locale) : "—"} />
              <Row label="Planned end" value={s.plannedEnd ? formatDate(s.plannedEnd, locale) : "—"} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Event timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {s.events.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">{e.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(e.at, locale)}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
              </div>
            ))}
            {s.events.length === 0 && (
              <div className="text-sm text-muted-foreground">No events yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
