"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionOrRedirect } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { ShipmentStatus } from "@/lib/enums";
import { publishShipmentEvent } from "@/lib/shipment-events";

async function requireDriverShipment(shipmentId: string) {
  const session = await getSessionOrRedirect();
  const driver = await prisma.driver.findFirst({ where: { userId: session.user.id } });
  if (!driver) throw new Error("No driver profile");
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, driverId: driver.id },
  });
  if (!shipment) throw new Error("Shipment not found");
  return { session, driver, shipment };
}

export async function driverUpdateStatus(shipmentId: string, status: ShipmentStatus) {
  const { session, shipment } = await requireDriverShipment(shipmentId);
  const extra: { startedAt?: Date; completedAt?: Date } = {};
  if (status === "PICKED_UP" || status === "IN_TRANSIT") extra.startedAt = shipment.startedAt ?? new Date();
  if (status === "DELIVERED" || status === "FAILED") extra.completedAt = new Date();

  await prisma.shipment.update({ where: { id: shipmentId }, data: { status, ...extra } });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "STATUS_CHANGE", note: status },
  });
  await audit({
    action: "driver.shipment.status",
    entity: "Shipment",
    entityId: shipmentId,
    orgId: shipment.orgId,
    userId: session.user.id,
    meta: { status },
  });
  publishShipmentEvent(shipmentId, { type: "STATUS_CHANGE", status });
  revalidatePath("/driver");
  revalidatePath(`/driver/${shipmentId}`);
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}

export async function driverReportLocation(shipmentId: string, lat: number, lng: number) {
  const { shipment } = await requireDriverShipment(shipmentId);
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "LOCATION", lat, lng, note: "driver ping" },
  });
  publishShipmentEvent(shipmentId, { type: "LOCATION_UPDATE", lat, lng });
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}

export async function driverUploadPOD(
  shipmentId: string,
  fileKey: string,
  signedBy?: string,
) {
  const { session, shipment } = await requireDriverShipment(shipmentId);
  const pod = await prisma.pOD.create({
    data: { shipmentId, fileKey, signedBy: signedBy ?? null },
  });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "POD_UPLOADED", note: `POD ${pod.id}` },
  });
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: ShipmentStatus.DELIVERED, completedAt: new Date() },
  });
  await audit({
    action: "driver.pod.upload",
    entity: "Shipment",
    entityId: shipmentId,
    orgId: shipment.orgId,
    userId: session.user.id,
  });
  publishShipmentEvent(shipmentId, { type: "POD_UPLOADED" });
  revalidatePath("/driver");
  revalidatePath(`/driver/${shipmentId}`);
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}
