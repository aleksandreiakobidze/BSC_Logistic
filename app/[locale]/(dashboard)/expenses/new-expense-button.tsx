"use client";

import * as React from "react";
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
import { Switch } from "@/components/ui/switch";
import { EXPENSE_CATEGORIES } from "./expense-constants";
import { createExpense } from "./actions";

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

export interface ScopeOptions {
  orders: { id: string; number: string; customerName: string }[];
  trips: { id: string; number: string }[];
  shipments: { id: string; number: string }[];
  drivers: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; plate: string }[];
}

export function NewExpenseButton({ scopeOptions }: { scopeOptions: ScopeOptions }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [category, setCategory] = React.useState<string>(EXPENSE_CATEGORIES[0]);
  const [currency, setCurrency] = React.useState<string>("USD");
  const [scope, setScope] = React.useState<Scope>("ORG");
  const [scopeId, setScopeId] = React.useState<string>("");
  const [billable, setBillable] = React.useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("category", category);
      fd.set("currency", currency);
      fd.set("billable", billable ? "on" : "");
      // Clear all scope fields then set the one in use
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
      const res = await createExpense(fd);
      if (res.ok) {
        toast.success("Expense saved");
        setOpen(false);
        form.reset();
        setCategory(EXPENSE_CATEGORIES[0]);
        setCurrency("USD");
        setScope("ORG");
        setScopeId("");
        setBillable(false);
      }
    } catch {
      toast.error("Failed to save expense");
    } finally {
      setLoading(false);
    }
  }

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
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Expense</DialogTitle>
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
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required rows={2} placeholder="Brief description…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
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
            <Label htmlFor="vendor">Vendor (optional)</Label>
            <Input id="vendor" name="vendor" placeholder="e.g. Socar, Rompetrol…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="incurredAt">Date</Label>
            <Input id="incurredAt" name="incurredAt" type="date" defaultValue={today} required />
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
                <Label htmlFor="billable" className="text-sm">Billable to customer</Label>
                <p className="text-xs text-muted-foreground">Mark to include this expense as a line on the customer&rsquo;s invoice.</p>
              </div>
              <Switch id="billable" checked={billable} onCheckedChange={setBillable} />
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
