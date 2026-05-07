"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Hash } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createItem, updateItem, type CreatedItem } from "./actions";

const UNIT_OPTIONS = [
  "pcs",
  "box",
  "carton",
  "case",
  "pallet",
  "sack",
  "pack",
  "roll",
  "crate",
  "bundle",
  "kg",
  "liter",
  "m",
  "m²",
  "m³",
] as const;

const CURRENCY_OPTIONS = ["USD", "EUR", "GEL", "RUB", "GBP", "TRY", "AED"] as const;

export type ItemDialogValue = {
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
 * to create a new item. Pass `defaults` (without `id`) to pre-populate fields
 * on a fresh create form — used by the StockItemPicker's "Create new with SKU
 * X" CTA.
 */
export function ItemDialog({
  value,
  defaults,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: {
  value?: ItemDialogValue;
  defaults?: ItemDialogValue;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Fired after a successful create. Receives the freshly-created item in the
   * shape the picker / quotation line editor expects.
   */
  onCreated?: (item: CreatedItem) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = Boolean(value?.id);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setInternalOpen(next);
    },
    [controlledOpen, onOpenChange],
  );
  const [loading, setLoading] = React.useState(false);

  const seed = (value ?? defaults) as ItemDialogValue | undefined;

  const tx = (key: string, fb: string) => (t.has(key) ? t(key) : fb);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Required-field guard: shadcn `Select` only renders its hidden input
    // after the user opens the dropdown at least once, so reading currency /
    // unit straight from FormData can yield undefined on first save. Falling
    // back to the seed values + sane defaults keeps create from silently
    // failing schema validation.
    const sku = String(fd.get("sku") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    if (!sku || !name) {
      toast.error(tx("items.requiredMissing", "SKU and name are required."));
      return;
    }

    const payload = {
      id: value?.id,
      sku,
      name,
      description: String(fd.get("description") ?? ""),
      unit: String(fd.get("unit") ?? seed?.unit ?? "pcs"),
      unitPrice: String(fd.get("unitPrice") ?? "0"),
      currency: String(fd.get("currency") ?? seed?.currency ?? "USD"),
      taxRate: String(fd.get("taxRate") ?? "0"),
      weightKg: String(fd.get("weightKg") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    setLoading(true);
    try {
      const res = isEdit ? await updateItem(payload) : await createItem(payload);
      if (!res.ok) {
        toast.error(res.error || t("common.error"));
        console.error("[item-dialog] save failed", res);
        return;
      }
      toast.success(
        isEdit
          ? tx("items.updated", "Item updated")
          : tx("items.created", "Item created"),
      );
      if (!isEdit) {
        form.reset();
        const created = res as { item?: CreatedItem };
        if (created.item && onCreated) onCreated(created.item);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[item-dialog] save threw", err);
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus className="h-4 w-4" /> {tx("items.new", "New item")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent withDescription className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <Pencil className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Plus className="h-4 w-4 text-muted-foreground" />
            )}
            {isEdit
              ? tx("items.edit", "Edit item")
              : tx("items.new", "New item")}
          </DialogTitle>
          <DialogDescription>
            {tx(
              "items.dialogDesc",
              "Items can be picked from quotation lines to autofill description, price, currency and tax.",
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          key={`${value?.id ?? "new"}-${seed?.sku ?? ""}-${seed?.name ?? ""}`}
          onSubmit={onSubmit}
          className="space-y-5"
        >
          {/* Identity */}
          <Section title={tx("items.section.identity", "Identity")}>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Field label={tx("items.fields.sku", "SKU")} required>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="sku"
                    defaultValue={seed?.sku ?? ""}
                    required
                    placeholder="SKU-1001"
                    className="pl-8 font-mono uppercase"
                  />
                </div>
              </Field>
              <Field label={tx("items.fields.name", "Name")} required>
                <Input
                  name="name"
                  defaultValue={seed?.name ?? ""}
                  required
                  placeholder={tx("items.fields.namePlaceholder", "Pallet of oak planks")}
                />
              </Field>
            </div>
            <Field label={tx("items.fields.description", "Description")}>
              <Textarea
                name="description"
                rows={2}
                defaultValue={seed?.description ?? ""}
                placeholder={tx(
                  "items.fields.descriptionPlaceholder",
                  "Free-form details that appear on quotations and invoices.",
                )}
              />
            </Field>
          </Section>

          {/* Pricing */}
          <Section title={tx("items.section.pricing", "Pricing")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tx("items.fields.unitPrice", "Unit price")}>
                <Input
                  name="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={seed?.unitPrice ?? 0}
                />
              </Field>
              <Field label={tx("items.fields.currency", "Currency")}>
                <Select name="currency" defaultValue={String(seed?.currency ?? "USD")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tx("items.fields.taxRate", "Tax rate (%)")}>
                <Input
                  name="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={seed?.taxRate ?? 0}
                />
              </Field>
            </div>
          </Section>

          {/* Logistics */}
          <Section title={tx("items.section.logistics", "Logistics")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tx("items.fields.unit", "Unit of measure")}>
                <Select name="unit" defaultValue={String(seed?.unit ?? "pcs")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tx("items.fields.weightKg", "Weight (kg)")}>
                <Input
                  name="weightKg"
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue={seed?.weightKg ?? ""}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label={tx("items.fields.notes", "Notes")}>
              <Textarea name="notes" rows={2} defaultValue={seed?.notes ?? ""} />
            </Field>
          </Section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? t("common.save") : tx("items.createBtn", "Create item")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
