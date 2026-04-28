import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { TrackingMap } from "./tracking-map";

export default async function TrackingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const shipments = await prisma.shipment.findMany({
    where: { orgId, status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } },
    include: {
      order: { include: { customer: true } },
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

  const markers = shipments.flatMap((s) => {
    const last = s.events[0];
    const pickup = s.stops[0];
    const dropoff = s.stops[s.stops.length - 1];
    const arr: {
      id: string;
      lat: number;
      lng: number;
      kind: "pickup" | "dropoff" | "live";
      label: string;
      shipmentNumber: string;
    }[] = [];
    if (pickup?.lat != null && pickup.lng != null) {
      arr.push({ id: `${s.id}-p`, lat: pickup.lat, lng: pickup.lng, kind: "pickup", label: s.order.customer.name, shipmentNumber: s.number });
    }
    if (dropoff?.lat != null && dropoff.lng != null) {
      arr.push({ id: `${s.id}-d`, lat: dropoff.lat, lng: dropoff.lng, kind: "dropoff", label: s.order.customer.name, shipmentNumber: s.number });
    }
    if (last?.lat != null && last.lng != null) {
      arr.push({ id: `${s.id}-l`, lat: last.lat, lng: last.lng, kind: "live", label: s.driver ? `${s.driver.firstName} ${s.driver.lastName}` : "", shipmentNumber: s.number });
    }
    return arr;
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.tracking")} description={`${shipments.length} active shipment(s).`} />
      <TrackingMap markers={markers} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""} />
    </div>
  );
}
