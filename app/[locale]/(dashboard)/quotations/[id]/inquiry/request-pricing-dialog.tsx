"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { requestSupplierPricing } from "./actions";
import type { SupplierOfferRow } from "./supplier-offers-table";

interface RequestPricingDialogProps {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  quotationId: string;
  offers: SupplierOfferRow[];
}

export function RequestPricingDialog({
  open,
  onOpenChange,
  quotationId,
  offers,
}: RequestPricingDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // Default-select every offer that has a supplier email — those are
      // immediately actionable.
      const eligible = offers
        .filter((o) => o.supplier.email)
        .map((o) => o.id);
      setSelected(new Set(eligible));
      setMessage("");
    }
  }, [open, offers]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error(t("common.error"));
      return;
    }
    setLoading(true);
    try {
      const res = await requestSupplierPricing({
        quotationId,
        offerIds: Array.from(selected),
        message: message || undefined,
      });
      toast.success(
        t("quotations.inquiry.requestPricingSent", { sent: res.sent }),
      );
      if (res.failed.length > 0) {
        toast.warning(t("quotations.inquiry.requestPricingNoEmail"));
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" withDescription>
        <DialogHeader>
          <DialogTitle>
            {t("quotations.inquiry.requestPricingTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("quotations.inquiry.requestPricingDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {offers.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {t("quotations.inquiry.noOffers")}
              </p>
            ) : (
              <ul className="divide-y">
                {offers.map((o) => {
                  const checked = selected.has(o.id);
                  const noEmail = !o.supplier.email;
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={noEmail}
                        onChange={() => !noEmail && toggle(o.id)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {o.supplier.name}
                          <Badge variant="outline" className="text-[10px]">
                            {t(`quotations.inquiry.teams.${o.team}`)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {o.supplier.email ?? (
                            <span className="text-rose-500">no email</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("quotations.inquiry.requestPricingMessage")}
            </Label>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || selected.size === 0}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {t("quotations.inquiry.requestPricingSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
