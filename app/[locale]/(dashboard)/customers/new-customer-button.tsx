"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
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
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { createCustomer, updateCustomer } from "./actions";

export type CustomerDialogValue = {
  id: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  creditLimit?: number | null;
  notes?: string | null;
};

/**
 * Dual-purpose customer dialog. When `value` (with `id`) is supplied the
 * dialog acts as an edit form and calls `updateCustomer`; otherwise it
 * creates a new customer. Custom fields are wired in both modes via the
 * shared `CustomFieldsForm`.
 *
 * Use the `trigger` prop to render anything as the open-button (e.g. a
 * pencil icon button on the detail page) — defaults to `+ New customer`.
 */
export function CustomerDialog({
  customFields = [],
  value,
  values,
  trigger,
}: {
  customFields?: CustomFieldDefinitionView[];
  value?: CustomerDialogValue;
  values?: Record<string, unknown>;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = Boolean(value?.id);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      const res = isEdit
        ? await updateCustomer(value!.id, fd)
        : await createCustomer(fd);
      if (res.ok) {
        toast.success(isEdit ? "Customer updated" : "Customer created");
        if (!isEdit) form.reset();
        setOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> {t("customers.newCustomer")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent withDescription>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t.has("customers.editCustomer")
                ? t("customers.editCustomer")
                : "Edit customer"
              : t("customers.newCustomer")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t.has("customers.editCustomerDesc")
                ? t("customers.editCustomerDesc")
                : "Update this customer's details."
              : "Add a new customer to your CRM."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")}>
              <Input name="name" required defaultValue={value?.name ?? ""} />
            </Field>
            <Field label="Code">
              <Input name="code" placeholder="ACME" defaultValue={value?.code ?? ""} />
            </Field>
            <Field label={t("common.email")}>
              <Input name="email" type="email" defaultValue={value?.email ?? ""} />
            </Field>
            <Field label={t("common.phone")}>
              <Input name="phone" defaultValue={value?.phone ?? ""} />
            </Field>
            <Field label="Tax ID">
              <Input name="taxId" defaultValue={value?.taxId ?? ""} />
            </Field>
            <Field label={t("customers.creditLimit")}>
              <Input
                name="creditLimit"
                type="number"
                step="0.01"
                defaultValue={value?.creditLimit ?? 0}
              />
            </Field>
            <Field label={t("common.address")} className="sm:col-span-2">
              <Input name="address" defaultValue={value?.address ?? ""} />
            </Field>
            <Field label={t("common.city")}>
              <Input name="city" defaultValue={value?.city ?? ""} />
            </Field>
            <Field label={t("common.country")}>
              <Input name="country" defaultValue={value?.country ?? ""} />
            </Field>
            <Field label={t("common.notes")} className="sm:col-span-2">
              <Textarea name="notes" rows={3} defaultValue={value?.notes ?? ""} />
            </Field>
          </div>
          <CustomFieldsForm definitions={customFields} values={values} />
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

/** Backwards-compatible alias used by the customers list page header. */
export function NewCustomerButton({
  customFields = [],
}: {
  customFields?: CustomFieldDefinitionView[];
}) {
  return <CustomerDialog customFields={customFields} />;
}

/**
 * Edit-mode trigger for the customer detail page. Renders a small pencil
 * button next to the customer name that opens the same dialog in edit mode.
 */
export function EditCustomerButton({
  value,
  customFields = [],
  values,
}: {
  value: CustomerDialogValue;
  customFields?: CustomFieldDefinitionView[];
  values?: Record<string, unknown>;
}) {
  const t = useTranslations();
  return (
    <CustomerDialog
      value={value}
      customFields={customFields}
      values={values}
      trigger={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {t.has("common.edit") ? t("common.edit") : "Edit"}
        </Button>
      }
    />
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
