// NOTE: This file intentionally uses `React.createElement` instead of JSX.
//
// In Next.js 15 App Router, .tsx files imported by route handlers get compiled
// with the *RSC* JSX runtime (`next/dist/.../vendored.react-rsc.ReactJsxRuntime`),
// while the surrounding route handler uses the regular React runtime. The two
// runtimes produce React elements with different internal shapes, and the
// `@react-pdf/renderer` reconciler walks a mixed tree and rejects it with
// "Minified React error #31".
//
// Using `React.createElement` here ensures we depend only on the same `react`
// module the caller uses, avoiding the runtime split.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  BlockId,
  InvoiceTemplate,
  LabelKey,
} from "@/lib/invoice-template";
import { DEFAULT_TEMPLATE } from "@/lib/invoice-template";

const h = React.createElement;

type InvoiceForPdf = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: unknown;
  taxRate: unknown;
  taxAmount: unknown;
  total: unknown;
  paid: unknown;
  status: string;
  customer: {
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    taxId: string | null;
  };
  organization: { name: string; logoUrl?: string | null };
  lines: {
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    total: unknown;
    taxRate?: unknown;
    discount?: unknown;
  }[];
  payments?: {
    paidAt: Date;
    amount: unknown;
    method: string;
    reference: string | null;
  }[];
};

const FALLBACK_LABELS: Record<LabelKey, string> = {
  invoice: "INVOICE",
  billTo: "Bill to",
  qty: "Qty",
  unitPrice: "Unit",
  description: "Description",
  taxRate: "Tax %",
  discount: "Discount",
  lineTotal: "Total",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  paid: "Paid",
  balance: "Balance due",
  notes: "Notes",
  paymentTerms: "Payment terms",
  bankDetails: "Bank details",
  issueDate: "Issue date",
  dueDate: "Due date",
  invoiceNumber: "Invoice no.",
};

function buildStyles(tpl: InvoiceTemplate) {
  const blockMap = new Map(tpl.blocks.map((b) => [b.id, b]));
  const get = (id: BlockId) =>
    blockMap.get(id) ??
    DEFAULT_TEMPLATE.blocks.find((b) => b.id === id) ??
    DEFAULT_TEMPLATE.blocks[0];
  const header = get("header");
  const billTo = get("billTo");
  const details = get("details");
  const table = get("table");
  const totals = get("totals");
  const payments = get("payments");
  const notes = get("notes");
  const paymentTerms = get("paymentTerms");
  const bankDetails = get("bankDetails");
  const footer = get("footer");

  const fontWeight = (w: string) => (w === "bold" ? 700 : w === "medium" ? 500 : 400);

  return {
    blocks: { header, billTo, details, table, totals, payments, notes, paymentTerms, bankDetails, footer },
    styles: StyleSheet.create({
      page: {
        padding: 40,
        fontSize: 10,
        fontFamily:
          tpl.fontFamily === "Times-Roman" ? "Times-Roman" : tpl.fontFamily,
        color: "#111",
        backgroundColor: "#ffffff",
      },
      headerSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: `4pt solid ${tpl.primaryColor}`,
        backgroundColor: header.bgColor,
        fontSize: header.fontSize,
        color: header.color,
      },
      logo: { width: 96, height: 48, objectFit: "contain" },
      h1: {
        fontSize: header.fontSize,
        fontWeight: fontWeight(header.fontWeight),
        color: tpl.primaryColor,
      },
      muted: { color: "#666" },
      billToCard: {
        border: "1pt solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        backgroundColor: billTo.bgColor,
        fontSize: billTo.fontSize,
        color: billTo.color,
      },
      detailsSection: {
        textAlign: details.align,
        fontSize: details.fontSize,
        color: details.color,
        backgroundColor: details.bgColor,
      },
      row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
      },
      table: { marginTop: 12 },
      tableHead: {
        flexDirection: "row",
        backgroundColor: tpl.primaryColor,
        padding: 6,
        fontSize: table.fontSize - 1,
        fontWeight: 700,
        color: "#ffffff",
      },
      tableRow: {
        flexDirection: "row",
        borderBottom: "1pt solid #f1f5f9",
        padding: 6,
        backgroundColor: table.bgColor,
        fontSize: table.fontSize,
        color: table.color,
      },
      cellDesc: { flex: 4 },
      cellNum: { flex: 1.2, textAlign: "right" },
      totalsSection: {
        marginTop: 12,
        marginLeft: "auto",
        width: 260,
        fontSize: totals.fontSize,
        color: totals.color,
        backgroundColor: totals.bgColor,
        textAlign: totals.align,
      },
      grand: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 8,
        paddingRight: 8,
        marginTop: 6,
        borderRadius: 4,
        fontWeight: 700,
        fontSize: totals.fontSize + 2,
        backgroundColor: tpl.accentColor,
      },
      paymentsSection: {
        marginTop: 12,
        fontSize: payments.fontSize,
        color: payments.color,
        backgroundColor: payments.bgColor,
      },
      notesSection: {
        marginTop: 16,
        fontSize: notes.fontSize,
        color: notes.color,
        backgroundColor: notes.bgColor,
        textAlign: notes.align,
        padding: 8,
        borderRadius: 4,
      },
      paymentTermsSection: {
        marginTop: 8,
        fontSize: paymentTerms.fontSize,
        color: paymentTerms.color,
        backgroundColor: paymentTerms.bgColor,
        textAlign: paymentTerms.align,
        padding: 8,
        borderRadius: 4,
      },
      bankDetailsSection: {
        marginTop: 8,
        fontSize: bankDetails.fontSize,
        color: bankDetails.color,
        backgroundColor: bankDetails.bgColor,
        textAlign: bankDetails.align,
        padding: 8,
        borderRadius: 4,
        border: "1pt solid #e5e7eb",
      },
      signature: {
        marginTop: 32,
        paddingTop: 6,
        borderTop: "1pt solid #94a3b8",
        width: 200,
        fontSize: 9,
        color: "#374151",
      },
      footerSection: {
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        fontSize: footer.fontSize,
        color: footer.color,
        textAlign: footer.align,
        borderTop: "1pt solid #e5e7eb",
        paddingTop: 8,
      },
    }),
  };
}

