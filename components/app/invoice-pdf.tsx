import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceTemplate } from "@/lib/invoice-template";
import { DEFAULT_TEMPLATE, parseTemplate } from "@/lib/invoice-template";

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
  customer: { name: string; address: string | null; city: string | null; country: string | null; taxId: string | null };
  organization: { name: string };
  lines: { description: string; quantity: unknown; unitPrice: unknown; total: unknown }[];
  payments?: {
    paidAt: Date;
    amount: unknown;
    method: string;
    reference: string | null;
  }[];
};

function buildStyles(tpl: InvoiceTemplate) {
  const blockMap = new Map(tpl.blocks.map((b) => [b.id, b]));
  const header = blockMap.get("header") ?? DEFAULT_TEMPLATE.blocks[0];
  const billTo = blockMap.get("billTo") ?? DEFAULT_TEMPLATE.blocks[1];
  const details = blockMap.get("details") ?? DEFAULT_TEMPLATE.blocks[2];
  const table = blockMap.get("table") ?? DEFAULT_TEMPLATE.blocks[3];
  const totals = blockMap.get("totals") ?? DEFAULT_TEMPLATE.blocks[4];
  const notes = blockMap.get("notes") ?? DEFAULT_TEMPLATE.blocks[5];
  const footer = blockMap.get("footer") ?? DEFAULT_TEMPLATE.blocks[6];

  return {
    blocks: { header, billTo, details, table, totals, notes, footer },
    styles: StyleSheet.create({
      page: {
        padding: 40,
        fontSize: 10,
        fontFamily: tpl.fontFamily === "Times-Roman" ? "Times-Roman" : tpl.fontFamily,
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
      h1: {
        fontSize: header.fontSize,
        fontWeight: header.fontWeight === "bold" ? 700 : 400,
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
      row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
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
      cellQty: { flex: 1, textAlign: "right" },
      cellPrice: { flex: 1.5, textAlign: "right" },
      cellTotal: { flex: 1.5, textAlign: "right" },
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
      notesSection: {
        marginTop: 16,
        fontSize: notes.fontSize,
        color: notes.color,
        backgroundColor: notes.bgColor,
        textAlign: notes.align,
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

function f(n: unknown, cur = "USD") {
  const num = Number(n ?? 0);
  return `${cur} ${num.toFixed(2)}`;
}

function d(date: Date) {
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
  const { blocks, styles } = buildStyles(tpl);

  // Build ordered visible block ids from template
  const orderedBlocks = tpl.blocks.map((b) => b.id);
  const visible = new Set(tpl.blocks.filter((b) => b.visible).map((b) => b.id));

  const pageSize = tpl.pageSize === "Letter" ? "LETTER" : "A4";

  return (
    <Document>
      <Page size={pageSize} style={styles.page}>
        {/* Header */}
        {visible.has("header") && (
          <View style={styles.headerSection}>
            <View>
              <Text style={styles.h1}>INVOICE</Text>
              <Text style={styles.muted}>#{invoice.number}</Text>
            </View>
            <View style={styles.detailsSection}>
              <Text style={{ fontWeight: 700 }}>{invoice.organization.name}</Text>
              <Text style={styles.muted}>Issue date: {d(invoice.issueDate)}</Text>
              <Text style={styles.muted}>Due date: {d(invoice.dueDate)}</Text>
              <Text style={styles.muted}>Status: {invoice.status}</Text>
            </View>
          </View>
        )}

        {/* Bill to */}
        {visible.has("billTo") && (
          <View style={styles.billToCard}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Bill to</Text>
            <Text>{invoice.customer.name}</Text>
            {invoice.customer.address && (
              <Text style={styles.muted}>{invoice.customer.address}</Text>
            )}
            {(invoice.customer.city || invoice.customer.country) && (
              <Text style={styles.muted}>
                {[invoice.customer.city, invoice.customer.country]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}
            {invoice.customer.taxId && (
              <Text style={styles.muted}>Tax ID: {invoice.customer.taxId}</Text>
            )}
          </View>
        )}

        {/* Line items */}
        {visible.has("table") && (
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.cellDesc}>Description</Text>
              <Text style={styles.cellQty}>Qty</Text>
              <Text style={styles.cellPrice}>Unit</Text>
              <Text style={styles.cellTotal}>Total</Text>
            </View>
            {invoice.lines.map((l, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cellDesc}>{l.description}</Text>
                <Text style={styles.cellQty}>{Number(l.quantity)}</Text>
                <Text style={styles.cellPrice}>{f(l.unitPrice, invoice.currency)}</Text>
                <Text style={styles.cellTotal}>{f(l.total, invoice.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        {visible.has("totals") && (
          <View style={styles.totalsSection}>
            <View style={styles.row}>
              <Text>Subtotal</Text>
              <Text>{f(invoice.subtotal, invoice.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text>Tax ({Number(invoice.taxRate)}%)</Text>
              <Text>{f(invoice.taxAmount, invoice.currency)}</Text>
            </View>
            <View style={styles.grand}>
              <Text>Total</Text>
              <Text>{f(invoice.total, invoice.currency)}</Text>
            </View>
            {Number(invoice.paid) > 0 && (
              <View style={styles.row}>
                <Text>Paid</Text>
                <Text>{f(invoice.paid, invoice.currency)}</Text>
              </View>
            )}
            {Number(invoice.total) - Number(invoice.paid) > 0 && (
              <View style={styles.row}>
                <Text>Balance due</Text>
                <Text>
                  {f(
                    Math.max(0, Number(invoice.total) - Number(invoice.paid)),
                    invoice.currency,
                  )}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Payments received */}
        {invoice.payments && invoice.payments.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.cellDesc}>Payments received</Text>
              <Text style={styles.cellQty}>Date</Text>
              <Text style={styles.cellPrice}>Method</Text>
              <Text style={styles.cellTotal}>Amount</Text>
            </View>
            {invoice.payments.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cellDesc}>
                  {p.reference ? `Ref ${p.reference}` : "—"}
                </Text>
                <Text style={styles.cellQty}>{d(p.paidAt)}</Text>
                <Text style={styles.cellPrice}>{p.method}</Text>
                <Text style={styles.cellTotal}>
                  {f(p.amount, invoice.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {visible.has("notes") && (
          <View style={styles.notesSection}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Notes</Text>
            <Text>Payment terms: Net 30</Text>
          </View>
        )}

        {/* Footer */}
        {visible.has("footer") && (
          <Text style={styles.footerSection}>
            {tpl.footerText || "Generated by BSC Logistics"}
          </Text>
        )}
      </Page>
    </Document>
  );
}
