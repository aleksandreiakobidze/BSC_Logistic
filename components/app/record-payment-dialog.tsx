"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  recordInvoicePayment,
  recordSettlementPayout,
} from "@/app/[locale]/(dashboard)/payments/actions";

const METHODS = ["BANK", "CASH", "CARD", "OTHER"] as const;

interface InvoicePaymentTarget {
  kind: "INVOICE";
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  currency: string;
  customerName?: string | null;
}

interface SettlementPayoutTarget {
  kind: "SETTLEMENT";
  settlementId: string;
  net: number;
  currency: string;
  driverName?: string | null;
  periodLabel?: string | null;
}

type Target = InvoicePaymentTarget | SettlementPayoutTarget;

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Target | null;
  onRecorded?: () => void;
}

function fmtMoney(n: number, currency = "USD") {
  return `${n.toFixed(2)} ${currency}`;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  target,
  onRecorded,
}: RecordPaymentDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>("BANK");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [paidAt, setPaidAt] = React.useState<Date | undefined>(new Date());

  const balanceDue = React.useMemo(() => {
    if (!target) return 0;
    if (target.kind === "INVOICE") {
      return Math.max(0, Math.round((target.total - target.paid) * 100) / 100);
    }
    return target.net;
  }, [target]);

  React.useEffect(() => {
    if (!target) return;
    setAmount(balanceDue.toFixed(2));
    setMethod("BANK");
    setReference("");
    setNote("");
    setPaidAt(new Date());
  }, [target, balanceDue]);

  if (!target) return null;

  const isInvoice = target.kind === "INVOICE";
  const currency = target.currency;
  const titleKey = isInvoice ? "payments.recordPayment" : "payments.recordPayout";
  const descKey = isInvoice ? "payments.recordPaymentDesc" : "payments.recordPayoutDesc";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setLoading(true);
    try {
      if (target.kind === "INVOICE") {
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          toast.error(t("payments.errors.invalidAmount"));
          return;
        }
        if (amt > balanceDue + 0.001) {
          toast.error(t("payments.errors.exceedsBalance"));
          return;
        }
        const res = await recordInvoicePayment({
          invoiceId: target.invoiceId,
          amount: amt,
          method: method as (typeof METHODS)[number],
          reference: reference || undefined,
          note: note || undefined,
          paidAt: paidAt ? paidAt.toISOString() : undefined,
        });
        if (!res.ok) {
          toast.error(res.error || t("payments.errors.failed"));
          return;
        }
        toast.success(t("payments.success.recorded"));
      } else {
        const res = await recordSettlementPayout({
          settlementId: target.settlementId,
          method: method as (typeof METHODS)[number],
          reference: reference || undefined,
          note: note || undefined,
          paidAt: paidAt ? paidAt.toISOString() : undefined,
        });
        if (!res.ok) {
          toast.error(res.error || t("payments.errors.failed"));
          return;
        }
        toast.success(t("payments.success.payoutRecorded"));
      }
      onOpenChange(false);
      onRecorded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" withDescription>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>
            {isInvoice ? (
              <span>
                <span className="font-medium">#{(target as InvoicePaymentTarget).invoiceNumber}</span>
                {(target as InvoicePaymentTarget).customerName && (
                  <span className="text-muted-foreground">
                    {" "}· {(target as InvoicePaymentTarget).customerName}
                  </span>
                )}
              </span>
            ) : (
              <span>
                {(target as SettlementPayoutTarget).driverName}
                {(target as SettlementPayoutTarget).periodLabel && (
                  <span className="text-muted-foreground">
                    {" "}· {(target as SettlementPayoutTarget).periodLabel}
                  </span>
                )}
              </span>
            )}
          </DialogDescription>
          <p className="text-xs text-muted-foreground">{t(descKey)}</p>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {isInvoice ? t("payments.balanceDue") : t("payments.netDue")}
              </span>
              <span className="font-mono font-semibold">
                {fmtMoney(balanceDue, currency)}
              </span>
            </div>
            {isInvoice && (
              <>
                <div className="mt-1 flex items-center justify-between text-muted-foreground">
                  <span>{t("invoices.total")}</span>
                  <span className="font-mono">
                    {fmtMoney((target as InvoicePaymentTarget).total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("payments.totalPaid")}</span>
                  <span className="font-mono">
                    {fmtMoney((target as InvoicePaymentTarget).paid, currency)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("payments.amount")}>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                max={isInvoice ? balanceDue : undefined}
                value={isInvoice ? amount : balanceDue.toFixed(2)}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={!isInvoice}
              />
            </Field>
            <Field label={t("payments.method")}>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`payments.methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("payments.paidAt")}>
              <DateTimePicker value={paidAt} onChange={setPaidAt} />
            </Field>
            <Field label={t("payments.reference")}>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("payments.referencePlaceholder")}
              />
            </Field>
          </div>

          <Field label={t("payments.note")}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("payments.notePlaceholder")}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("payments.record")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export type { InvoicePaymentTarget, SettlementPayoutTarget };
