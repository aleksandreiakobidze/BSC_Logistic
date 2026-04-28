"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enqueueNotification } from "@/lib/queue";
import { ShipmentStatus } from "@/lib/enums";

export async function assignShipment(
  shipmentId: string,
  driverId: string | null,
  vehicleId: string | null | undefined,
) {
  const { session, orgId } = await requireOrg();
  const existing = await prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
  if (!existing) throw new Error("Shipment not found");
  const nextVehicle = vehicleId === undefined ? existing.vehicleId : vehicleId;
  const shipment = await prisma.shipment.update({
    where: { id: shipmentId, orgId },
    data: {
      driverId: driverId || null,
      vehicleId: nextVehicle,
      status: driverId ? ShipmentStatus.ASSIGNED : ShipmentStatus.PLANNED,
    },
    include: { driver: true, order: { include: { customer: true } } },
  });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "ASSIGNED", note: `Assigned driver=${driverId ?? "none"} vehicle=${vehicleId ?? "none"}` },
  });
  await audit({ action: "shipment.assign", entity: "Shipment", entityId: shipmentId, orgId, userId: session.user.id });
  if (shipment.driver?.email) {
    await enqueueNotification("email", {
      to: shipment.driver.email,
      subject: `New shipment assigned: ${shipment.number}`,
      body: `You've been assigned shipment ${shipment.number} for ${shipment.order.customer.name}.`,
    });
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/dispatch");
  return { ok: true };
}

export async function updateShipmentStatus(shipmentId: string, status: ShipmentStatus, note?: string) {
  const { session, orgId } = await requireOrg();
  const extra: { startedAt?: Date; completedAt?: Date } = {};
  if (status === "IN_TRANSIT" || status === "PICKED_UP") extra.startedAt = new Date();
  if (status === "DELIVERED" || status === "FAILED") extra.completedAt = new Date();

  await prisma.shipment.update({
    where: { id: shipmentId, orgId },
    data: { status, ...extra },
  });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "STATUS_CHANGE", note: note ?? status },
  });
  await audit({
    action: "shipment.status",
    entity: "Shipment",
    entityId: shipmentId,
    orgId,
    userId: session.user.id,
    meta: { status },
  });
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/driver");
  return { ok: true };
}
