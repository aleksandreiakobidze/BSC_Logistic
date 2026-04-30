"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { generateNumber } from "@/lib/utils";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";
import { recomputeCustomerBalance, invoiceBalanceDue } from "@/lib/payments";
import { recordInvoicePayment } from "../payments/actions";

const lineKindSchema = z.enum(["ORDER", "EXPENSE", "TRIP", "MANUAL"]);

const lineSchema = z.object({
  kind: lineKindSchema,
  orderId: z.string().nullable().optional(),
  expenseId: z.string().nullable().optional(),
  tripId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
});

const schema = z.object({
  customerId: z.string().min(1),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().default("USD"),
  dueDate: z.string().min(1),
  lines: z.array(lineSchema).min(1, "At least one line is required"),
});

interface CreateInvoiceInput {
  customerId: string;
  taxRate: number;
  currency: string;
  dueDate: string;
  lines: z.infer<typeof lineSchema>[];
  customFieldsJson?: string;
}

export async function createInvoice(input: CreateInvoiceInput) {
  const { session, orgId } = await requireOrg();
  const data = schema.parse(input);

  const subtotal = data.lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unitPrice), 0);
  const taxAmount = (subtotal * data.taxRate) / 100;
  const total = subtotal + taxAmount;

  // Use the first ORDER line's orderId for backward-compat invoice.orderId
  const firstOrderLine = data.lines.find((l) => l.kind === "ORDER" && l.orderId);

  const inv = await prisma.invoice.create({
    data: {
      orgId,
      customerId: data.customerId,
      orderId: firstOrderLine?.orderId || null,
      number: generateNumber("INV"),
      issueDate: new Date(),
      dueDate: new Date(data.dueDate),
      subtotal,
      taxRate: data.taxRate,
      taxAmount,
      total,
      currency: data.currency,
      status: "SENT",
      lines: {
        create: data.lines.map((l) => ({
          kind: l.kind,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: Number(l.quantity) * Number(l.unitPrice),
          orderId: l.kind === "ORDER" ? l.orderId || null : null,
          tripId: l.kind === "TRIP" ? l.tripId || null : null,
        })),
      },
    },
    include: { lines: true },
  });

  // Link any EXPENSE-kind lines back to their source expenses by index.
  for (let i = 0; i < data.lines.length; i++) {
    const inputLine = data.lines[i];
    const created = inv.lines[i];
    if (inputLine.kind === "EXPENSE" && inputLine.expenseId && created) {
      await prisma.expense.update({
        where: { id: inputLine.expenseId },
        data: { invoiceLineId: created.id },
      });
    }
  }

  if (input.customFieldsJson) {
    const fd = new FormData();
    fd.set("__customFields__", input.customFieldsJson);
    try {
      const parsed = JSON.parse(input.customFieldsJson) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined && v !== null) fd.set(k, String(v));
      }
    } catch {
      /* ignore */
    }
    await saveCustomFieldValues({
      orgId,
      entityType: CustomFieldEntity.INVOICE,
      recordId: inv.id,
      formData: fd,
    });
  }

  await audit({
    action: "invoice.create",
    entity: "Invoice",
    entityId: inv.id,
    orgId,
    userId: session.user.id,
    meta: { lineCount: data.lines.length, total },
  });

  await recomputeCustomerBalance(prisma, data.customerId);

  revalidatePath("/invoices");
  revalidatePath("/customers");
  revalidatePath(`/customers/${data.customerId}`);
  return { ok: true, id: inv.id };
}

export async function markInvoicePaid(id: string) {
  const { orgId } = await requireOrg();
  const inv = await prisma.invoice.findFirst({
    where: { id, orgId },
    select: { id: true, total: true, paid: true },
  });
  if (!inv) return { ok: false, error: "Invoice not found" };
  const balanceDue = invoiceBalanceDue(inv.total, inv.paid);
  if (balanceDue <= 0) return { ok: true, alreadyPaid: true };
  return await recordInvoicePayment({
    invoiceId: id,
    amount: balanceDue,
    method: "BANK",
  });
}
