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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneField } from "@/components/app/phone-input";
import { SupplierStatus, SupplierType } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
import { createSupplier, updateSupplier } from "./actions";

type UserOption = { id: string; name: string | null };

const CURRENCY_OPTIONS = ["USD", "EUR", "GEL", "RUB", "GBP", "CNY"];

export type SupplierValue = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  paymentTerms: string | null;
  defaultTransitTimeDays: number | null;
  notes: string | null;
  ownerId: string | null;
  createdAt: string;
};

export function NewSupplierButton({ users = [] }: { users?: UserOption[] }) {
  const t = useTranslations();
  return (
    <SupplierDialog
      users={users}
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> {t("suppliers.newSupplier")}
        </Button>
      }
    />
  );
}

export function EditSupplierButton({
  supplier,
  users = [],
}: {
  supplier: SupplierValue;
  users?: UserOption[];
}) {
  const t = useTranslations();
  return (
    <SupplierDialog
      value={supplier}
      users={users}
      trigger={
        <Button variant="ghost" size="icon" title={t("suppliers.editSupplier")}>
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}

function SupplierDialog({
  value,
  users,
  trigger,
}: {
  value?: SupplierValue;
  users: UserOption[];
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = Boolean(value);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [type, setType] = React.useState(value?.type ?? SupplierType.OTHER);
  const [status, setStatus] = React.useState(
    value?.status ?? SupplierStatus.ACTIVE,
  );
  const [currency, setCurrency] = React.useState(value?.currency ?? "USD");
  const [phone, setPhone] = React.useState(value?.phone ?? "");
  const [ownerId, setOwnerId] = React.useState(value?.ownerId ?? "none");
  const [showNotes, setShowNotes] = React.useState(Boolean(value?.notes));

  React.useEffect(() => {
    if (open && value) {
      setType(value.type);
      setStatus(value.status);
      setCurrency(value.currency);
      setPhone(value.phone ?? "");
      setOwnerId(value.ownerId ?? "none");
      setShowNotes(Boolean(value.notes));
    }
  }, [open, value]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("type", type);
    fd.set("status", status);
    fd.set("currency", currency);
    fd.set("phone", phone);
    fd.set("ownerId", ownerId);

    setLoading(true);
    try {
      if (isEdit && value) {
        const res = await updateSupplier(value.id, fd);
        if (res.ok) {
          toast.success(t("suppliers.updated"));
          setOpen(false);
          router.refresh();
        }
      } else {
        const res = await createSupplier(fd);
        if (res.ok) {
          toast.success(t("suppliers.created"));
          form.reset();
          setOpen(false);
          router.refresh();
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        withDescription
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("suppliers.editSupplier") : t("suppliers.newSupplier")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("suppliers.editSupplierDescription")
              : t("suppliers.newSupplierDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          key={value?.id ?? "new"}
          onSubmit={onSubmit}
          className="space-y-4"
        >
          {isEdit && value && (
            <div className="flex flex-wrap gap-2">
              {value.code && (
                <Badge variant="outline" className="text-xs">
                  {t("suppliers.code")}: {value.code}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {t("common.created")}: {formatDate(value.createdAt, "en")}
              </Badge>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("suppliers.status")}>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SupplierStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`suppliers.statuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("suppliers.type")}>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SupplierType).map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`suppliers.types.${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("suppliers.name")} className="sm:col-span-2">
              <Input
                name="name"
                required
                defaultValue={value?.name ?? ""}
                placeholder="Maersk"
              />
            </Field>

            <Field label={t("common.email")}>
              <Input
                name="email"
                type="email"
                defaultValue={value?.email ?? ""}
              />
            </Field>

            <Field label={t("common.phone")}>
              <PhoneField
                name="phone_display"
                value={phone}
                onChange={(v) => setPhone(v ?? "")}
              />
            </Field>

            <Field label={t("suppliers.website")}>
              <Input
                name="website"
                defaultValue={value?.website ?? ""}
                placeholder="https://"
              />
            </Field>

            <Field label={t("contacts.taxId")}>
              <Input
                name="taxId"
                defaultValue={value?.taxId ?? ""}
                maxLength={50}
              />
            </Field>

            <Field label={t("common.country")}>
              <Input name="country" defaultValue={value?.country ?? ""} />
            </Field>

            <Field label={t("common.city")}>
              <Input name="city" defaultValue={value?.city ?? ""} />
            </Field>

            <Field label={t("common.address")} className="sm:col-span-2">
              <Input name="address" defaultValue={value?.address ?? ""} />
            </Field>

            <Field label={t("common.currency")}>
              <Select value={currency} onValueChange={setCurrency}>
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

            <Field label={t("suppliers.paymentTerms")}>
              <Input
                name="paymentTerms"
                defaultValue={value?.paymentTerms ?? ""}
                placeholder="NET 30"
              />
            </Field>

            <Field label={t("suppliers.defaultTransitTimeDays")}>
              <Input
                name="defaultTransitTimeDays"
                type="number"
                min={0}
                defaultValue={value?.defaultTransitTimeDays ?? ""}
              />
            </Field>

            <Field label={t("suppliers.owner")}>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!showNotes && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0 text-xs"
              onClick={() => setShowNotes(true)}
            >
              + {t("contacts.additionalNotes")}
            </Button>
          )}
          {showNotes && (
            <Field label={t("common.notes")}>
              <Textarea
                name="notes"
                defaultValue={value?.notes ?? ""}
                rows={3}
              />
            </Field>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
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
