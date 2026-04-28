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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvoice } from "./actions";

export function NewInvoiceButton({
  customers,
  orders,
}: {
  customers: { id: string; name: string }[];
  orders: { id: string; number: string; price: number; currency: string; customerId: string }[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [orderId, setOrderId] = React.useState("__none__");
  const [subtotal, setSubtotal] = React.useState("0");

  const filteredOrders = customerId
    ? orders.filter((o) => o.customerId === customerId)
    : orders;

  React.useEffect(() => {
    if (orderId !== "__none__") {
      const o = orders.find((x) => x.id === orderId);
      if (o) setSubtotal(String(o.price));
    }
  }, [orderId, orders]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) return toast.error("Select customer");
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("customerId", customerId);
      if (orderId !== "__none__") fd.set("orderId", orderId);
      else fd.delete("orderId");
      await createInvoice(fd);
      toast.success("Invoice created");
      form.reset();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const due = new Date();
  due.setDate(due.getDate() + 14);
  const dueStr = due.toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("invoices.newInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoices.newInvoice")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("orders.customer")} className="sm:col-span-2">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Link to order" className="sm:col-span-2">
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.number} · {o.currency} {o.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input name="description" defaultValue="Transport services" required />
            </Field>
            <Field label={t("invoices.subtotal")}>
              <Input name="subtotal" type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} required />
            </Field>
            <Field label="Tax rate (%)">
              <Input name="taxRate" type="number" step="0.01" defaultValue={18} />
            </Field>
            <Field label="Currency">
              <Input name="currency" defaultValue="USD" />
            </Field>
            <Field label={t("invoices.dueDate")}>
              <Input name="dueDate" type="date" defaultValue={dueStr} required />
            </Field>
          </div>
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
