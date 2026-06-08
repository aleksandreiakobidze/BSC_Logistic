"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enqueueNotification } from "@/lib/queue";
import { OrderStatus, ShipmentStatus, StopKind } from "@/lib/enums";
import { generateNumber, generateTrackingCode } from "@/lib/utils";
import {
  registerAftershipTracking,
  isAftershipConfigured,
} from "@/lib/aftership";
import { publishShipmentEvent } from "@/lib/shipment-events";

export async function assignShipment(
  shipmentId: string,
  driverId: string | null,
  vehicleId: string | null | undefined,
) {
  const { session, orgId } = await requireOrg();
  const existing = await prisma.shipment.findFirst({
    where: { id: shipmentId, orgId },
    include: { orderLinks: { include: { order: { include: { customer: true } } } } },
  });
  if (!existing) throw new Error("Shipment not found");
  const nextVehicle = vehicleId === undefined ? existing.vehicleId : vehicleId;
  const shipment = await prisma.shipment.update({
    where: { id: shipmentId, orgId },
    data: {
      driverId: driverId || null,
      vehicleId: nextVehicle,
      status: driverId ? ShipmentStatus.ASSIGNED : ShipmentStatus.PLANNED,
    },
    include: { driver: true },
  });
  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      type: "ASSIGNED",
      note: `Assigned driver=${driverId ?? "none"} vehicle=${vehicleId ?? "none"}`,
    },
  });
  await audit({
    action: "shipment.assign",
    entity: "Shipment",
    entityId: shipmentId,
    orgId,
    userId: session.user.id,
  });
  if (shipment.driver?.email) {
    const customers = Array.from(
      new Set(existing.orderLinks.map((l) => l.order.customer.name)),
    ).join(", ");
    await enqueueNotification("email", {
      to: shipment.driver.email,
      subject: `New shipment assigned: ${shipment.number}`,
      body: `You've been assigned shipment ${shipment.number}${customers ? ` for ${customers}` : ""}.`,
    });
  }
  publishShipmentEvent(shipmentId, { type: "ASSIGNED" });
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/dispatch");
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  note?: string,
) {
  const { session, orgId } = await requireOrg();
  const existing = await prisma.shipment.findFirst({
    where: { id: shipmentId, orgId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      trackingCode: true,
    },
  });
  if (!existing) throw new Error("Shipment not found");

  const data: {
    status: ShipmentStatus;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } = { status };

  // Auto-set startedAt the first time the shipment goes "active"
  if (
    (status === ShipmentStatus.PICKED_UP || status === ShipmentStatus.IN_TRANSIT) &&
    !existing.startedAt
  ) {
    data.startedAt = new Date();
  }
  // Auto-set completedAt when reaching a terminal status
  if (
    (status === ShipmentStatus.DELIVERED ||
      status === ShipmentStatus.FAILED ||
      status === ShipmentStatus.CANCELLED) &&
    !existing.completedAt
  ) {
    data.completedAt = new Date();
  }
  // Reset completedAt if rolling back to an earlier state
  if (
    status !== ShipmentStatus.DELIVERED &&
    status !== ShipmentStatus.FAILED &&
    status !== ShipmentStatus.CANCELLED
  ) {
    data.completedAt = null;
  }

  await prisma.shipment.update({ where: { id: shipmentId, orgId }, data });
  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      type: "STATUS_CHANGE",
      note: note ? `${status}: ${note}` : status,
    },
  });
  await audit({
    action: "shipment.status",
    entity: "Shipment",
    entityId: shipmentId,
    orgId,
    userId: session.user.id,
    meta: { from: existing.status, to: status },
  });
  publishShipmentEvent(shipmentId, { type: "STATUS_CHANGE", status });
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/driver");
  revalidatePath("/dispatch");
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${existing.trackingCode}`);
  return { ok: true };
}

const createShipmentSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, "Select at least one order"),
  driverId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  cargoType: z.string().optional().nullable(),
  cargoWeightKg: z.coerce.number().min(0).optional().nullable(),
  cargoVolumeM3: z.coerce.number().min(0).optional().nullable(),
  temperature: z.string().optional().nullable(),
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pickupAddress: z.string().min(1),
  pickupCity: z.string().optional().nullable(),
  pickupCountry: z.string().optional().nullable(),
  pickupLat: z.coerce.number().nullable().optional(),
  pickupLng: z.coerce.number().nullable().optional(),
  dropoffAddress: z.string().min(1),
  dropoffCity: z.string().optional().nullable(),
  dropoffCountry: z.string().optional().nullable(),
  dropoffLat: z.coerce.number().nullable().optional(),
  dropoffLng: z.coerce.number().nullable().optional(),
  carrier: z.string().optional().nullable(),
  externalTrackingNumber: z.string().optional().nullable(),
});

export async function createShipment(input: z.infer<typeof createShipmentSchema>) {
  const { session, orgId } = await requireOrg();
  const data = createShipmentSchema.parse(input);

  const orders = await prisma.order.findMany({
    where: { id: { in: data.orderIds }, orgId },
    select: { id: true, customerId: true },
  });
  if (orders.length !== data.orderIds.length) {
    throw new Error("One or more orders not found");
  }

  const driverId = data.driverId || null;
  const carrier = data.carrier?.trim() || null;
  const externalTrackingNumber = data.externalTrackingNumber?.trim() || null;

  const shipment = await prisma.shipment.create({
    data: {
      orgId,
      number: generateNumber("SHP"),
      trackingCode: generateTrackingCode(),
      status: driverId ? ShipmentStatus.ASSIGNED : ShipmentStatus.PLANNED,
      driverId,
      vehicleId: data.vehicleId || null,
      cargoType: data.cargoType || null,
      cargoWeightKg: data.cargoWeightKg ?? null,
      cargoVolumeM3: data.cargoVolumeM3 ?? null,
      temperature: data.temperature || null,
      plannedStart: data.plannedStart ? new Date(data.plannedStart) : null,
      plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : null,
      notes: data.notes || null,
      carrier,
      externalTrackingNumber,
      externalProvider: externalTrackingNumber ? "aftership" : null,
      stops: {
        create: [
          {
            sequence: 1,
            kind: StopKind.PICKUP,
            address: data.pickupAddress,
            city: data.pickupCity || null,
            country: data.pickupCountry || null,
            lat: data.pickupLat ?? null,
            lng: data.pickupLng ?? null,
          },
          {
            sequence: 2,
            kind: StopKind.DROPOFF,
            address: data.dropoffAddress,
            city: data.dropoffCity || null,
            country: data.dropoffCountry || null,
            lat: data.dropoffLat ?? null,
            lng: data.dropoffLng ?? null,
          },
        ],
      },
      events: {
        create: {
          type: "CREATED",
          note: `Shipment created with ${orders.length} order${orders.length > 1 ? "s" : ""}`,
        },
      },
      orderLinks: {
        create: data.orderIds.map((orderId, idx) => ({ orderId, sortOrder: idx })),
      },
    },
  });

  // Register the tracking with AfterShip if configured. Failures must NOT
  // block shipment creation - we just log and carry on. The webhook will
  // backfill events as soon as AfterShip starts polling the carrier.
  if (carrier && externalTrackingNumber && isAftershipConfigured()) {
    try {
      const tracking = await registerAftershipTracking({
        slug: carrier,
        trackingNumber: externalTrackingNumber,
      });
      if (tracking?.id) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { externalTrackingId: tracking.id },
        });
      }
    } catch (err) {
      console.error("[aftership] registration failed", err);
    }
  }

  await audit({
    action: "shipment.create",
    entity: "Shipment",
    entityId: shipment.id,
    orgId,
    userId: session.user.id,
    meta: { orderIds: data.orderIds },
  });

  publishShipmentEvent(shipment.id, { type: "CREATED" });
  revalidatePath("/shipments");
  revalidatePath("/dispatch");
  revalidatePath(`/portal/shipments/${shipment.id}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  for (const o of data.orderIds) revalidatePath(`/orders/${o}`);
  return { ok: true, id: shipment.id };
}

