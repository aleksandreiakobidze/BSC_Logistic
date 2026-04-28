import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
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

  const shipment = await prisma.shipment.findFirst({
    where: { trackingCode: code },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      events: { orderBy: { at: "desc" }, take: 20 },
      order: { select: { number: true, customer: { select: { name: true } } } },
    },
  });

  if (!shipment) return notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">{t("portal.trackTitle")}</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-semibold">{shipment.trackingCode}</h1>
          <StatusBadge status={shipment.status} kind="shipment" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <span className="font-mono">{shipment.order.number}</span> — {shipment.order.customer.name}
        </p>
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