function fmt(n: unknown, cur = "USD") {
  const num = Number(n ?? 0);
  return `${cur} ${num.toFixed(2)}`;
}

function dateOnly(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function InvoicePDF({
  invoice,
  template,
}: {
  invoice: InvoiceForPdf;
  template?: InvoiceTemplate;
}) {
  const tpl = template ?? DEFAULT_TEMPLATE;
  const { styles } = buildStyles(tpl);
  const label = (k: LabelKey) => tpl.labels[k] || FALLBACK_LABELS[k];

  const visible = new Set(
    tpl.blocks.filter((b) => b.visible).map((b) => b.id),
  );
  const pageSize = tpl.pageSize === "Letter" ? "LETTER" : "A4";

  // Renderers keyed by block id; iterated in template.blocks order.
  const renderers: Partial<Record<BlockId, () => React.ReactNode>> = {
    header: () => renderHeader(),
    billTo: () => renderBillTo(),
    table: () => renderTable(),
    totals: () => renderTotals(),
    payments: () => renderPayments(),
    notes: () => renderNotes(),
    paymentTerms: () => renderPaymentTerms(),
    bankDetails: () => renderBankDetails(),
    footer: () => renderFooter(),
  };

  function renderLogo() {
    if (!tpl.showLogo || !invoice.organization.logoUrl) return null;
    return h(Image, { src: invoice.organization.logoUrl, style: styles.logo });
  }

  function renderHeader() {
    const left: React.ReactNode[] = [];
    const right: React.ReactNode[] = [];

    if (tpl.logoPosition === "left") {
      const logo = renderLogo();
      if (logo) left.push(h(View, { key: "logo" }, logo));
    } else {
      const logo = renderLogo();
      if (logo) right.push(h(View, { key: "logo" }, logo));
    }

    left.push(
      h(View, { key: "title" }, [
        h(Text, { key: "t", style: styles.h1 }, label("invoice")),
        h(
          Text,
          { key: "no", style: styles.muted },
          `${label("invoiceNumber")} ${invoice.number}`,
        ),
      ]),
    );

    right.push(
      h(View, { key: "details", style: styles.detailsSection }, [
        h(
          Text,
          { key: "org", style: { fontWeight: 700 } },
          invoice.organization.name,
        ),
        h(
          Text,
          { key: "issue", style: styles.muted },
          `${label("issueDate")}: ${dateOnly(invoice.issueDate)}`,
        ),
        h(
          Text,
          { key: "due", style: styles.muted },
          `${label("dueDate")}: ${dateOnly(invoice.dueDate)}`,
        ),
        h(Text, { key: "status", style: styles.muted }, `Status: ${invoice.status}`),
      ]),
    );

    return h(View, { key: "header", style: styles.headerSection }, [
      h(View, { key: "l" }, left),
      h(View, { key: "r" }, right),
    ]);
  }

  function renderBillTo() {
    const items: React.ReactNode[] = [
      h(
        Text,
        { key: "label", style: { fontWeight: 700, marginBottom: 4 } },
        label("billTo"),
      ),
      h(Text, { key: "name" }, invoice.customer.name),
    ];
    if (invoice.customer.address) {
      items.push(
        h(Text, { key: "addr", style: styles.muted }, invoice.customer.address),
      );
    }
    if (invoice.customer.city || invoice.customer.country) {
      items.push(
        h(
          Text,
          { key: "loc", style: styles.muted },
          [invoice.customer.city, invoice.customer.country]
            .filter(Boolean)
            .join(", "),
        ),
      );
    }
    if (invoice.customer.taxId) {
      items.push(
        h(
          Text,
          { key: "tax", style: styles.muted },
          `Tax ID: ${invoice.customer.taxId}`,
        ),
      );
    }
    return h(View, { key: "billto", style: styles.billToCard }, items);
  }

  function renderTable() {
    const cols = tpl.lineColumns;
    const headCells: React.ReactNode[] = [
      h(Text, { key: "d", style: styles.cellDesc }, label("description")),
    ];
    if (cols.qty)
      headCells.push(h(Text, { key: "q", style: styles.cellNum }, label("qty")));
    if (cols.unitPrice)
      headCells.push(h(Text, { key: "u", style: styles.cellNum }, label("unitPrice")));
    if (cols.taxRate)
      headCells.push(h(Text, { key: "tx", style: styles.cellNum }, label("taxRate")));
    if (cols.discount)
      headCells.push(h(Text, { key: "ds", style: styles.cellNum }, label("discount")));
    if (cols.lineTotal)
      headCells.push(h(Text, { key: "t", style: styles.cellNum }, label("lineTotal")));

    const head = h(View, { key: "head", style: styles.tableHead }, headCells);

    const rows = invoice.lines.map((l, i) => {
      const cells: React.ReactNode[] = [
        h(Text, { key: "d", style: styles.cellDesc }, l.description),
      ];
      if (cols.qty)
        cells.push(
          h(Text, { key: "q", style: styles.cellNum }, String(Number(l.quantity))),
        );
      if (cols.unitPrice)
        cells.push(
          h(Text, { key: "u", style: styles.cellNum }, fmt(l.unitPrice, invoice.currency)),
        );
      if (cols.taxRate)
        cells.push(
          h(Text, { key: "tx", style: styles.cellNum }, `${Number(l.taxRate ?? 0)}%`),
        );
      if (cols.discount)
        cells.push(
          h(Text, { key: "ds", style: styles.cellNum }, fmt(l.discount, invoice.currency)),
        );
      if (cols.lineTotal)
        cells.push(
          h(Text, { key: "t", style: styles.cellNum }, fmt(l.total, invoice.currency)),
        );
      return h(View, { key: `r${i}`, style: styles.tableRow }, cells);
    });

    return h(View, { key: "table", style: styles.table }, [head, ...rows]);
  }

  function renderTotals() {
    const children: React.ReactNode[] = [
      h(View, { key: "sub", style: styles.row }, [
        h(Text, { key: "l" }, label("subtotal")),
        h(Text, { key: "v" }, fmt(invoice.subtotal, invoice.currency)),
      ]),
      h(View, { key: "tax", style: styles.row }, [
        h(Text, { key: "l" }, `${label("tax")} (${Number(invoice.taxRate)}%)`),
        h(Text, { key: "v" }, fmt(invoice.taxAmount, invoice.currency)),
      ]),
      h(View, { key: "grand", style: styles.grand }, [
        h(Text, { key: "l" }, label("total")),
        h(Text, { key: "v" }, fmt(invoice.total, invoice.currency)),
      ]),
    ];
    if (Number(invoice.paid) > 0) {
      children.push(
        h(View, { key: "paid", style: styles.row }, [
          h(Text, { key: "l" }, label("paid")),
          h(Text, { key: "v" }, fmt(invoice.paid, invoice.currency)),
        ]),
      );
    }
    if (Number(invoice.total) - Number(invoice.paid) > 0) {
      children.push(
        h(View, { key: "bal", style: styles.row }, [
          h(Text, { key: "l" }, label("balance")),
          h(
            Text,
            { key: "v" },
            fmt(
              Math.max(0, Number(invoice.total) - Number(invoice.paid)),
              invoice.currency,
            ),
          ),
        ]),
      );
    }
    return h(View, { key: "totals", style: styles.totalsSection }, children);
  }

  function renderPayments() {
    if (!invoice.payments || invoice.payments.length === 0) return null;
    const head = h(View, { key: "head", style: styles.tableHead }, [
      h(Text, { key: "d", style: styles.cellDesc }, "Payments received"),
      h(Text, { key: "q", style: styles.cellNum }, label("issueDate")),
      h(Text, { key: "m", style: styles.cellNum }, "Method"),
      h(Text, { key: "a", style: styles.cellNum }, "Amount"),
    ]);
    const rows = invoice.payments.map((p, i) =>
      h(View, { key: `p${i}`, style: styles.tableRow }, [
        h(
          Text,
          { key: "d", style: styles.cellDesc },
          p.reference ? `Ref ${p.reference}` : "—",
        ),
        h(Text, { key: "q", style: styles.cellNum }, dateOnly(p.paidAt)),
        h(Text, { key: "m", style: styles.cellNum }, p.method),
        h(Text, { key: "a", style: styles.cellNum }, fmt(p.amount, invoice.currency)),
      ]),
    );
    return h(View, { key: "payments", style: styles.paymentsSection }, [head, ...rows]);
  }

  function renderNotes() {
    if (!tpl.notes.trim()) return null;
    return h(View, { key: "notes", style: styles.notesSection }, [
      h(Text, { key: "l", style: { fontWeight: 700, marginBottom: 4 } }, label("notes")),
      h(Text, { key: "v" }, tpl.notes),
    ]);
  }

  function renderPaymentTerms() {
    if (!tpl.paymentTerms.trim()) return null;
    return h(View, { key: "pt", style: styles.paymentTermsSection }, [
      h(
        Text,
        { key: "l", style: { fontWeight: 700, marginBottom: 4 } },
        label("paymentTerms"),
      ),
      h(Text, { key: "v" }, tpl.paymentTerms),
    ]);
  }

  function renderBankDetails() {
    if (!tpl.bankDetails.trim()) return null;
    return h(View, { key: "bd", style: styles.bankDetailsSection }, [
      h(
        Text,
        { key: "l", style: { fontWeight: 700, marginBottom: 4 } },
        label("bankDetails"),
      ),
      h(Text, { key: "v" }, tpl.bankDetails),
    ]);
  }

  function renderFooter() {
    return h(
      Text,
      { key: "footer", style: styles.footerSection },
      tpl.footerText || "Generated by BSC Logistics",
    );
  }

  // Iterate template.blocks in declared order so drag-reorder actually applies.
  const sections: React.ReactNode[] = [];
  for (const block of tpl.blocks) {
    if (!visible.has(block.id)) continue;
    const fn = renderers[block.id];
    if (!fn) continue;
    const node = fn();
    if (node) sections.push(node);
  }

  if (tpl.signature.enabled) {
    sections.push(
      h(View, { key: "sig", style: styles.signature }, [
        h(Text, { key: "v" }, tpl.signature.label || "Authorized signature"),
      ]),
    );
  }

  return h(
    Document,
    null,
    h(Page, { size: pageSize, style: styles.page }, sections),
  );
}
