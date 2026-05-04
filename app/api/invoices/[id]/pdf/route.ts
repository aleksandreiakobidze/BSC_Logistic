import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { InvoicePDF } from "@/components/app/invoice-pdf";
import {
  parseTemplate,
  type InvoiceTemplate,
  type LabelKey,
} from "@/lib/invoice-template";

/**
 * Resolve translated default labels for the invoice PDF using the org's
 * configured locale. The user's per-template overrides (if any) win — these
 * just fill in defaults so a Georgian/Russian org doesn't get English column
 * headers.
 */
async function resolveLocalizedTemplate(
  template: InvoiceTemplate,
  locale: string,
): Promise<InvoiceTemplate> {
  let t: Awaited<ReturnType<typeof getTranslations>>;
  try {
    t = await getTranslations({ locale, namespace: "invoices" });
  } catch {
    return template;
  }

  const tx = (key: string, fb: string): string => (t.has(key) ? t(key) : fb);

  const defaults: Partial<Record<LabelKey, string>> = {
    invoice: tx("title", "INVOICE"),
    billTo: tx("billTo", "Bill to"),
    qty: tx("quantity", "Qty"),
    unitPrice: tx("unitPrice", "Unit price"),
    description: tx("description", "Description"),
    taxRate: tx("taxRate", "Tax %"),
    discount: tx("discount", "Discount"),
    lineTotal: tx("lineTotal", "Total"),
    subtotal: tx("subtotal", "Subtotal"),
    tax: tx("tax", "Tax"),
    total: tx("total", "Total"),
    paid: tx("paid", "Paid"),
    balance: tx("balanceDue", "Balance due"),
    notes: tx("notes", "Notes"),
    paymentTerms: tx("paymentTerms", "Payment terms"),
    bankDetails: tx("bankDetails", "Bank details"),
    issueDate: tx("issueDate", "Issue date"),
    dueDate: tx("dueDate", "Due date"),
    invoiceNumber: tx("number", "Invoice no."),
  };

  return {
    ...template,
    // Template overrides win; otherwise fall back to translated default.
    labels: { ...defaults, ...template.labels },
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      OR: [
        { orgId: session.user.orgId ?? undefined },
        { customerId: session.user.customerId ?? undefined },
      ],
    },
    include: {
      customer: true,
      organization: {
        select: {
          name: true,
          invoiceTemplate: true,
          logoUrl: true,
          locale: true,
        },
      },
      lines: true,
      order: true,
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  try {
    const baseTemplate = parseTemplate(invoice.organization.invoiceTemplate);
    const template = await resolveLocalizedTemplate(
      baseTemplate,
      invoice.organization.locale ?? "en",
    );
    const element = React.createElement(InvoicePDF, {
      invoice,
      template,
    }) as React.ReactElement;
    const buffer = await renderToBuffer(element);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[invoice pdf]", e);
    return new NextResponse("Failed to render PDF", { status: 500 });
  }
}
