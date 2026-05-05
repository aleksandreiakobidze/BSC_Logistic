import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/utils";
import { MapPin, Package } from "lucide-react";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();

  const shipment = await prisma.shipment.findFirst({
    where: { trackingCode: code },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      events: { orderBy: { at: "desc" }, take: 20 },
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

  if (!shipment) return notFound();

  // Privacy filter: signed-in customers see only their own orders.
  // Anonymous viewers see only the tracking code, status, route — not order details.
  const viewerCustomerId = session?.user?.customerId;
  const isCustomer = session?.user?.role === "CUSTOMER";
  const visibleOrders = !session
    ? []
    : isCustomer
    ? shipment.orderLinks
        .filter((l) => l.order.customerId === viewerCustomerId)
        .map((l) => ({
          id: l.order.id,
          number: l.order.number,
          customerName: l.order.customer.name,
        }))
    : shipment.orderLinks.map((l) => ({
        id: l.order.id,
        number: l.order.number,
        customerName: l.order.customer.name,
      }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">{t("portal.trackTitle")}</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-semibold">{shipment.trackingCode}</h1>
          <StatusBadge status={shipment.status} kind="shipment" />
        </div>
        {visibleOrders.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>Order{visibleOrders.length > 1 ? "s" : ""}:</span>
            {visibleOrders.map((o, i) => (
              <span key={o.id}>
                {isCustomer ? (
                  <Link
                    href={`/portal/orders/${o.id}`}
                    className="font-mono hover:underline"
                  >
                    {o.number}
                  </Link>
                ) : (
                  <span className="font-mono">{o.number}</span>
                )}
                <span className="text-xs"> — {o.customerName}</span>
                {i < visibleOrders.length - 1 ? "," : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Route</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {shipment.stops.map((s) => (
            <div key={s.id} className="flex gap-3 rounded-xl border p-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                {s.kind === "PICKUP" ? <Package className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.kind === "PICKUP" ? "Pickup" : "Dropoff"}</div>
                <div className="truncate text-sm text-muted-foreground">{s.address}</div>
                {s.windowStart && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(s.windowStart)}
                    {s.windowEnd ? ` — ${formatDateTime(s.windowEnd)}` : ""}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          {shipment.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {shipment.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{ev.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(ev.at)}</div>
                  {ev.note && <div className="text-sm">{ev.note}</div>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
