"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";

const NONE = "__none__";
const optionalRef = z
  .string()
  .optional()
  .transform((v) => (!v || v === NONE ? undefined : v));

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  currency: z.string().default("USD"),
  vendor: z.string().optional(),
  incurredAt: z.string().optional(),
  // Scope refs
  orderId: optionalRef,
  tripId: optionalRef,
  shipmentId: optionalRef,
  driverId: optionalRef,
  vehicleId: optionalRef,
  // Billing
  billable: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function createExpense(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const data = expenseSchema.parse(Object.fromEntries(formData.entries()));

  const expense = await prisma.expense.create({
    data: {
      orgId,
      category: data.category,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      vendor: data.vendor || null,
      incurredAt: data.incurredAt ? new Date(data.incurredAt) : new Date(),
      orderId: data.orderId ?? null,
      tripId: data.tripId ?? null,
      shipmentId: data.shipmentId ?? null,
      driverId: data.driverId ?? null,
      vehicleId: data.vehicleId ?? null,
      billable: data.billable ?? false,
    },
  });

  await audit({
    action: "expense.create",
    entity: "Expense",
    entityId: expense.id,
    orgId,
    userId: session.user.id,
    meta: { category: data.category, amount: data.amount },
  });

  revalidatePath("/expenses");
  if (data.tripId) revalidatePath(`/trips/${data.tripId}`);
  if (data.orderId) revalidatePath(`/orders/${data.orderId}`);
  return { ok: true, id: expense.id };
}

export async function updateExpense(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.expense.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error("Expense not found");

  const data = expenseSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.expense.update({
    where: { id },
    data: {
      category: data.category,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      vendor: data.vendor || null,
      incurredAt: data.incurredAt ? new Date(data.incurredAt) : existing.incurredAt,
      orderId: data.orderId ?? null,
      tripId: data.tripId ?? null,
      shipmentId: data.shipmentId ?? null,
      driverId: data.driverId ?? null,
      vehicleId: data.vehicleId ?? null,
      billable: data.billable ?? false,
    },
  });

  await audit({
    action: "expense.update",
    entity: "Expense",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { category: data.category, amount: data.amount },
  });

  revalidatePath("/expenses");
  if (data.tripId) revalidatePath(`/trips/${data.tripId}`);
  if (data.orderId) revalidatePath(`/orders/${data.orderId}`);
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.expense.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error("Expense not found");

  await prisma.expense.delete({ where: { id } });

  await audit({
    action: "expense.delete",
    entity: "Expense",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/expenses");
  if (existing.tripId) revalidatePath(`/trips/${existing.tripId}`);
  if (existing.orderId) revalidatePath(`/orders/${existing.orderId}`);
  return { ok: true };
}
