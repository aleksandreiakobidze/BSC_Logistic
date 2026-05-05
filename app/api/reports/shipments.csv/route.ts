import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) return new NextResponse("Unauthorized", { status: 401 });

  const shipments = await prisma.shipment.findMany({
    where: { orgId: session.user.orgId },
    include: {
      orderLinks: {
        orderBy: { sortOrder: "asc" },
        include: { order: { select: { customer: { select: { name: true } } } } },
      },
      driver: true,
      vehicle: true,
      stops: { orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    [
      "Number",
      "Customer",
      "Status",
      "TrackingCode",
      "Driver",
      "Vehicle",
      "PickupAddress",
      "DropoffAddress",
      "CargoWeightKg",
      "PlannedDistanceKm",
      "CreatedAt",
      "CompletedAt",
    ].join(","),
  ];
  for (const s of shipments) {
    const p = s.stops[0];
    const d = s.stops[s.stops.length - 1];
    lines.push(
      [
        s.number,
        JSON.stringify(
          Array.from(
            new Set(s.orderLinks.map((l) => l.order.customer.name)),
          ).join("; "),
        ),
        s.status,
        s.trackingCode,
        s.driver ? JSON.stringify(`${s.driver.firstName} ${s.driver.lastName}`) : "",
        s.vehicle?.plate ?? "",
        JSON.stringify(p?.address ?? ""),
        JSON.stringify(d?.address ?? ""),
        s.cargoWeightKg ?? "",
        s.plannedDistanceKm ?? "",
        s.createdAt.toISOString(),
        s.completedAt?.toISOString() ?? "",
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shipments.csv"`,
    },
  });
}
