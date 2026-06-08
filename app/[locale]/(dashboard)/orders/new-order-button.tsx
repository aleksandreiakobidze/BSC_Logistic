"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { createOrder } from "./actions";

export function NewOrderButton({
  customers,
  customFields = [],
}: {
  customers: { id: string; name: string }[];
  customFields?: CustomFieldDefinitionView[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customerId, setCustomerId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("QUOTE");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("customerId", customerId);
      fd.set("status", status);
      await createOrder(fd);
      toast.success("Order created");
      form.reset();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("orders.newOrder")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("orders.newOrder")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("orders.customer")}>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference / PO">
              <Input name="reference" />
            </Field>
            <Field label={t("orders.price")}>
              <Input name="price" type="number" step="0.01" defaultValue={0} />
            </Field>
            <Field label="Currency">
              <Input name="currency" defaultValue="USD" />
            </Field>
            <Field label={t("common.status")}>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["QUOTE", "CONFIRMED", "IN_PROGRESS"].map((x) => (
                    <SelectItem key={x} value={x}>{x}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("common.notes")} className="sm:col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>
          <CustomFieldsForm definitions={customFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
