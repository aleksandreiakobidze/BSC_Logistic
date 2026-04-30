"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Trash2 } from "lucide-react";
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
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { createInvoice } from "./actions";

type LineKind = "ORDER" | "EXPENSE" | "TRIP" | "MANUAL";

interface InvoiceLineDraft {
  id: string;
  kind: LineKind;
  refId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceCustomerOrder {
  id: string;
  number: string;
  price: number;
  currency: string;
  customerId: string;
}

export interface InvoiceCustomerExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  customerId: string;
}

export interface InvoiceCustomerTrip {
  id: string;
  number: string;
  customerIds: string[];
}

export function NewInvoiceButton({
  customers,
  orders,
  expenses = [],
  trips = [],
  customFields = [],
}: {
  customers: { id: string; name: string }[];
  orders: InvoiceCustomerOrder[];
  expenses?: InvoiceCustomerExpense[];
  trips?: InvoiceCustomerTrip[];
  customFields?: CustomFieldDefinitionView[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [taxRate, setTaxRate] = React.useState("18");
  const [currency, setCurrency] = React.useState("USD");
  const due = new Date();
  due.setDate(due.getDate() + 14);
  const [dueDate, setDueDate] = React.useState(due.toISOString().slice(0, 10));
  const [lines, setLines] = React.useState<InvoiceLineDraft[]>([
    { id: rid(), kind: "MANUAL", refId: "", description: "", quantity: 1, unitPrice: 0 },
  ]);

  function rid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function addLine() {
    setLines((prev) => [...prev, { id: rid(), kind: "MANUAL", refId: "", description: "", quantity: 1, unitPrice: 0 }]);
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }
  function updateLine(id: string, patch: Partial<InvoiceLineDraft>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function onPickRef(line: InvoiceLineDraft, refId: string) {
    if (line.kind === "ORDER") {
      const o = orders.find((x) => x.id === refId);
      if (o) {
        updateLine(line.id, {
          refId,
          description: `Transport services — Order ${o.number}`,
          quantity: 1,
          unitPrice: o.price,
        });
      } else updateLine(line.id, { refId });
    } else if (line.kind === "EXPENSE") {
      const e = expenses.find((x) => x.id === refId);
      if (e) {
        updateLine(line.id, {
          refId,
          description: `${e.category}: ${e.description}`,
          quantity: 1,
          unitPrice: e.amount,
        });
      } else updateLine(line.id, { refId });
    } else if (line.kind === "TRIP") {
      const tr = trips.find((x) => x.id === refId);
      if (tr) {
        updateLine(line.id, {
          refId,
          description: `Trip ${tr.number} — Transport services`,
        });
      } else updateLine(line.id, { refId });
    } else {
      updateLine(line.id, { refId });
    }
  }

  const subtotal = lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const tax = (subtotal * Number(taxRate || 0)) / 100;
  const total = subtotal + tax;

  const filteredOrders = customerId ? orders.filter((o) => o.customerId === customerId) : orders;
  const filteredExpenses = customerId ? expenses.filter((e) => e.customerId === customerId) : expenses;
  const filteredTrips = customerId ? trips.filter((tr) => tr.customerIds.includes(customerId)) : trips;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) return toast.error("Select customer");
    if (lines.length === 0) return toast.error("Add at least one line");
    for (const l of lines) {
      if (!l.description.trim()) return toast.error("Each line needs a description");
    }
    setLoading(true);
    try {
      const formEl = e.currentTarget;
      const fd = new FormData(formEl);
      const customFieldsObj: Record<string, string> = {};
      for (const [k, v] of fd.entries()) {
        if (k.startsWith("cf_")) customFieldsObj[k] = String(v);
      }
      await createInvoice({
        customerId,
        taxRate: Number(taxRate),
        currency,
        dueDate,
        lines: lines.map((l) => ({
          kind: l.kind,
          orderId: l.kind === "ORDER" ? l.refId || null : null,
          expenseId: l.kind === "EXPENSE" ? l.refId || null : null,
          tripId: l.kind === "TRIP" ? l.refId || null : null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        customFieldsJson: JSON.stringify(customFieldsObj),
      });
      toast.success("Invoice created");
      formEl.reset();
      setOpen(false);
      setLines([{ id: rid(), kind: "MANUAL", refId: "", description: "", quantity: 1, unitPrice: 0 }]);
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
          <Plus className="h-4 w-4" /> {t("invoices.newInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.newInvoice")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
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
            <Field label="Currency">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </Field>
            <Field label={t("invoices.dueDate")}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </Field>
          </div>

          {/* Line builder */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b p-2.5">
              <div className="text-sm font-medium">Lines</div>
              <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            <div className="divide-y">
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 p-2.5">
                  <div className="col-span-2">
                    <Select
                      value={line.kind}
                      onValueChange={(v) => updateLine(line.id, { kind: v as LineKind, refId: "", description: "", unitPrice: 0 })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORDER">Order</SelectItem>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                        <SelectItem value="TRIP">Trip</SelectItem>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    {line.kind === "MANUAL" ? (
                      <Input className="h-8" placeholder="—" value="" disabled />
                    ) : (
                      <Select value={line.refId} onValueChange={(v) => onPickRef(line, v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={`Pick ${line.kind.toLowerCase()}…`} />
                        </SelectTrigger>
                        <SelectContent>
                          {line.kind === "ORDER" && filteredOrders.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.number} · {o.currency} {o.price}</SelectItem>
                          ))}
                          {line.kind === "EXPENSE" && filteredExpenses.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.description} · {e.amount}</SelectItem>
                          ))}
                          {line.kind === "TRIP" && filteredTrips.map((tr) => (
                            <SelectItem key={tr.id} value={tr.id}>{tr.number}</SelectItem>
                          ))}
                          {((line.kind === "ORDER" && filteredOrders.length === 0) ||
                            (line.kind === "EXPENSE" && filteredExpenses.length === 0) ||
                            (line.kind === "TRIP" && filteredTrips.length === 0)) && (
                            <div className="py-2 px-2 text-xs text-muted-foreground">
                              {customerId ? "None for this customer" : "Pick a customer first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="col-span-3">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      className="h-8 text-xs text-right font-mono"
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-xs text-right font-mono"
                      type="number"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="flex flex-col items-end gap-1 border-t p-3 text-sm">
              <div className="flex items-center gap-3">
                <Label className="text-xs">Tax %</Label>
                <Input
                  className="h-7 w-20 text-right font-mono text-xs"
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="text-muted-foreground">Subtotal: <span className="font-mono">{subtotal.toFixed(2)} {currency}</span></div>
              <div className="text-muted-foreground">Tax: <span className="font-mono">{tax.toFixed(2)} {currency}</span></div>
              <div className="text-base font-semibold">Total: <span className="font-mono">{total.toFixed(2)} {currency}</span></div>
            </div>
          </div>

          <CustomFieldsForm definitions={customFields} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
