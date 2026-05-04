import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InvoicePDF } from "@/components/app/invoice-pdf";
import {
  parseTemplate,
  type InvoiceTemplate,
  type LabelKey,
} from "@/lib/invoice-template";
import { buildSampleInvoice } from "@/lib/invoice-sample";

/**
 * Preview endpoint used by the Invoice Designer iframe. POSTed with
 * `{ template, source }` — `source` is "sample" (static seed) or "latest"
 * (the org's most recent invoice). Returns the rendered PDF so the user can
 * see the *unsaved* template applied to real data.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const orgId = session.user.orgId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const payload = body as {
    template?: unknown;
    source?: "sample" | "latest";
  };
  const source = payload.source === "latest" ? "latest" : "sample";

  // Trust the template payload through `parseTemplate` so missing keys merge
  // into defaults. This also defends against the client sending a partial
  // tree from an in-progress edit.
  const tpl: InvoiceTemplate = parseTemplate(
    typeof payload.template === "string"
      ? payload.template
      : JSON.stringify(payload.template ?? {}),
  );

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, logoUrl: true, locale: true, baseCurrency: true },
  });

  let invoice: Parameters<typeof InvoicePDF>[0]["invoice"] | null = null;

  if (source === "latest") {
    const latest = await prisma.invoice.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        lines: true,
        payments: { orderBy: { paidAt: "asc" } },
      },
    });
    if (latest) {
      invoice = {
        number: latest.number,
        issueDate: latest.issueDate,
        dueDate: latest.dueDate,
        currency: latest.currency,
        subtotal: Number(latest.subtotal),
        taxRate: Number(latest.taxRate),
        taxAmount: Number(latest.taxAmount),
        total: Number(latest.total),
        paid: Number(latest.paid),
        status: latest.status,
        customer: {
          name: latest.customer.name,
          address: latest.customer.address ?? null,
          city: latest.customer.city ?? null,
          country: latest.customer.country ?? null,
          taxId: latest.customer.taxId ?? null,
        },
        organization: {
          name: org?.name ?? "Your Company",
          logoUrl: org?.logoUrl ?? null,
        },
        lines: latest.lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          total: Number(l.total),
        })),
        payments: latest.payments.map((p) => ({
          paidAt: p.paidAt,
          amount: Number(p.amount),
          method: p.method,
          reference: p.reference ?? null,
        })),
      };
    }
  }

  if (!invoice) {
    invoice = buildSampleInvoice({
      organizationName: org?.name,
      logoUrl: org?.logoUrl ?? null,
      currency: org?.baseCurrency ?? "USD",
    });
  }

  // Resolve translated default labels (template overrides win).
  const resolved = await resolveLocalizedTemplate(tpl, org?.locale ?? "en");

  try {
    const element = React.createElement(InvoicePDF, {
      invoice,
      template: resolved,
    }) as React.ReactElement;
    const buffer = await renderToBuffer(element);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[invoice preview]", e);
    return new NextResponse("Failed to render preview", { status: 500 });
  }
}

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
  return { ...template, labels: { ...defaults, ...template.labels } };
}
