"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import {
  recomputeCustomerBalance,
  recomputeInvoiceState,
  invoiceBalanceDue,
} from "@/lib/payments";
import { PaymentKind, PaymentMethod } from "@/lib/enums";

const methodSchema = z.enum([
  PaymentMethod.CASH,
  PaymentMethod.BANK,
  PaymentMethod.CARD,
  PaymentMethod.OTHER,
]);

const recordInvoicePaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: methodSchema.default(PaymentMethod.BANK),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export async function recordInvoicePayment(
  input: z.infer<typeof recordInvoicePaymentSchema>,
) {
  const { session, orgId } = await requireOrg();
  const data = recordInvoicePaymentSchema.parse(input);

  const inv = await prisma.invoice.findFirst({
    where: { id: data.invoiceId, orgId },
    select: {
      id: true,
      total: true,
      paid: true,
      currency: true,
      customerId: true,
    },
  });
  if (!inv) {
    return { ok: false, error: "Invoice not found" } as const;
  }

  const balanceDue = invoiceBalanceDue(inv.total, inv.paid);
  if (data.amount > balanceDue + 0.001) {
    return {
      ok: false,
      error: "Amount exceeds balance due",
      balanceDue,
    } as const;
  }

  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orgId,
        kind: PaymentKind.RECEIVABLE,
        amount: data.amount,
        currency: inv.currency,
        method: data.method,
        reference: data.reference ?? null,
        note: data.note ?? null,
        paidAt,
        invoiceId: inv.id,
        customerId: inv.customerId,
        createdById: session.user.id,
      },
    });
    const state = await recomputeInvoiceState(tx, inv.id);
    await recomputeCustomerBalance(tx, inv.customerId);
    return { payment, state };
  });

  await audit({
    action: "payment.create",
    entity: "Payment",
    entityId: result.payment.id,
    orgId,
    userId: session.user.id,
    meta: {
      kind: PaymentKind.RECEIVABLE,
      amount: data.amount,
      method: data.method,
      invoiceId: inv.id,
      customerId: inv.customerId,
    },
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${inv.id}`);
  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath(`/customers/${inv.customerId}`);
  revalidatePath("/reports");

  return { ok: true as const, paymentId: result.payment.id, state: result.state };
}

export async function voidInvoicePayment(paymentId: string) {
  const { session, orgId } = await requireOrg();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orgId, kind: PaymentKind.RECEIVABLE },
  });
  if (!payment) {
    return { ok: false, error: "Payment not found" } as const;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } });
    if (payment.invoiceId) {
      await recomputeInvoiceState(tx, payment.invoiceId);
    }
    if (payment.customerId) {
      await recomputeCustomerBalance(tx, payment.customerId);
    }
  });

  await audit({
    action: "payment.void",
    entity: "Payment",
    entityId: paymentId,
    orgId,
    userId: session.user.id,
    meta: {
      kind: payment.kind,
      amount: Number(payment.amount),
      invoiceId: payment.invoiceId,
      customerId: payment.customerId,
    },
  });

  revalidatePath("/invoices");
  if (payment.invoiceId) revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/payments");
  revalidatePath("/customers");
  if (payment.customerId) revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/reports");

  return { ok: true as const };
}

const recordSettlementPayoutSchema = z.object({
  settlementId: z.string().min(1),
  method: methodSchema.default(PaymentMethod.BANK),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export async function recordSettlementPayout(
  input: z.infer<typeof recordSettlementPayoutSchema>,
) {
  const { session, orgId } = await requireOrg();
  const data = recordSettlementPayoutSchema.parse(input);

  const settlement = await prisma.settlement.findFirst({
    where: { id: data.settlementId, orgId },
    select: {
      id: true,
      driverId: true,
      net: true,
      currency: true,
      paidAt: true,
    },
  });
  if (!settlement) {
    return { ok: false, error: "Settlement not found" } as const;
  }
  if (settlement.paidAt) {
    return { ok: false, error: "Settlement already paid" } as const;
  }

  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orgId,
        kind: PaymentKind.SETTLEMENT_PAYOUT,
        amount: settlement.net,
        currency: settlement.currency ?? "USD",
        method: data.method,
        reference: data.reference ?? null,
        note: data.note ?? null,
        paidAt,
        settlementId: settlement.id,
        driverId: settlement.driverId,
        createdById: session.user.id,
      },
    });
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { paidAt },
    });
    return { payment };
  });

  await audit({
    action: "settlement.payout",
    entity: "Payment",
    entityId: result.payment.id,
    orgId,
    userId: session.user.id,
    meta: {
      kind: PaymentKind.SETTLEMENT_PAYOUT,
      amount: Number(settlement.net),
      method: data.method,
      settlementId: settlement.id,
      driverId: settlement.driverId,
    },
  });

  revalidatePath("/payments");
  revalidatePath("/drivers/settlements");
  revalidatePath(`/drivers/settlements/${settlement.id}`);
  revalidatePath(`/drivers/${settlement.driverId}`);
  revalidatePath("/reports");

  return { ok: true as const, paymentId: result.payment.id };
}

export async function voidSettlementPayout(paymentId: string) {
  const { session, orgId } = await requireOrg();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orgId, kind: PaymentKind.SETTLEMENT_PAYOUT },
  });
  if (!payment) {
    return { ok: false, error: "Payout not found" } as const;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } });
    if (payment.settlementId) {
      await tx.settlement.update({
        where: { id: payment.settlementId },
        data: { paidAt: null },
      });
    }
  });

  await audit({
    action: "settlement.payout.void",
    entity: "Payment",
    entityId: paymentId,
    orgId,
    userId: session.user.id,
    meta: {
      kind: payment.kind,
      amount: Number(payment.amount),
      settlementId: payment.settlementId,
      driverId: payment.driverId,
    },
  });

  revalidatePath("/payments");
  revalidatePath("/drivers/settlements");
  if (payment.settlementId)
    revalidatePath(`/drivers/settlements/${payment.settlementId}`);
  revalidatePath("/reports");

  return { ok: true as const };
}

export interface SearchPaymentsFilters {
  kind?: "RECEIVABLE" | "SETTLEMENT_PAYOUT";
  customerId?: string;
  driverId?: string;
  method?: string;
  from?: string;
  to?: string;
  q?: string;
  take?: number;
  skip?: number;
}

export async function searchPayments(filters: SearchPaymentsFilters = {}) {
  const { orgId } = await requireOrg();

  const where: Prisma.PaymentWhereInput = { orgId };
  if (filters.kind) where.kind = filters.kind;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.driverId) where.driverId = filters.driverId;
  if (filters.method) where.method = filters.method;
  if (filters.from || filters.to) {
    where.paidAt = {};
    if (filters.from) (where.paidAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
    if (filters.to) (where.paidAt as Prisma.DateTimeFilter).lte = new Date(filters.to);
  }
  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { reference: { contains: q } },
      { note: { contains: q } },
      { invoice: { number: { contains: q } } },
      { customer: { name: { contains: q } } },
      { driver: { firstName: { contains: q } } },
      { driver: { lastName: { contains: q } } },
    ];
  }

  const take = Math.min(Math.max(filters.take ?? 100, 1), 500);
  const skip = Math.max(filters.skip ?? 0, 0);

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take,
      skip,
      include: {
        invoice: { select: { id: true, number: true, total: true, currency: true } },
        customer: { select: { id: true, name: true } },
        settlement: { select: { id: true, periodFrom: true, periodTo: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total };
}
