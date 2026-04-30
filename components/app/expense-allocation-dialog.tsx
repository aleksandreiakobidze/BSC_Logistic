"use client";

import * as React from "react";
import { Loader2, Split } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ALLOCATION_METHODS,
  computeAllocation,
  type AllocationMethod,
  type OrderForAllocation,
} from "@/lib/expense-allocation";
import { allocateTripExpense } from "@/app/[locale]/(dashboard)/trips/actions";

type OrderRow = OrderForAllocation & { number: string; customerName: string };

export function ExpenseAllocationDialog({
  expenseId,
  expenseAmount,
  expenseCurrency,
  expenseDescription,
  orders,
  initialAllocations,
}: {
  expenseId: string;
  expenseAmount: number;
  expenseCurrency: string;
  expenseDescription: string;
  orders: OrderRow[];
  initialAllocations?: { orderId: string; amount: number; method: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState<AllocationMethod>(
    (initialAllocations?.[0]?.method as AllocationMethod) ?? "EQUAL",
  );
  const [manualMap, setManualMap] = React.useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const a of initialAllocations ?? []) m[a.orderId] = a.amount;
    return m;
  });
  const [loading, setLoading] = React.useState(false);

  const computed = React.useMemo(
    () => computeAllocation(expenseAmount, method, orders, manualMap),
    [expenseAmount, method, orders, manualMap],
  );

  const total = computed.reduce((a, c) => a + c.amount, 0);
  const diff = Math.round((expenseAmount - total) * 100) / 100;

  async function onSave() {
    setLoading(true);
    try {
      const map: Record<string, number> | undefined =
        method === "MANUAL" ? manualMap : undefined;
      await allocateTripExpense(expenseId, method, map);
      toast.success("Expense allocated");
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to allocate";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Split className="h-3.5 w-3.5" />
          Allocate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate expense to orders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="font-medium">{expenseDescription}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {expenseAmount.toFixed(2)} {expenseCurrency}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as AllocationMethod)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOCATION_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Allocate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const c = computed.find((x) => x.orderId === o.orderId);
                  return (
                    <TableRow key={o.orderId}>
                      <TableCell className="font-medium">{o.number}</TableCell>
                      <TableCell className="text-xs">{o.customerName}</TableCell>
                      <TableCell className="text-right text-xs">{Number(o.weightKg ?? 0).toFixed(0)} kg</TableCell>
                      <TableCell className="text-right text-xs">{Number(o.volumeM3 ?? 0).toFixed(1)} m³</TableCell>
                      <TableCell className="text-right text-xs">{Number(o.distanceKm ?? 0).toFixed(0)} km</TableCell>
                      <TableCell className="text-right text-xs">{Number(o.revenue ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {method === "MANUAL" ? (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={manualMap[o.orderId] ?? ""}
                            onChange={(e) =>
                              setManualMap((prev) => ({
                                ...prev,
                                [o.orderId]: Number(e.target.value || 0),
                              }))
                            }
                            className="h-7 w-24 text-right font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono text-xs">
                            {(c?.amount ?? 0).toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Allocated total: <span className="font-mono">{total.toFixed(2)} {expenseCurrency}</span>
            </span>
            <span
              className={
                Math.abs(diff) < 0.01
                  ? "text-success font-medium"
                  : "text-destructive font-medium"
              }
            >
              Diff: {diff.toFixed(2)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={onSave}
            disabled={loading || (method === "MANUAL" && Math.abs(diff) > 0.01)}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
