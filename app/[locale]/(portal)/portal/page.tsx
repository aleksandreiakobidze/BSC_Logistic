import { setRequestLocale, getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackForm } from "./track-form";
import { TrackingMap } from "@/app/[locale]/(dashboard)/tracking/tracking-map";
import { CustomerPortalLiveProvider } from "@/components/app/customer-portal-live";

type MarkerOut = {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "live";
  label: string;
  shipmentNumber: string;
  shipmentId: string;
  status: string;
  route?: string;
  driverName?: string;
  customerName?: string;
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  const isCustomer =
    session?.user?.role === "CUSTOMER" && !!session.user.customerId;

  let markers: MarkerOut[] = [];
  let shipmentIds: string[] = [];

  if (isCustomer) {
    const customerId = session!.user!.customerId!;
    const shipments = await prisma.shipment.findMany({
      where: {
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
        orderLinks: { some: { order: { customerId } } },
      },
      include: {
        orderLinks: {
          orderBy: { sortOrder: "asc" },
          include: {
            order: { select: { customer: { select: { name: true } } } },
          },
        },
        driver: true,
        stops: { orderBy: { sequence: "asc" } },
        events: {
          where: { type: "LOCATION" },
          orderBy: { at: "desc" },
          take: 1,
        },
      },
      take: 50,
    });
    shipmentIds = shipments.map((s) => s.id);
    markers = shipments.flatMap((s) => {
      const last = s.events[0];
      const pickup = s.stops[0];
      const dropoff = s.stops[s.stops.length - 1];
      const driverName = s.driver
        ? `${s.driver.firstName} ${s.driver.lastName}`.trim()
        : undefined;
      const customerName = s.orderLinks[0]?.order.customer.name;
      const fromLabel = pickup?.city ?? pickup?.address ?? null;
      const toLabel = dropoff?.city ?? dropoff?.address ?? null;
      const route =
        fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : undefined;

      const common = {
        shipmentId: s.id,
        shipmentNumber: s.number,
        status: s.status,
        route,
        driverName,
        customerName,
      };

      const arr: MarkerOut[] = [];
      if (pickup?.lat != null && pickup.lng != null) {
        arr.push({
          id: `${s.id}-p`,
          lat: pickup.lat,
          lng: pickup.lng,
          kind: "pickup",
          label: customerName ?? "",
          ...common,
        });
      }
      if (dropoff?.lat != null && dropoff.lng != null) {
        arr.push({
          id: `${s.id}-d`,
          lat: dropoff.lat,
          lng: dropoff.lng,
          kind: "dropoff",
          label: customerName ?? "",
          ...common,
        });
      }
      if (last?.lat != null && last.lng != null) {
        arr.push({
          id: `${s.id}-l`,
          lat: last.lat,
          lng: last.lng,
          kind: "live",
          label: driverName ?? "",
          ...common,
        });
      }
      return arr;
    });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return (
    <div
      className={
        isCustomer
          ? "mx-auto w-full max-w-6xl space-y-8"
          : "mx-auto max-w-xl text-center"
      }
    >
      <div className={isCustomer ? "text-center" : undefined}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Package className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("portal.trackTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("portal.trackDescription")}
        </p>
        <div className="mt-6 mx-auto max-w-xl">
          <TrackForm />
        </div>
      </div>

      {isCustomer && (
        <CustomerPortalLiveProvider shipmentIds={shipmentIds}>
          <Card>
            <CardHeader>
              <CardTitle>{t("portal.activeShipmentsMap")}</CardTitle>
            </CardHeader>
            <CardContent>
              {markers.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {t("portal.noActiveShipments")}
                </div>
              ) : (
                <TrackingMap
                  markers={markers}
                  mapboxToken={mapboxToken}
                  className="h-[520px] overflow-hidden rounded-2xl border"
                  initialZoom={6}
                  detailHrefBase={`/${locale}/portal/shipments`}
                />
              )}
            </CardContent>
          </Card>
        </CustomerPortalLiveProvider>
      )}
    </div>
  );
}
