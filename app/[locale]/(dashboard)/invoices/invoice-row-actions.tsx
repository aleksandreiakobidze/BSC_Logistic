"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Download, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RecordPaymentDialog,
  type InvoicePaymentTarget,
} from "@/components/app/record-payment-dialog";

interface InvoiceRowActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  currency: string;
  status: string;
  customerName?: string | null;
}

const TERMINAL = new Set(["PAID", "DRAFT", "CANCELLED"]);

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  total,
  paid,
  currency,
  status,
  customerName,
}: InvoiceRowActionsProps) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);
  const canPay = !TERMINAL.has(status) && balanceDue > 0;

  const target: InvoicePaymentTarget = {
    kind: "INVOICE",
    invoiceId,
    invoiceNumber,
    total,
    paid,
    currency,
    customerName,
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canPay && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Wallet className="h-3.5 w-3.5" />
          {t("invoices.recordPayment")}
        </Button>
      )}
      <Button asChild size="sm" variant="ghost" className="gap-1.5">
        <Link href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer">
          <Download className="h-3.5 w-3.5" />
          PDF
        </Link>
      </Button>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} target={target} />
    </div>
  );
}
