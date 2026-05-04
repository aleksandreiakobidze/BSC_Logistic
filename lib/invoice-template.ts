export type BlockId =
  | "header"
  | "billTo"
  | "details"
  | "table"
  | "totals"
  | "payments"
  | "notes"
  | "paymentTerms"
  | "bankDetails"
  | "footer";

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "medium" | "bold";
export type FontFamily = "Helvetica" | "Times-Roman" | "Courier";
export type PageSize = "A4" | "Letter";
export type LogoPosition = "left" | "right";

export type Block = {
  id: BlockId;
  label: string;
  visible: boolean;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  bgColor: string;
  align: TextAlign;
};

export type LineColumns = {
  qty: boolean;
  unitPrice: boolean;
  taxRate: boolean;
  discount: boolean;
  lineTotal: boolean;
};

export type LabelKey =
  | "invoice"
  | "billTo"
  | "qty"
  | "unitPrice"
  | "description"
  | "taxRate"
  | "discount"
  | "lineTotal"
  | "subtotal"
  | "tax"
  | "total"
  | "paid"
  | "balance"
  | "notes"
  | "paymentTerms"
  | "bankDetails"
  | "issueDate"
  | "dueDate"
  | "invoiceNumber";

export type InvoiceTemplate = {
  primaryColor: string;
  accentColor: string;
  pageSize: PageSize;
  fontFamily: FontFamily;
  showLogo: boolean;
  logoPosition: LogoPosition;
  footerText: string;
  /** Body of the Notes block (was hardcoded). */
  notes: string;
  /** Standalone "Payment terms" block content (e.g. "Net 30"). */
  paymentTerms: string;
  /** Optional multiline bank account / wire instructions. */
  bankDetails: string;
  /** Per-column visibility for the line-items table. Description always shown. */
  lineColumns: LineColumns;
  /** Overrides for default labels; missing keys fall back to i18n strings. */
  labels: Partial<Record<LabelKey, string>>;
  /** Optional signature block at the bottom of the invoice. */
  signature: { enabled: boolean; label: string };
  blocks: Block[];
};

export const DEFAULT_BLOCKS: Block[] = [
  {
    id: "header",
    label: "Header",
    visible: true,
    fontSize: 22,
    fontWeight: "bold",
    color: "#111111",
    bgColor: "#ffffff",
    align: "left",
  },
  {
    id: "billTo",
    label: "Bill To",
    visible: true,
    fontSize: 10,
    fontWeight: "normal",
    color: "#374151",
    bgColor: "#f8fafc",
    align: "left",
  },
  {
    id: "details",
    label: "Invoice Details",
    visible: true,
    fontSize: 10,
    fontWeight: "normal",
    color: "#374151",
    bgColor: "#ffffff",
    align: "right",
  },
  {
    id: "table",
    label: "Line Items Table",
    visible: true,
    fontSize: 10,
    fontWeight: "normal",
    color: "#111111",
    bgColor: "#f8fafc",
    align: "left",
  },
  {
    id: "totals",
    label: "Totals",
    visible: true,
    fontSize: 10,
    fontWeight: "normal",
    color: "#111111",
    bgColor: "#ffffff",
    align: "right",
  },
  {
    id: "payments",
    label: "Payments",
    visible: true,
    fontSize: 10,
    fontWeight: "normal",
    color: "#111111",
    bgColor: "#ffffff",
    align: "left",
  },
  {
    id: "notes",
    label: "Notes",
    visible: true,
    fontSize: 9,
    fontWeight: "normal",
    color: "#6b7280",
    bgColor: "#ffffff",
    align: "left",
  },
  {
    id: "paymentTerms",
    label: "Payment Terms",
    visible: true,
    fontSize: 9,
    fontWeight: "normal",
    color: "#374151",
    bgColor: "#ffffff",
    align: "left",
  },
  {
    id: "bankDetails",
    label: "Bank Details",
    visible: false,
    fontSize: 9,
    fontWeight: "normal",
    color: "#374151",
    bgColor: "#f8fafc",
    align: "left",
  },
  {
    id: "footer",
    label: "Footer",
    visible: true,
    fontSize: 9,
    fontWeight: "normal",
    color: "#94a3b8",
    bgColor: "#ffffff",
    align: "center",
  },
];

export const DEFAULT_LINE_COLUMNS: LineColumns = {
  qty: true,
  unitPrice: true,
  taxRate: false,
  discount: false,
  lineTotal: true,
};

export const DEFAULT_TEMPLATE: InvoiceTemplate = {
  primaryColor: "#1e40af",
  accentColor: "#dbeafe",
  pageSize: "A4",
  fontFamily: "Helvetica",
  showLogo: false,
  logoPosition: "left",
  footerText: "Thank you for your business.",
  notes: "",
  paymentTerms: "Net 30",
  bankDetails: "",
  lineColumns: DEFAULT_LINE_COLUMNS,
  labels: {},
  signature: { enabled: false, label: "Authorized signature" },
  blocks: DEFAULT_BLOCKS,
};

/**
 * Parse stored JSON into a complete `InvoiceTemplate`. Backward-compatible:
 * older saves missing the new fields (notes/paymentTerms/lineColumns/etc.)
 * inherit defaults; legacy `bold` font weights migrate to "bold".
 */
export function parseTemplate(
  json: string | null | undefined,
): InvoiceTemplate {
  if (!json) return DEFAULT_TEMPLATE;
  try {
    const parsed = JSON.parse(json) as Partial<InvoiceTemplate>;
    const blockMap = new Map((parsed.blocks ?? []).map((b) => [b.id, b]));
    const blocks = DEFAULT_BLOCKS.map((def) => ({
      ...def,
      ...(blockMap.get(def.id) ?? {}),
    }));

    return {
      ...DEFAULT_TEMPLATE,
      ...parsed,
      lineColumns: { ...DEFAULT_LINE_COLUMNS, ...(parsed.lineColumns ?? {}) },
      labels: parsed.labels ?? {},
      signature: { ...DEFAULT_TEMPLATE.signature, ...(parsed.signature ?? {}) },
      blocks,
    };
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

/** Built-in template presets the user can apply from the designer toolbar. */
export const TEMPLATE_PRESETS: Record<string, InvoiceTemplate> = {
  modern: {
    ...DEFAULT_TEMPLATE,
    primaryColor: "#0f172a",
    accentColor: "#e2e8f0",
    fontFamily: "Helvetica",
    blocks: DEFAULT_BLOCKS.map((b) =>
      b.id === "header"
        ? { ...b, fontSize: 26, color: "#0f172a", bgColor: "#ffffff" }
        : b,
    ),
  },
  classic: {
    ...DEFAULT_TEMPLATE,
    primaryColor: "#7c2d12",
    accentColor: "#fef3c7",
    fontFamily: "Times-Roman",
    blocks: DEFAULT_BLOCKS.map((b) =>
      b.id === "header"
        ? { ...b, fontSize: 24, color: "#7c2d12" }
        : b.id === "billTo"
          ? { ...b, bgColor: "#fef3c7" }
          : b,
    ),
  },
  minimal: {
    ...DEFAULT_TEMPLATE,
    primaryColor: "#111111",
    accentColor: "#f5f5f5",
    fontFamily: "Helvetica",
    blocks: DEFAULT_BLOCKS.map((b) =>
      b.id === "billTo" ? { ...b, bgColor: "#ffffff" } : b,
    ),
  },
};
