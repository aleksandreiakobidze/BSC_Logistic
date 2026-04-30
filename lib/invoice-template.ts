export type BlockId =
  | "header"
  | "billTo"
  | "details"
  | "table"
  | "totals"
  | "notes"
  | "footer";

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold";
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

export type InvoiceTemplate = {
  primaryColor: string;
  accentColor: string;
  pageSize: PageSize;
  fontFamily: FontFamily;
  showLogo: boolean;
  logoPosition: LogoPosition;
  footerText: string;
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

export const DEFAULT_TEMPLATE: InvoiceTemplate = {
  primaryColor: "#1e40af",
  accentColor: "#dbeafe",
  pageSize: "A4",
  fontFamily: "Helvetica",
  showLogo: false,
  logoPosition: "left",
  footerText: "Thank you for your business.",
  blocks: DEFAULT_BLOCKS,
};

export function parseTemplate(json: string | null | undefined): InvoiceTemplate {
  if (!json) return DEFAULT_TEMPLATE;
  try {
    const parsed = JSON.parse(json) as Partial<InvoiceTemplate>;
    // Merge with defaults so new block fields always exist
    const blockMap = new Map(
      (parsed.blocks ?? []).map((b) => [b.id, b]),
    );
    const blocks = DEFAULT_BLOCKS.map((def) => ({
      ...def,
      ...(blockMap.get(def.id) ?? {}),
    }));
    return { ...DEFAULT_TEMPLATE, ...parsed, blocks };
  } catch {
    return DEFAULT_TEMPLATE;
  }
}
