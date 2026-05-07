"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber, generateTrackingCode } from "@/lib/utils";
import { OrderStatus, ShipmentStatus, StopKind } from "@/lib/enums";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";
import { applyOrderConfirmationSideEffects } from "../quotations/actions";

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
  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.ORDER,
    recordId: order.id,
    formData,
  });

  // Create an initial shipment with two stops, linked via the join table
  const shipment = await prisma.shipment.create({
    data: {
      orgId,
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
      orderLinks: { create: { orderId: order.id, sortOrder: 0 } },
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

  const isConfirmingOrLater =
    status === OrderStatus.CONFIRMED ||
    status === OrderStatus.IN_PROGRESS ||
    status === OrderStatus.COMPLETED;

  const sideEffects = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirstOrThrow({
      where: { id, orgId },
      select: { id: true, status: true, confirmedAt: true },
    });

    await tx.order.update({
      where: { id },
      data: {
        status,
        confirmedAt:
          isConfirmingOrLater && !existing.confirmedAt
            ? new Date()
            : existing.confirmedAt,
      },
    });

    if (isConfirmingOrLater) {
      return applyOrderConfirmationSideEffects(tx, id);
    }
    return { activatedCustomer: false, wonLead: false, wonQuotation: false };
  });

  await audit({
    action: "order.updateStatus",
    entity: "Order",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: {
      status,
      activatedCustomer: sideEffects.activatedCustomer,
      wonLead: sideEffects.wonLead,
      wonQuotation: sideEffects.wonQuotation,
    },
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  if (sideEffects.activatedCustomer) revalidatePath("/customers");
  if (sideEffects.wonLead) revalidatePath("/leads");
  if (sideEffects.wonQuotation) revalidatePath("/quotations");
  return { ok: true, ...sideEffects };
}
