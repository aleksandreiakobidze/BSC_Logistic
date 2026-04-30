import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type QuotationForPdf = {
  number: string;
  status: string;
  currency: string;
  subtotal: unknown;
  taxRate: unknown;
  taxAmount: unknown;
  discount: unknown;
  total: unknown;
  validUntil: Date | null;
  notes: string | null;
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
  customer: {
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    taxId: string | null;
  };
  organization: { name: string };
  lines: {
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    total: unknown;
  }[];
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v === "object" && v && "toString" in v) return Number(v.toString());
  return 0;
}

function fmt(v: unknown, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num(v));
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#111" },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "3pt solid #6366f1",
  },
  h1: { fontSize: 22, color: "#6366f1", fontWeight: 700 },
  muted: { color: "#666", fontSize: 9 },
  billToCard: {
    border: "1pt solid #e5e7eb",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  table: { marginTop: 12 },
  thead: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: 700,
  },
  trow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: "0.5pt solid #e5e7eb",
  },
  cellDescription: { flex: 4 },
  cellQty: { flex: 1, textAlign: "right" },
  cellUnit: { flex: 1.5, textAlign: "right" },
  cellTotal: { flex: 1.5, textAlign: "right" },
  totalsBlock: {
    marginTop: 16,
    marginLeft: "auto",
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTop: "1pt solid #111",
    marginTop: 6,
    fontWeight: 700,
    fontSize: 12,
  },
  notes: { marginTop: 18 },
  watermark: {
    position: "absolute",
    top: 280,
    left: 80,
    right: 80,
    fontSize: 60,
    color: "rgba(99,102,241,0.1)",
    fontWeight: 700,
    transform: "rotate(-25deg)",
    textAlign: "center",
  },
});

export function QuotationPDF({ quotation }: { quotation: QuotationForPdf }) {
  const showWatermark =
    quotation.status === "DRAFT" || quotation.status === "EXPIRED";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {showWatermark && (
          <Text style={styles.watermark}>{quotation.status}</Text>
        )}
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.h1}>QUOTATION</Text>
            <Text style={styles.muted}>{quotation.organization.name}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>
              {quotation.number}
            </Text>
            <Text style={styles.muted}>
              Issued: {quotation.createdAt.toLocaleDateString()}
            </Text>
            {quotation.validUntil && (
              <Text style={styles.muted}>
                Valid until: {quotation.validUntil.toLocaleDateString()}
              </Text>
            )}
            <Text style={styles.muted}>Status: {quotation.status}</Text>
          </View>
        </View>

        <View style={styles.billToCard}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>To</Text>
          <Text>{quotation.customer.name}</Text>
          {quotation.customer.address && (
            <Text style={styles.muted}>{quotation.customer.address}</Text>
          )}
          {(quotation.customer.city || quotation.customer.country) && (
            <Text style={styles.muted}>
              {[quotation.customer.city, quotation.customer.country]
                .filter(Boolean)
                .join(", ")}
            </Text>
          )}
          {quotation.customer.taxId && (
            <Text style={styles.muted}>Tax ID: {quotation.customer.taxId}</Text>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={styles.cellDescription}>Description</Text>
            <Text style={styles.cellQty}>Qty</Text>
            <Text style={styles.cellUnit}>Unit price</Text>
            <Text style={styles.cellTotal}>Total</Text>
          </View>
          {quotation.lines.map((l, i) => (
            <View key={i} style={styles.trow}>
              <Text style={styles.cellDescription}>{l.description}</Text>
              <Text style={styles.cellQty}>{num(l.quantity)}</Text>
              <Text style={styles.cellUnit}>
                {fmt(l.unitPrice, quotation.currency)}
              </Text>
              <Text style={styles.cellTotal}>
                {fmt(l.total, quotation.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(quotation.subtotal, quotation.currency)}</Text>
          </View>
          {num(quotation.discount) > 0 && (
            <View style={styles.totalsRow}>
              <Text>Discount</Text>
              <Text>-{fmt(quotation.discount, quotation.currency)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>Tax ({num(quotation.taxRate)}%)</Text>
            <Text>{fmt(quotation.taxAmount, quotation.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text>Total</Text>
            <Text>{fmt(quotation.total, quotation.currency)}</Text>
          </View>
        </View>

        {quotation.notes && (
          <View style={styles.notes}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Notes</Text>
            <Text>{quotation.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
