"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  RecordPaymentDialog,
  type SettlementPayoutTarget,
} from "@/components/app/record-payment-dialog";
import { deleteSettlement } from "./actions";

interface SettlementRowActionsProps {
  settlementId: string;
  net: number;
  currency: string;
  driverName: string;
  periodLabel: string;
  paid: boolean;
}

export function SettlementRowActions(props: SettlementRowActionsProps) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const target: SettlementPayoutTarget = {
    kind: "SETTLEMENT",
    settlementId: props.settlementId,
    net: props.net,
    currency: props.currency,
    driverName: props.driverName,
    periodLabel: props.periodLabel,
  };

  async function onDelete() {
    if (!window.confirm(t("settlements.deleteConfirm"))) return;
    setLoading(true);
    try {
      const res = await deleteSettlement(props.settlementId);
      if (!res.ok) {
        toast.error(res.error || t("settlements.errors.failed"));
        return;
      }
      toast.success(t("settlements.deleted"));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {!props.paid && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("settlements.markPaid")}
        </Button>
      )}
      {!props.paid && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={loading}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <RecordPaymentDialog
        open={open}
        onOpenChange={setOpen}
        target={target}
        onRecorded={() => router.refresh()}
      />
    </div>
  );
}
