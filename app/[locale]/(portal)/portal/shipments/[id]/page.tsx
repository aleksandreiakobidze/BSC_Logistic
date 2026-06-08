import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, MapPin, Package, FileDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { formatDateTime, formatDate } from "@/lib/utils";
import { ShipmentRealtimeProvider } from "@/components/app/shipment-realtime";
import { TrackingMap } from "@/app/[locale]/(dashboard)/tracking/tracking-map";

export default async function PortalShipmentDetailPage({
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
  const customerId = session.user.customerId;

  const t = await getTranslations();

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      events: { orderBy: { at: "desc" } },
      pods: { orderBy: { capturedAt: "desc" } },
      orderLinks: {
        orderBy: { sortOrder: "asc" },
        include: {
          order: {
            select: {
              id: true,
              number: true,
              customerId: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!shipment) notFound();

  const owns = shipment.orderLinks.some(
    (l) => l.order.customerId === customerId,
  );
  if (!owns) notFound();

  const visibleOrders = shipment.orderLinks
    .filter((l) => l.order.customerId === customerId)
    .map((l) => ({ id: l.order.id, number: l.order.number }));

  // Build pickup / dropoff / live-truck markers for the map. The latest
  // LOCATION ShipmentEvent (written by the driver app) drives the truck
  // pin; pickup / dropoff come from Stop.lat/Stop.lng which are filled in
  // by the LocationAutocomplete in the create-shipment dialog.
  const pickupStop = shipment.stops[0];
  const dropoffStop = shipment.stops[shipment.stops.length - 1];
  const lastLocationEvent = shipment.events.find((e) => e.type === "LOCATION");
  const fromLabel = pickupStop?.city ?? pickupStop?.address ?? null;
  const toLabel = dropoffStop?.city ?? dropoffStop?.address ?? null;
  const route =
    fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : undefined;
  const commonMarkerProps = {
    shipmentId: shipment.id,
    shipmentNumber: shipment.number,
    status: shipment.status,
    route,
  };
  const mapMarkers: {
    id: string;
    lat: number;
    lng: number;
    kind: "pickup" | "dropoff" | "live";
    label: string;
    shipmentNumber: string;
    shipmentId?: string;
    status?: string;
    route?: string;
  }[] = [];
  if (pickupStop?.lat != null && pickupStop?.lng != null) {
    mapMarkers.push({
      id: `${shipment.id}-pickup`,
      lat: pickupStop.lat,
      lng: pickupStop.lng,
      kind: "pickup",
      label: pickupStop.address,
      ...commonMarkerProps,
    });
  }
  if (
    dropoffStop?.lat != null &&
    dropoffStop?.lng != null &&
    dropoffStop.id !== pickupStop?.id
  ) {
    mapMarkers.push({
      id: `${shipment.id}-dropoff`,
      lat: dropoffStop.lat,
      lng: dropoffStop.lng,
      kind: "dropoff",
      label: dropoffStop.address,
      ...commonMarkerProps,
    });
  }
  if (lastLocationEvent?.lat != null && lastLocationEvent?.lng != null) {
    mapMarkers.push({
      id: `${shipment.id}-live`,
      lat: lastLocationEvent.lat,
      lng: lastLocationEvent.lng,
      kind: "live",
      label: lastLocationEvent.note ?? "",
      ...commonMarkerProps,
    });
  }
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const hasLive = mapMarkers.some((m) => m.kind === "live");

  return (
    <ShipmentRealtimeProvider shipmentId={shipment.id}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 gap-1.5">
            <Link href={`/${locale}/portal/shipments`}>
              <ArrowLeft className="h-4 w-4" />
              {t("portal.shipments.title")}
            </Link>
          </Button>
          <PageHeader
            title={
              <span className="font-mono text-2xl">{shipment.trackingCode}</span>
            }
            description={
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={shipment.status} kind="shipment" />
                {visibleOrders.length > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {t("orders.title")}:
                    </span>
                    {visibleOrders.map((o, i) => (
                      <Link
                        key={o.id}
                        href={`/${locale}/portal/orders/${o.id}`}
                        className="font-mono hover:underline"
                      >
                        {o.number}
                        {i < visibleOrders.length - 1 ? "," : ""}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("portal.shipments.liveLocation")}</CardTitle>
          </CardHeader>
          <CardContent>
            {mapMarkers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t("portal.shipments.liveLocationPending")}
              </div>
            ) : (
              <>
                <TrackingMap
                  markers={mapMarkers}
                  mapboxToken={mapboxToken}
                  className="h-[420px] overflow-hidden rounded-2xl border"
                  initialZoom={hasLive ? 9 : 5}
                />
                {!hasLive && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t("portal.shipments.liveLocationPending")}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("shipments.route")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shipment.stops.map((s) => (
                  <div
                    key={s.id}
                    className="flex gap-3 rounded-xl border p-3"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      {s.kind === "PICKUP" ? (
                        <Package className="h-4 w-4" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {s.kind === "PICKUP" ? "Pickup" : "Dropoff"}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {s.address}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[s.city, s.country].filter(Boolean).join(", ")}
                      </div>
                      {s.windowStart && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(s.windowStart, locale)}
                          {s.windowEnd
                            ? ` – ${formatDateTime(s.windowEnd, locale)}`
                            : ""}
                        </div>
                      )}
                      {(s.arrivedAt || s.departedAt) && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs">
                          {s.arrivedAt && (
                            <span className="text-success">
                              Arrived {formatDateTime(s.arrivedAt, locale)}
                            </span>
                          )}
                          {s.departedAt && (
                            <span className="text-success">
                              Departed {formatDateTime(s.departedAt, locale)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Planned start"
                  value={
                    shipment.plannedStart
                      ? formatDate(shipment.plannedStart, locale)
                      : "—"
                  }
                />
                <Row
                  label="Planned end"
                  value={
                    shipment.plannedEnd
                      ? formatDate(shipment.plannedEnd, locale)
                      : "—"
                  }
                />
                <Row
                  label="Started"
                  value={
                    shipment.startedAt
                      ? formatDateTime(shipment.startedAt, locale)
                      : "—"
                  }
                />
                <Row
                  label="Completed"
                  value={
                    shipment.completedAt
                      ? formatDateTime(shipment.completedAt, locale)
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            {(shipment.carrier || shipment.externalTrackingNumber) && (
              <Card>
                <CardHeader>
                  <CardTitle>Carrier tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Carrier" value={shipment.carrier ?? "—"} />
                  <Row
                    label="Tracking #"
                    value={
                      shipment.externalTrackingNumber ? (
                        <span className="font-mono">
                          {shipment.externalTrackingNumber}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                </CardContent>
              </Card>
            )}

            {shipment.pods.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Proof of delivery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shipment.pods.map((p) => (
                    <a
                      key={p.id}
                      href={p.fileUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent"
                    >
                      <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {p.signedBy
                          ? `Signed by ${p.signedBy}`
                          : "Download POD"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(p.capturedAt, locale)}
                      </span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {shipment.events.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No events yet.
              </div>
            ) : (
              <ol className="space-y-4 border-l pl-5">
                {shipment.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="text-sm font-medium">
                      {e.type.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(e.at, locale)}
                    </div>
                    {e.note && (
                      <div className="mt-0.5 text-sm">{e.note}</div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </ShipmentRealtimeProvider>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