const createShipmentFromOrderSchema = z.object({
  driverId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  cargoType: z.string().optional().nullable(),
  cargoWeightKg: z.coerce.number().min(0).optional().nullable(),
  cargoVolumeM3: z.coerce.number().min(0).optional().nullable(),
  temperature: z.string().optional().nullable(),
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pickupAddress: z.string().min(1),
  pickupCity: z.string().optional().nullable(),
  pickupCountry: z.string().optional().nullable(),
  pickupLat: z.coerce.number().nullable().optional(),
  pickupLng: z.coerce.number().nullable().optional(),
  dropoffAddress: z.string().min(1),
  dropoffCity: z.string().optional().nullable(),
  dropoffCountry: z.string().optional().nullable(),
  dropoffLat: z.coerce.number().nullable().optional(),
  dropoffLng: z.coerce.number().nullable().optional(),
  carrier: z.string().optional().nullable(),
  externalTrackingNumber: z.string().optional().nullable(),
});

/**
 * Authorize an order by creating a shipment for it.
 *
 * The order must be past QUOTE - employer has explicitly confirmed it - and
 * not already cancelled. Acts as a thin wrapper around `createShipment`,
 * pre-binding `orderIds: [orderId]`.
 */
export async function createShipmentFromOrder(
  orderId: string,
  input: z.infer<typeof createShipmentFromOrderSchema>,
) {
  const { orgId } = await requireOrg();
  const data = createShipmentFromOrderSchema.parse(input);

  const order = await prisma.order.findFirst({
    where: { id: orderId, orgId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status === OrderStatus.QUOTE) {
    throw new Error("Authorize the order first");
  }
  if (order.status === OrderStatus.CANCELLED) {
    throw new Error("Cannot create shipment for a cancelled order");
  }

  return createShipment({ ...data, orderIds: [orderId] });
}

export async function addOrderToShipment(shipmentId: string, orderId: string) {
  const { session, orgId } = await requireOrg();
  const [shipment, order] = await Promise.all([
    prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: { id: true, trackingCode: true },
    }),
    prisma.order.findFirst({ where: { id: orderId, orgId }, select: { id: true } }),
  ]);
  if (!shipment) throw new Error("Shipment not found");
  if (!order) throw new Error("Order not found");

  const existing = await prisma.shipmentOrder.findUnique({
    where: { shipmentId_orderId: { shipmentId, orderId } },
  });
  if (existing) throw new Error("This order is already on the shipment");

  const max = await prisma.shipmentOrder.aggregate({
    where: { shipmentId },
    _max: { sortOrder: true },
  });

  await prisma.shipmentOrder.create({
    data: { shipmentId, orderId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "NOTE", note: `Order added to shipment` },
  });
  await audit({
    action: "shipment.addOrder",
    entity: "Shipment",
    entityId: shipmentId,
    orgId,
    userId: session.user.id,
    meta: { orderId },
  });
  publishShipmentEvent(shipmentId, { type: "ORDER_ADDED" });
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}

