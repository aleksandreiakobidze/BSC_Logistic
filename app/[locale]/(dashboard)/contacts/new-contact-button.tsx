"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { createContact } from "./actions";

type Customer = { id: string; name: string };

export function NewContactButton({
  customers,
  defaultCustomerId,
  customFields = [],
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  customFields?: CustomFieldDefinitionView[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customerId, setCustomerId] = React.useState(
    defaultCustomerId ?? customers[0]?.id ?? "",
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("customerId", customerId);
    setLoading(true);
    try {
      const res = await createContact(fd);
      if (res.ok) {
        toast.success(t("contacts.created"));
        form.reset();
        setOpen(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("contacts.newContact")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("contacts.newContact")}</DialogTitle>
          <DialogDescription>{t("contacts.newContactDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {!defaultCustomerId && (
              <Field label={t("contacts.customer")} className="sm:col-span-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("contacts.selectCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label={t("common.name")} className="sm:col-span-2">
              <Input name="name" required placeholder="Jane Smith" />
            </Field>
            <Field label={t("contacts.position")} className="sm:col-span-2">
              <Input name="position" placeholder="Operations Manager" />
            </Field>
            <Field label={t("common.email")}>
              <Input name="email" type="email" />
            </Field>
            <Field label={t("common.phone")}>
              <Input name="phone" />
            </Field>
          </div>
          <CustomFieldsForm definitions={customFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
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
