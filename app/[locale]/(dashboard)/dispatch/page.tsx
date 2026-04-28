import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { serialize } from "@/lib/serialize";
import { PageHeader } from "@/components/app/page-header";
import { DispatchBoard } from "./dispatch-board";

export default async function DispatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [shipments, drivers] = await Promise.all([
    prisma.shipment.findMany({
      where: { orgId, status: { in: ["PLANNED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } },
      include: {
        order: { include: { customer: true } },
        driver: true,
        vehicle: true,
        stops: { orderBy: { sequence: "asc" }, take: 2 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.driver.findMany({
      where: { orgId, status: { in: ["AVAILABLE", "ON_DUTY"] } },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const unassigned = shipments.filter((s) => !s.driverId);
  const byDriver = new Map<string, typeof shipments>();
  for (const d of drivers) byDriver.set(d.id, []);
  for (const s of shipments) {
    if (s.driverId && byDriver.has(s.driverId)) {
      byDriver.get(s.driverId)!.push(s);
    }
  }

  const columns = [
    {
      id: "__unassigned__",
      title: "Unassigned",
      subtitle: `${unassigned.length} shipment(s)`,
      shipments: unassigned,
    },
    ...drivers.map((d) => ({
      id: d.id,
      title: `${d.firstName} ${d.lastName}`,
      subtitle: d.phone ?? "",
      shipments: byDriver.get(d.id) ?? [],
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.dispatch")}
        description="Drag shipments onto drivers to assign, or back to Unassigned to unassign."
      />
      <DispatchBoard columns={serialize(columns)} />
    </div>
  );
}
