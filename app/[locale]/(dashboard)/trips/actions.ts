"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber } from "@/lib/utils";
import { ShipmentStatus } from "@/lib/enums";
import {
  ALLOCATION_METHODS,
  computeAllocation,
  type AllocationMethod,
  type OrderForAllocation,
} from "@/lib/expense-allocation";

const tripCreateSchema = z.object({
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  notes: z.string().optional(),
});

const tripUpdateSchema = tripCreateSchema.extend({
  status: z.nativeEnum(ShipmentStatus).optional(),
  totalDistanceKm: z.coerce.number().optional(),
});

export async function createTrip(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const data = tripCreateSchema.parse(Object.fromEntries(formData.entries()));

  const trip = await prisma.trip.create({
    data: {
      orgId,
      number: generateNumber("TRP"),
      status: ShipmentStatus.PLANNED,
      driverId: data.driverId || null,
      vehicleId: data.vehicleId || null,
      plannedStart: data.plannedStart ? new Date(data.plannedStart) : null,
      plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : null,
      notes: data.notes || null,
    },
  });

  await audit({
    action: "trip.create",
    entity: "Trip",
    entityId: trip.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/trips");
  return { ok: true, id: trip.id };
}

export async function updateTrip(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();
  const existing = await prisma.trip.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error("Trip not found");

  const data = tripUpdateSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.trip.update({
    where: { id },
    data: {
      driverId: data.driverId ?? existing.driverId,
      vehicleId: data.vehicleId ?? existing.vehicleId,
      plannedStart: data.plannedStart ? new Date(data.plannedStart) : existing.plannedStart,
      plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : existing.plannedEnd,
      notes: data.notes ?? existing.notes,
      status: data.status ?? existing.status,
      totalDistanceKm: data.totalDistanceKm ?? existing.totalDistanceKm,
    },
  });

  await audit({ action: "trip.update", entity: "Trip", entityId: id, orgId, userId: session.user.id });
  revalidatePath("/trips");
  revalidatePath(`/trips/${id}`);
  return { ok: true };
}

export async function setTripStatus(id: string, status: ShipmentStatus) {
  const { session, orgId } = await requireOrg();
  const trip = await prisma.trip.findFirst({ where: { id, orgId } });
  if (!trip) throw new Error("Trip not found");

  const now = new Date();
  await prisma.trip.update({
    where: { id },
    data: {
      status,
      ...(status === ShipmentStatus.IN_TRANSIT && !trip.startedAt ? { startedAt: now } : {}),
      ...(status === ShipmentStatus.DELIVERED ? { completedAt: now } : {}),
    },
  });

  // Cascade status to shipments belonging to this trip.
  await prisma.shipment.updateMany({
    where: { tripId: id, orgId },
    data: { status },
  });

  await audit({
    action: "trip.setStatus",
    entity: "Trip",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { status },
  });
  revalidatePath("/trips");
  revalidatePath(`/trips/${id}`);
  return { ok: true };
}

export async function assignShipmentToTrip(tripId: string, shipmentId: string) {
  const { session, orgId } = await requireOrg();
  const trip = await prisma.trip.findFirst({ where: { id: tripId, orgId } });
  if (!trip) throw new Error("Trip not found");
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
  if (!shipment) throw new Error("Shipment not found");

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      tripId,
      driverId: trip.driverId ?? shipment.driverId,
      vehicleId: trip.vehicleId ?? shipment.vehicleId,
    },
  });

  await audit({
    action: "trip.assignShipment",
    entity: "Trip",
    entityId: tripId,
    orgId,
    userId: session.user.id,
    meta: { shipmentId },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/shipments");
  return { ok: true };
}

export async function removeShipmentFromTrip(shipmentId: string) {
  const { session, orgId } = await requireOrg();
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, orgId } });
  if (!shipment || !shipment.tripId) throw new Error("Shipment not assigned to a trip");

  const tripId = shipment.tripId;
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { tripId: null },
  });

  await audit({
    action: "trip.removeShipment",
    entity: "Trip",
    entityId: tripId,
    orgId,
    userId: session.user.id,
    meta: { shipmentId },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/shipments");
  return { ok: true };
}

export async function deleteTrip(id: string) {
  const { session, orgId } = await requireOrg();
  const trip = await prisma.trip.findFirst({ where: { id, orgId } });
  if (!trip) throw new Error("Trip not found");

  // Detach shipments first (preserve them).
  await prisma.shipment.updateMany({ where: { tripId: id, orgId }, data: { tripId: null } });
  await prisma.trip.delete({ where: { id } });

  await audit({
    action: "trip.delete",
    entity: "Trip",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/trips");
  return { ok: true };
}

/**
 * Allocate a trip-level expense across the orders that share the trip.
 * Replaces any existing allocations for the expense.
 */
export async function allocateTripExpense(
  expenseId: string,
  method: AllocationMethod,
  manualMap?: Record<string, number>,
) {
  const { session, orgId } = await requireOrg();
  if (!ALLOCATION_METHODS.includes(method)) throw new Error("Invalid allocation method");

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, orgId },
    include: {
      trip: {
        include: {
          shipments: {
            select: {
              orderId: true,
              cargoWeightKg: true,
              cargoVolumeM3: true,
              plannedDistanceKm: true,
              order: { select: { id: true, price: true } },
            },
          },
        },
      },
    },
  });
  if (!expense) throw new Error("Expense not found");
  if (!expense.tripId || !expense.trip) throw new Error("Expense is not trip-scoped");

  // Aggregate per-order totals across the trip's shipments.
  const byOrder = new Map<string, OrderForAllocation>();
  for (const s of expense.trip.shipments) {
    const cur = byOrder.get(s.orderId) ?? {
      orderId: s.orderId,
      weightKg: 0,
      volumeM3: 0,
      distanceKm: 0,
      revenue: Number(s.order.price ?? 0),
    };
    cur.weightKg = (cur.weightKg ?? 0) + Number(s.cargoWeightKg ?? 0);
    cur.volumeM3 = (cur.volumeM3 ?? 0) + Number(s.cargoVolumeM3 ?? 0);
    cur.distanceKm = (cur.distanceKm ?? 0) + Number(s.plannedDistanceKm ?? 0);
    byOrder.set(s.orderId, cur);
  }
  const orders = [...byOrder.values()];
  if (orders.length === 0) throw new Error("Trip has no shipments to allocate to");

  const computed = computeAllocation(Number(expense.amount), method, orders, manualMap);

  await prisma.$transaction([
    prisma.expenseAllocation.deleteMany({ where: { expenseId } }),
    ...computed
      .filter((c) => c.amount !== 0)
      .map((c) =>
        prisma.expenseAllocation.create({
          data: { expenseId, orderId: c.orderId, amount: c.amount, method },
        }),
      ),
  ]);

  await audit({
    action: "expense.allocate",
    entity: "Expense",
    entityId: expenseId,
    orgId,
    userId: session.user.id,
    meta: { method, count: computed.length },
  });

  revalidatePath(`/trips/${expense.tripId}`);
  revalidatePath("/expenses");
  revalidatePath("/orders");
  return { ok: true, allocations: computed };
}
