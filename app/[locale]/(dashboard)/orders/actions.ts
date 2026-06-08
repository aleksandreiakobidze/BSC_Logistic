"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber } from "@/lib/utils";
import {
  OrderStatus,
  QuotationActivityKind,
  QuotationStatus,
} from "@/lib/enums";
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

  await audit({
    action: "order.create",
    entity: "Order",
    entityId: order.id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/orders");
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

/**
 * Send an order back to its source quotation in DRAFT mode.
 *
 * Only safe while the order has produced no fulfilment artifacts:
 * status must still be QUOTE, and there must be zero shipments,
 * invoices, or expenses linked to it. The order row is deleted -
 * `OrderLine` cascades via the existing `onDelete: Cascade` relation.
 */
export async function revertOrderToQuotation(orderId: string) {
  const { session, orgId } = await requireOrg();

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId, orgId },
      select: {
        id: true,
        number: true,
        status: true,
        sourceQuotationId: true,
        _count: {
          select: {
            shipmentLinks: true,
            invoices: true,
            expenses: true,
          },
        },
      },
    });

    if (order.status !== OrderStatus.QUOTE) {
      throw new Error("Cannot revert: order is past QUOTE status");
    }
    if (order._count.shipmentLinks > 0) {
      throw new Error("Cannot revert: this order has shipments");
    }
    if (order._count.invoices > 0) {
      throw new Error("Cannot revert: this order has invoices");
    }
    if (order._count.expenses > 0) {
      throw new Error("Cannot revert: this order has expenses");
    }

    const quotationId = order.sourceQuotationId;

    if (quotationId) {
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: QuotationStatus.DRAFT,
          convertedAt: null,
        },
      });
      await tx.quotationActivity.create({
        data: {
          quotationId,
          userId: session.user.id,
          kind: QuotationActivityKind.STATUS_CHANGE,
          note: `Reverted from order ${order.number} back to draft`,
        },
      });
    }

    await tx.order.delete({ where: { id: orderId } });

    return { quotationId, orderNumber: order.number };
  });

  await audit({
    action: "order.revertToQuotation",
    entity: "Order",
    entityId: orderId,
    orgId,
    userId: session.user.id,
    meta: {
      quotationId: result.quotationId,
      orderNumber: result.orderNumber,
    },
  });

  revalidatePath("/orders");
  revalidatePath("/quotations");
  revalidatePath("/portal/orders");
  revalidatePath("/portal/quotations");
  if (result.quotationId) {
    revalidatePath(`/quotations/${result.quotationId}`);
  }

  return { ok: true, quotationId: result.quotationId };
}
