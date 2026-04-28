import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { MapPin, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/utils";
import { DriverShipmentActions } from "./actions-ui";

export default async function DriverShipmentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) redirect(`/${locale}/driver`);

  const s = await prisma.shipment.findFirst({
    where: { id, driverId: driver.id },
    include: {
      order: { include: { customer: true } },
      stops: { orderBy: { sequence: "asc" } },
      events: { orderBy: { at: "desc" }, take: 10 },
      pods: true,
    },
  });
  if (!s) notFound();

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-muted-foreground">{s.order.customer.name}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{s.number}</h1>
        <div className="mt-2">
          <StatusBadge kind="shipment" status={s.status} label={t(`shipments.status.${s.status}`)} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Route</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {s.stops.map((stop, i) => (
              <div key={stop.id}>
                <div className="flex items-start gap-2">
                  <MapPin
                    className={
                      stop.kind === "PICKUP"
                        ? "mt-0.5 h-4 w-4 text-success"
                        : "mt-0.5 h-4 w-4 text-warning"
                    }
                  />
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Stop {i + 1} · {stop.kind}
                    </div>
                    <div className="mt-0.5 font-medium">{stop.address}</div>
                    <div className="text-sm text-muted-foreground">
                      {[stop.city, stop.country].filter(Boolean).join(", ")}
                    </div>
                    {stop.windowStart && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatDateTime(stop.windowStart, locale)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DriverShipmentActions shipmentId={s.id} status={s.status} />

      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {s.events.map((e) => (
              <div key={e.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">{e.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(e.at, locale)}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
