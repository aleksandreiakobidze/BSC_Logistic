"use client";

import React from "react";
import type { InvoiceTemplate, Block } from "@/lib/invoice-template";

const SAMPLE = {
  number: "INV-0042",
  date: "2026-04-28",
  dueDate: "2026-05-28",
  org: "BSC Logistics Ltd.",
  orgAddress: "123 Tbilisi Ave, Tbilisi, GE 0100",
  customer: "Acme Corporation",
  customerAddress: "456 Business Blvd, Atlanta, GA 30303",
  items: [
    { desc: "Freight forwarding — April", qty: 1, unit: "2,400.00", total: "2,400.00" },
    { desc: "Customs clearance", qty: 1, unit: "350.00", total: "350.00" },
    { desc: "Warehouse storage (7 days)", qty: 7, unit: "25.00", total: "175.00" },
  ],
  subtotal: "2,925.00",
  tax: "292.50",
  total: "3,217.50",
  notes: "Payment due within 30 days. Bank wire preferred.",
};

function blockStyle(b: Block): React.CSSProperties {
  return {
    fontSize: b.fontSize,
    fontWeight: b.fontWeight,
    color: b.color,
    backgroundColor: b.bgColor,
    textAlign: b.align,
  };
}

function alignClass(align: string) {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

interface PreviewInvoiceProps {
  template: InvoiceTemplate;
  orgName: string;
}

export function PreviewInvoice({ template, orgName }: PreviewInvoiceProps) {
  const blockMap = new Map(template.blocks.map((b) => [b.id, b]));
  const get = (id: string) => blockMap.get(id as Block["id"])!;

  const header = get("header");
  const billTo = get("billTo");
  const details = get("details");
  const table = get("table");
  const totals = get("totals");
  const notes = get("notes");
  const footer = get("footer");

  const pageWidth = template.pageSize === "A4" ? 794 : 816;
  const pageHeight = template.pageSize === "A4" ? 1123 : 1056;

  const fontFamilyMap: Record<string, string> = {
    Helvetica: "Arial, Helvetica, sans-serif",
    "Times-Roman": "Times New Roman, serif",
    Courier: "Courier New, monospace",
  };

  return (
    <div className="flex items-start justify-center overflow-auto py-4">
      <div
        style={{
          width: pageWidth,
          minHeight: pageHeight,
          transformOrigin: "top center",
          transform: "scale(0.5)",
          marginBottom: -(pageHeight * 0.5) + 20,
          fontFamily: fontFamilyMap[template.fontFamily] ?? "Arial, sans-serif",
          backgroundColor: "#ffffff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        {header.visible && (
          <div
            style={{
              ...blockStyle(header),
              padding: "32px 40px 24px",
              borderBottom: `4px solid ${template.primaryColor}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  template.logoPosition === "right" ? "space-between" : "flex-start",
                alignItems: "flex-start",
                gap: 16,
                flexDirection:
                  template.logoPosition === "right" ? "row-reverse" : "row",
              }}
            >
              {template.showLogo && (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    backgroundColor: template.primaryColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {(orgName || "B").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: header.fontSize, fontWeight: "bold", color: template.primaryColor }}>
                  INVOICE
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>#{SAMPLE.number}</div>
                <div style={{ fontSize: 11, marginTop: 8, color: "#6b7280" }}>
                  {orgName || SAMPLE.org}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{SAMPLE.orgAddress}</div>
              </div>
            </div>
          </div>
        )}

        {/* Bill-to + Details row */}
        <div style={{ display: "flex", padding: "24px 40px", gap: 32 }}>
          {billTo.visible && (
            <div style={{ ...blockStyle(billTo), flex: 1, padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: "bold", color: template.primaryColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                Bill To
              </div>
              <div style={{ fontSize: billTo.fontSize, fontWeight: "bold" }}>{SAMPLE.customer}</div>
              <div style={{ fontSize: billTo.fontSize - 1, marginTop: 4, color: "#6b7280" }}>{SAMPLE.customerAddress}</div>
            </div>
          )}
          {details.visible && (
            <div style={{ ...blockStyle(details), width: 200, padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: "bold", color: template.primaryColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, textAlign: "left" }}>
                Details
              </div>
              {[
                ["Invoice #", SAMPLE.number],
                ["Date", SAMPLE.date],
                ["Due Date", SAMPLE.dueDate],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: details.fontSize, marginBottom: 3 }}>
                  <span style={{ color: "#6b7280" }}>{k}</span>
                  <span style={{ fontWeight: "bold" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Items table */}
        {table.visible && (
          <div style={{ padding: "0 40px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: table.fontSize }}>
              <thead>
                <tr style={{ backgroundColor: template.primaryColor, color: "#ffffff" }}>
                  {["Description", "Qty", "Unit Price", "Total"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Description" ? "left" : "right", fontWeight: "bold" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE.items.map((item, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? table.bgColor : "#ffffff" }}>
                    <td style={{ padding: "7px 10px" }}>{item.desc}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right" }}>{item.qty}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right" }}>${item.unit}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right" }}>${item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {totals.visible && (
          <div style={{ ...blockStyle(totals), padding: "16px 40px", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 220 }}>
              {[
                ["Subtotal", `$${SAMPLE.subtotal}`],
                ["Tax (10%)", `$${SAMPLE.tax}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: totals.fontSize, marginBottom: 4 }}>
                  <span style={{ color: "#6b7280" }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: totals.fontSize + 2,
                padding: "8px 10px",
                marginTop: 8,
                borderRadius: 4,
                backgroundColor: template.accentColor,
              }}>
                <span>Total</span>
                <span>${SAMPLE.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {notes.visible && (
          <div style={{ ...blockStyle(notes), padding: "16px 40px" }}>
            <div style={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, color: template.primaryColor, marginBottom: 6 }}>
              Notes
            </div>
            <div style={{ fontSize: notes.fontSize }}>{SAMPLE.notes}</div>
          </div>
        )}

        {/* Footer */}
        {footer.visible && (
          <div style={{
            ...blockStyle(footer),
            padding: "16px 40px",
            borderTop: `1px solid #e5e7eb`,
            marginTop: 32,
          }}>
            <div style={{ fontSize: footer.fontSize }}>{template.footerText}</div>
          </div>
        )}
      </div>
    </div>
  );
}
