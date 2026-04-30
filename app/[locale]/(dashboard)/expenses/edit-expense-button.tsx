"use client";

import * as React from "react";
import { Pencil, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { EXPENSE_CATEGORIES } from "./expense-constants";
import type { ScopeOptions } from "./new-expense-button";
import { updateExpense } from "./actions";

const CURRENCIES = ["USD", "EUR", "GEL", "GBP", "TRY", "RUB"];

const SCOPES = [
  { id: "ORG", label: "Organization (overhead)" },
  { id: "ORDER", label: "Order" },
  { id: "TRIP", label: "Trip (allocatable)" },
  { id: "SHIPMENT", label: "Shipment" },
  { id: "DRIVER", label: "Driver" },
  { id: "VEHICLE", label: "Vehicle" },
] as const;

type Scope = (typeof SCOPES)[number]["id"];

export type ExpenseRow = {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  vendor: string | null;
  incurredAt: Date;
  orderId: string | null;
  tripId: string | null;
  shipmentId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  billable: boolean;
};

function detectScope(e: ExpenseRow): { scope: Scope; scopeId: string } {
  if (e.orderId) return { scope: "ORDER", scopeId: e.orderId };
  if (e.tripId) return { scope: "TRIP", scopeId: e.tripId };
  if (e.shipmentId) return { scope: "SHIPMENT", scopeId: e.shipmentId };
  if (e.driverId) return { scope: "DRIVER", scopeId: e.driverId };
  if (e.vehicleId) return { scope: "VEHICLE", scopeId: e.vehicleId };
  return { scope: "ORG", scopeId: "" };
}

export function EditExpenseButton({
  expense,
  scopeOptions,
}: {
  expense: ExpenseRow;
  scopeOptions: ScopeOptions;
}) {
  const initial = detectScope(expense);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [category, setCategory] = React.useState(expense.category);
  const [currency, setCurrency] = React.useState(expense.currency);
  const [scope, setScope] = React.useState<Scope>(initial.scope);
  const [scopeId, setScopeId] = React.useState<string>(initial.scopeId);
  const [billable, setBillable] = React.useState(expense.billable);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("category", category);
      fd.set("currency", currency);
      fd.set("billable", billable ? "on" : "");
      fd.delete("orderId");
      fd.delete("tripId");
      fd.delete("shipmentId");
      fd.delete("driverId");
      fd.delete("vehicleId");
      if (scope !== "ORG" && scopeId) {
        const key = scope === "ORDER" ? "orderId"
          : scope === "TRIP" ? "tripId"
          : scope === "SHIPMENT" ? "shipmentId"
          : scope === "DRIVER" ? "driverId"
          : "vehicleId";
        fd.set(key, scopeId);
      }
      const res = await updateExpense(expense.id, fd);
      if (res.ok) {
        toast.success("Expense updated");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to update expense");
    } finally {
      setLoading(false);
    }
  }

  const dateStr = expense.incurredAt instanceof Date
    ? expense.incurredAt.toISOString().slice(0, 10)
    : String(expense.incurredAt).slice(0, 10);

  function renderScopeTarget() {
    if (scope === "ORG") return null;
    const items =
      scope === "ORDER" ? scopeOptions.orders.map((o) => ({ id: o.id, label: `${o.number} · ${o.customerName}` }))
      : scope === "TRIP" ? scopeOptions.trips.map((tr) => ({ id: tr.id, label: tr.number }))
      : scope === "SHIPMENT" ? scopeOptions.shipments.map((s) => ({ id: s.id, label: s.number }))
      : scope === "DRIVER" ? scopeOptions.drivers.map((d) => ({ id: d.id, label: `${d.firstName} ${d.lastName}` }))
      : scopeOptions.vehicles.map((v) => ({ id: v.id, label: v.plate }));

    return (
      <div className="space-y-1.5">
        <Label>Target</Label>
        <Select value={scopeId} onValueChange={setScopeId}>
          <SelectTrigger>
            <SelectValue placeholder={`Pick ${scope.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {items.length === 0 ? (
              <div className="py-2 px-2 text-sm text-muted-foreground">No matching records</div>
            ) : (
              items.map((it) => <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`desc-${expense.id}`}>Description</Label>
            <Textarea
              id={`desc-${expense.id}`}
              name="description"
              required
              rows={2}
              defaultValue={expense.description}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`amt-${expense.id}`}>Amount</Label>
              <Input
                id={`amt-${expense.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={expense.amount}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`vendor-${expense.id}`}>Vendor (optional)</Label>
            <Input id={`vendor-${expense.id}`} name="vendor" defaultValue={expense.vendor ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`date-${expense.id}`}>Date</Label>
            <Input id={`date-${expense.id}`} name="incurredAt" type="date" defaultValue={dateStr} required />
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setScopeId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {renderScopeTarget()}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <Label htmlFor={`bill-${expense.id}`} className="text-sm">Billable to customer</Label>
                <p className="text-xs text-muted-foreground">Mark to include this expense as a line on the customer&rsquo;s invoice.</p>
              </div>
              <Switch id={`bill-${expense.id}`} checked={billable} onCheckedChange={setBillable} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
