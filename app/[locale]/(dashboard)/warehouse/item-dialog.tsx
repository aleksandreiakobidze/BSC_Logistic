"use client";

import * as React from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStockItem, updateStockItem } from "./items-actions";

export type StockItemDialogValue = {
  id?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  unit?: string;
  unitPrice?: number | string;
  currency?: string;
  taxRate?: number | string;
  weightKg?: number | string | null;
  notes?: string | null;
};

/**
 * Dual-purpose create/edit dialog. Pass a `value` (with `id`) to edit; omit
 * to create a new item. The `trigger` prop lets callers wrap their own row
 * (e.g. a clickable table row) — defaults to a "+ New item" button.
 */
export function ItemDialog({
  value,
  trigger,
}: {
  value?: StockItemDialogValue;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(value?.id);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      id: value?.id,
      sku: String(fd.get("sku") ?? ""),
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      unit: String(fd.get("unit") ?? "pcs"),
      unitPrice: String(fd.get("unitPrice") ?? "0"),
      currency: String(fd.get("currency") ?? "USD"),
      taxRate: String(fd.get("taxRate") ?? "0"),
      weightKg: String(fd.get("weightKg") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    setLoading(true);
    try {
      const res = isEdit
        ? await updateStockItem(payload)
        : await createStockItem(payload);
      if (res.ok) {
        toast.success(isEdit ? "Item updated" : "Item created");
        if (!isEdit) form.reset();
        setOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> New item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent withDescription>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "New item"}</DialogTitle>
          <DialogDescription>
            Items can be picked from quotation lines to autofill price, currency
            and tax.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU">
              <Input name="sku" defaultValue={value?.sku ?? ""} required />
            </Field>
            <Field label="Name">
              <Input name="name" defaultValue={value?.name ?? ""} required />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input name="description" defaultValue={value?.description ?? ""} />
            </Field>
            <Field label="Unit (e.g. pcs, kg)">
              <Input name="unit" defaultValue={value?.unit ?? "pcs"} />
            </Field>
            <Field label="Currency">
              <Input name="currency" defaultValue={value?.currency ?? "USD"} />
            </Field>
            <Field label="Unit price">
              <Input
                name="unitPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={value?.unitPrice ?? 0}
              />
            </Field>
            <Field label="Tax rate (%)">
              <Input
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={value?.taxRate ?? 0}
              />
            </Field>
            <Field label="Weight (kg)">
              <Input
                name="weightKg"
                type="number"
                step="0.001"
                min="0"
                defaultValue={value?.weightKg ?? ""}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea name="notes" rows={3} defaultValue={value?.notes ?? ""} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Create item"}
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
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
