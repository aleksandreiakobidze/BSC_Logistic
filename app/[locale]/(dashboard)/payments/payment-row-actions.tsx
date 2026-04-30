"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  voidInvoicePayment,
  voidSettlementPayout,
} from "@/app/[locale]/(dashboard)/payments/actions";

export function PaymentRowActions({
  paymentId,
  kind,
}: {
  paymentId: string;
  kind: "RECEIVABLE" | "SETTLEMENT_PAYOUT";
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onVoid() {
    if (!window.confirm(t("payments.voidConfirm"))) return;
    setLoading(true);
    try {
      const res =
        kind === "RECEIVABLE"
          ? await voidInvoicePayment(paymentId)
          : await voidSettlementPayout(paymentId);
      if (!res.ok) {
        toast.error(res.error || t("payments.errors.failed"));
        return;
      }
      toast.success(t("payments.success.voided"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onVoid}
      disabled={loading}
      className="gap-1.5 text-destructive hover:text-destructive"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
      {t("payments.void")}
    </Button>
  );
}
