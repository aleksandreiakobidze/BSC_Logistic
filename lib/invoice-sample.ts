/**
 * Static sample invoice used by the Invoice Designer preview pane. Shape
 * matches `InvoiceForPdf` consumed by `<InvoicePDF>` so the preview renders
 * exactly the same code path as production PDFs.
 */
export type SampleInvoice = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
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
    quantity: number;
    unitPrice: number;
    total: number;
    taxRate?: number;
    discount?: number;
  }[];
  payments?: {
    paidAt: Date;
    amount: number;
    method: string;
    reference: string | null;
  }[];
};

export function buildSampleInvoice(opts?: {
  organizationName?: string;
  logoUrl?: string | null;
  currency?: string;
}): SampleInvoice {
  const currency = opts?.currency ?? "USD";
  const lines = [
    {
      description: "International freight: Tbilisi → Hamburg",
      quantity: 1,
      unitPrice: 2400,
      total: 2400,
      taxRate: 18,
      discount: 0,
    },
    {
      description: "Customs clearance & documentation",
      quantity: 1,
      unitPrice: 350,
      total: 350,
      taxRate: 18,
      discount: 0,
    },
    {
      description: "Warehouse storage (3 days)",
      quantity: 3,
      unitPrice: 90,
      total: 270,
      taxRate: 18,
      discount: 30,
    },
  ];
  const subtotal = lines.reduce((acc, l) => acc + l.total - (l.discount ?? 0), 0);
  const taxRate = 18;
  const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);
  const paid = 1000;

  return {
    number: "INV-PREVIEW-0001",
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    currency,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paid,
    status: "SENT",
    customer: {
      name: "Black Sea Trading LLC",
      address: "12 Rustaveli Ave",
      city: "Tbilisi",
      country: "Georgia",
      taxId: "404123456",
    },
    organization: {
      name: opts?.organizationName ?? "Your Company",
      logoUrl: opts?.logoUrl ?? null,
    },
    lines,
    payments: [
      {
        paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        amount: paid,
        method: "Bank transfer",
        reference: "TX-849217",
      },
    ],
  };
}
