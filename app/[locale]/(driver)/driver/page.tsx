import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { MapPin, Package, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDate } from "@/lib/utils";

export default async function DriverHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) {
    return (
      <EmptyState
        icon={Truck}
        title="Driver profile not set up"
        description="Ask your dispatcher to link your user account to a driver profile."
      />
    );
  }

  const shipments = await prisma.shipment.findMany({
    where: {
      driverId: driver.id,
      status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
    },
    include: {
      order: { include: { customer: true } },
      stops: { orderBy: { sequence: "asc" } },
    },
    orderBy: { plannedStart: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("driverApp.myShipments")}</h1>
        <p className="text-sm text-muted-foreground">
          {shipments.length} active · Driver {driver.firstName}
        </p>
      </div>

      {shipments.length === 0 ? (
        <EmptyState icon={Package} title="No active shipments" description="New assignments will appear here." />
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const pickup = s.stops[0];
            const dropoff = s.stops[s.stops.length - 1];
            return (
              <Link key={s.id} href={`/driver/${s.id}`}>
                <Card className="transition-colors active:bg-accent/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{s.number}</div>
                      <StatusBadge kind="shipment" status={s.status} label={t(`shipments.status.${s.status}`)} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.order.customer.name}</div>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 text-success" />
                        <div>
                          <div className="font-medium">{pickup?.address}</div>
                          <div className="text-xs text-muted-foreground">
                            {[pickup?.city, pickup?.country].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 text-warning" />
                        <div>
                          <div className="font-medium">{dropoff?.address}</div>
                          <div className="text-xs text-muted-foreground">
                            {[dropoff?.city, dropoff?.country].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                    {s.plannedStart && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Planned: {formatDate(s.plannedStart, locale)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
