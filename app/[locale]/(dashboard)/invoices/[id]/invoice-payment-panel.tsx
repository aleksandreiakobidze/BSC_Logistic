"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RecordPaymentDialog,
  type InvoicePaymentTarget,
} from "@/components/app/record-payment-dialog";

const TERMINAL = new Set(["PAID", "DRAFT", "CANCELLED"]);

interface InvoicePaymentPanelProps {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  currency: string;
  status: string;
  customerName?: string | null;
}

export function InvoicePaymentPanel(props: InvoicePaymentPanelProps) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  const balanceDue = Math.max(0, Math.round((props.total - props.paid) * 100) / 100);
  const canPay = !TERMINAL.has(props.status) && balanceDue > 0;

  if (!canPay) return null;

  const target: InvoicePaymentTarget = {
    kind: "INVOICE",
    invoiceId: props.invoiceId,
    invoiceNumber: props.invoiceNumber,
    total: props.total,
    paid: props.paid,
    currency: props.currency,
    customerName: props.customerName,
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Wallet className="h-4 w-4" />
        {t("invoices.recordPayment")}
      </Button>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} target={target} />
    </>
  );
}
