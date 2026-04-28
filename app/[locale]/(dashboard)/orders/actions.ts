"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber, generateTrackingCode } from "@/lib/utils";
import { OrderStatus, ShipmentStatus, StopKind } from "@/lib/enums";

const orderSchema = z.object({
  customerId: z.string().min(1),
  reference: z.string().optional(),
  price: z.coerce.number().min(0).default(0),
  currency: z.string().default("USD"),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.QUOTE),
  notes: z.string().optional(),
  pickupAddress: z.string().min(1),
  pickupCity: z.string().optional(),
  pickupCountry: z.string().optional(),
  dropoffAddress: z.string().min(1),
  dropoffCity: z.string().optional(),
  dropoffCountry: z.string().optional(),
  cargoType: z.string().optional(),
  cargoWeightKg: z.coerce.number().min(0).optional(),
});

export async function createOrder(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const data = orderSchema.parse(Object.fromEntries(formData.entries()));

  const order = await prisma.order.create({
    data: {
      orgId,
      customerId: data.customerId,
      number: generateNumber("ORD"),
      price: data.price,
      currency: data.currency,
      status: data.status,
      reference: data.reference || null,
      notes: data.notes || null,
    },
  });

  // Create an initial shipment with two stops
  const shipment = await prisma.shipment.create({
    data: {
      orgId,
      orderId: order.id,
      number: generateNumber("SHP"),
      trackingCode: generateTrackingCode(),
      status: ShipmentStatus.PLANNED,
      cargoType: data.cargoType || null,
      cargoWeightKg: data.cargoWeightKg ?? null,
      stops: {
        create: [
          {
            sequence: 1,
            kind: StopKind.PICKUP,
            address: data.pickupAddress,
            city: data.pickupCity || null,
            country: data.pickupCountry || null,
          },
          {
            sequence: 2,
            kind: StopKind.DROPOFF,
            address: data.dropoffAddress,
            city: data.dropoffCity || null,
            country: data.dropoffCountry || null,
          },
        ],
      },
      events: { create: { type: "CREATED", note: "Order & shipment created" } },
    },
  });

  await audit({
    action: "order.create",
    entity: "Order",
    entityId: order.id,
    orgId,
    userId: session.user.id,
    meta: { shipmentId: shipment.id },
  });
  revalidatePath("/orders");
  revalidatePath("/shipments");
  return { ok: true, id: order.id };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { session, orgId } = await requireOrg();
  await prisma.order.update({ where: { id, orgId }, data: { status } });
  await audit({
    action: "order.updateStatus",
    entity: "Order",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { status },
  });
  revalidatePath("/orders");
  return { ok: true };
}
