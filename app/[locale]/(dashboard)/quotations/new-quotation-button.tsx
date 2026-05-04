"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQuotation } from "./actions";

interface NewQuotationButtonProps {
  customers: { id: string; name: string }[];
}

export function NewQuotationButton({ customers }: NewQuotationButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customerId, setCustomerId] = React.useState<string>("");
  const [currency, setCurrency] = React.useState("USD");
  const [validUntil, setValidUntil] = React.useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      toast.error(t("quotations.pickCustomerError"));
      return;
    }
    setLoading(true);
    try {
      const res = await createQuotation({
        customerId,
        currency,
        validUntil: validUntil ? new Date(validUntil) : null,
        taxRate: 0,
        discount: 0,
        notes: null,
        lines: [],
      });
      if (res.ok) {
        toast.success(t("quotations.createdSuccess"));
        setOpen(false);
        router.push(`/quotations/${res.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {t("quotations.newQuotation")}
      </Button>
      <DialogContent className="max-w-md" description={t("quotations.description")}>
        <DialogHeader>
          <DialogTitle>{t("quotations.newQuotation")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="quote-customer">{t("orders.customer")}</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="quote-customer">
                <SelectValue placeholder={t("orders.customer")} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quote-currency">{t("common.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="quote-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GEL", "RUB"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quote-validUntil">
                {t("quotations.validUntil")}
              </Label>
              <Input
                id="quote-validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("quotations.newQuotation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