export async function searchOrdersForShipment(q: string, excludeShipmentId?: string) {
  const { orgId } = await requireOrg();
  const trimmed = q.trim();
  const orders = await prisma.order.findMany({
    where: {
      orgId,
      ...(trimmed
        ? {
            OR: [
              { number: { contains: trimmed } },
              { customer: { name: { contains: trimmed } } },
              { reference: { contains: trimmed } },
            ],
          }
        : {}),
      ...(excludeShipmentId
        ? {
            NOT: { shipmentLinks: { some: { shipmentId: excludeShipmentId } } },
          }
        : {}),
    },
    select: {
      id: true,
      number: true,
      status: true,
      price: true,
      currency: true,
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    price: Number(o.price),
    currency: o.currency,
    customerId: o.customer.id,
    customerName: o.customer.name,
  }));
}

export async function removeOrderFromShipment(shipmentId: string, orderId: string) {
  const { session, orgId } = await requireOrg();
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, orgId },
    include: { orderLinks: true },
  });
  if (!shipment) throw new Error("Shipment not found");
  if (shipment.orderLinks.length <= 1) {
    throw new Error("A shipment must have at least one order");
  }

  await prisma.shipmentOrder.delete({
    where: { shipmentId_orderId: { shipmentId, orderId } },
  });
  await prisma.shipmentEvent.create({
    data: { shipmentId, type: "NOTE", note: `Order removed from shipment` },
  });
  await audit({
    action: "shipment.removeOrder",
    entity: "Shipment",
    entityId: shipmentId,
    orgId,
    userId: session.user.id,
    meta: { orderId },
  });
  publishShipmentEvent(shipmentId, { type: "ORDER_REMOVED" });
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/portal/shipments/${shipmentId}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);
  return { ok: true };
}
