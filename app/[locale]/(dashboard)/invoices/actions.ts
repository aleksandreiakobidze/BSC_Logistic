"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().optional(),
  description: z.string().min(1),
  subtotal: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().default("USD"),
  dueDate: z.string().min(1),
});

export async function createInvoice(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const data = schema.parse(Object.fromEntries(formData.entries()));
  const taxAmount = (data.subtotal * data.taxRate) / 100;
  const total = data.subtotal + taxAmount;

  const inv = await prisma.invoice.create({
    data: {
      orgId,
      customerId: data.customerId,
      orderId: data.orderId || null,
      number: generateNumber("INV"),
      issueDate: new Date(),
      dueDate: new Date(data.dueDate),
      subtotal: data.subtotal,
      taxRate: data.taxRate,
      taxAmount,
      total,
      currency: data.currency,
      status: "SENT",
      lines: {
        create: [{ description: data.description, quantity: 1, unitPrice: data.subtotal, total: data.subtotal }],
      },
    },
  });
  await audit({ action: "invoice.create", entity: "Invoice", entityId: inv.id, orgId, userId: session.user.id });
  revalidatePath("/invoices");
  return { ok: true, id: inv.id };
}

export async function markInvoicePaid(id: string) {
  const { session, orgId } = await requireOrg();
  const inv = await prisma.invoice.update({
    where: { id, orgId },
    data: { status: "PAID", paid: (await prisma.invoice.findUnique({ where: { id } }))!.total },
  });
  await prisma.payment.create({ data: { invoiceId: inv.id, amount: inv.total, method: "BANK" } });
  await audit({ action: "invoice.paid", entity: "Invoice", entityId: id, orgId, userId: session.user.id });
  revalidatePath("/invoices");
  return { ok: true };
}
