import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { TrackingMap } from "./tracking-map";

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

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const shipments = await prisma.shipment.findMany({
    where: { orgId, status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } },
    include: {
      orderLinks: {
        orderBy: { sortOrder: "asc" },
        include: { order: { select: { customer: { select: { name: true } } } } },
      },
      driver: true,
      vehicle: true,
      stops: { orderBy: { sequence: "asc" } },
      events: {
        where: { type: "LOCATION" },
        orderBy: { at: "desc" },
        take: 1,
      },
    },
  });

  const markers: MarkerOut[] = shipments.flatMap((s) => {
    const last = s.events[0];
    const pickup = s.stops[0];
    const dropoff = s.stops[s.stops.length - 1];
    const customers = Array.from(
      new Set(s.orderLinks.map((l) => l.order.customer.name)),
    );
    const customerLabel =
      customers.length === 0
        ? ""
        : customers.length === 1
          ? customers[0]
          : `${customers[0]} +${customers.length - 1}`;
    const driverName = s.driver
      ? `${s.driver.firstName} ${s.driver.lastName}`.trim()
      : undefined;
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
      customerName: customerLabel || undefined,
    };

    const arr: MarkerOut[] = [];
    if (pickup?.lat != null && pickup.lng != null) {
      arr.push({
        id: `${s.id}-p`,
        lat: pickup.lat,
        lng: pickup.lng,
        kind: "pickup",
        label: customerLabel,
        ...common,
      });
    }
    if (dropoff?.lat != null && dropoff.lng != null) {
      arr.push({
        id: `${s.id}-d`,
        lat: dropoff.lat,
        lng: dropoff.lng,
        kind: "dropoff",
        label: customerLabel,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.tracking")}
        description={`${shipments.length} active shipment(s).`}
      />
      <TrackingMap
        markers={markers}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
        detailHrefBase={`/${locale}/shipments`}
      />
    </div>
  );
}
