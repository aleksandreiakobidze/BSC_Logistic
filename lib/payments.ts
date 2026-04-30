import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { InvoiceStatus, PaymentKind } from "@/lib/enums";

type Tx = Prisma.TransactionClient | PrismaClient;

const TERMINAL_STATUSES = new Set<string>([
  InvoiceStatus.DRAFT,
  InvoiceStatus.CANCELLED,
]);

export interface InvoiceState {
  id: string;
  total: number;
  paid: number;
  balanceDue: number;
  status: string;
}

/**
 * Recalculates an invoice's `paid` amount and derived `status` from its
 * Payment ledger. Skips DRAFT/CANCELLED invoices (manual states).
 */
export async function recomputeInvoiceState(
  tx: Tx,
  invoiceId: string,
): Promise<InvoiceState> {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, total: true, dueDate: true, status: true },
  });
  if (!inv) {
    throw new Error("Invoice not found");
  }

  const sum = await tx.payment.aggregate({
    where: { invoiceId, kind: PaymentKind.RECEIVABLE },
    _sum: { amount: true },
  });

  const total = Number(inv.total);
  const paid = Math.max(0, Math.round(Number(sum._sum.amount ?? 0) * 100) / 100);
  const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);

  let status = inv.status;
  if (!TERMINAL_STATUSES.has(inv.status)) {
    if (paid >= total && total > 0) {
      status = InvoiceStatus.PAID;
    } else if (paid > 0) {
      status = InvoiceStatus.PARTIAL;
    } else if (inv.dueDate.getTime() < Date.now()) {
      status = InvoiceStatus.OVERDUE;
    } else {
      status = InvoiceStatus.SENT;
    }
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paid, status },
  });

  return { id: inv.id, total, paid, balanceDue, status };
}

/**
 * Recompute Customer.balance = sum of (invoice.total - invoice.paid) for
 * invoices in SENT / PARTIAL / OVERDUE states.
 */
export async function recomputeCustomerBalance(
  tx: Tx,
  customerId: string,
): Promise<number> {
  const open = await tx.invoice.findMany({
    where: {
      customerId,
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIAL,
          InvoiceStatus.OVERDUE,
        ],
      },
    },
    select: { total: true, paid: true },
  });

  const balance = open.reduce(
    (acc, i) => acc + Math.max(0, Number(i.total) - Number(i.paid)),
    0,
  );
  const rounded = Math.round(balance * 100) / 100;

  await tx.customer.update({
    where: { id: customerId },
    data: { balance: rounded },
  });

  return rounded;
}

/**
 * Promote SENT/PARTIAL invoices whose due date has passed to OVERDUE.
 * Returns number of invoices flipped.
 */
export async function refreshOverdueInvoices(orgId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.invoice.updateMany({
    where: {
      orgId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL] },
      dueDate: { lt: now },
      paid: { equals: 0 },
    },
    data: { status: InvoiceStatus.OVERDUE },
  });
  return result.count;
}

export function invoiceBalanceDue(
  total: number | string | { toString(): string },
  paid: number | string | { toString(): string },
): number {
  const t = typeof total === "object" ? Number(total.toString()) : Number(total);
  const p = typeof paid === "object" ? Number(paid.toString()) : Number(paid);
  return Math.max(0, Math.round((t - p) * 100) / 100);
}
