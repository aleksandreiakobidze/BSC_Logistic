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
import {
  Combobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { PhoneField } from "@/components/app/phone-input";
import { ContactStatus, ContactRelationshipType } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
import {
  createContact,
  updateContact,
  addContactLookup,
} from "./actions";

type Customer = { id: string; name: string };

type LookupItem = { id: string; value: string };

export type ContactValue = {
  id: string;
  code: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  taxId: string | null;
  industry: string | null;
  status: string;
  relationshipType: string;
  notes: string | null;
  customerId: string | null;
  createdAt: string;
};

export function NewContactButton({
  customers,
  defaultCustomerId,
  customFields = [],
  industries = [],
  jobTitles = [],
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  customFields?: CustomFieldDefinitionView[];
  industries?: LookupItem[];
  jobTitles?: LookupItem[];
}) {
  const t = useTranslations();
  return (
    <ContactDialog
      customers={customers}
      defaultCustomerId={defaultCustomerId}
      customFields={customFields}
      industries={industries}
      jobTitles={jobTitles}
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> {t("contacts.newContact")}
        </Button>
      }
    />
  );
}

export function EditContactButton({
  contact,
  customers,
  customFields = [],
  industries = [],
  jobTitles = [],
}: {
  contact: ContactValue;
  customers: Customer[];
  customFields?: CustomFieldDefinitionView[];
  industries?: LookupItem[];
  jobTitles?: LookupItem[];
}) {
  const t = useTranslations();
  return (
    <ContactDialog
      value={contact}
      customers={customers}
      customFields={customFields}
      industries={industries}
      jobTitles={jobTitles}
      trigger={
        <Button variant="ghost" size="icon" title={t("contacts.editContact")}>
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}

function ContactDialog({
  value,
  customers,
  defaultCustomerId,
  customFields = [],
  industries = [],
  jobTitles = [],
  trigger,
}: {
  value?: ContactValue;
  customers: Customer[];
  defaultCustomerId?: string;
  customFields?: CustomFieldDefinitionView[];
  industries?: LookupItem[];
  jobTitles?: LookupItem[];
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const isEdit = Boolean(value);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [customerId, setCustomerId] = React.useState(
    value?.customerId ?? defaultCustomerId ?? "",
  );
  const [phone, setPhone] = React.useState(value?.phone ?? "");
  const [jobTitle, setJobTitle] = React.useState(value?.jobTitle ?? "");
  const [industry, setIndustry] = React.useState(value?.industry ?? "");
  const [status, setStatus] = React.useState(
    value?.status ?? ContactStatus.ACTIVE,
  );
  const [relType, setRelType] = React.useState(
    value?.relationshipType ?? ContactRelationshipType.OTHER,
  );
  const [showNotes, setShowNotes] = React.useState(Boolean(value?.notes));

  React.useEffect(() => {
    if (open && value) {
      setCustomerId(value.customerId ?? "");
      setPhone(value.phone ?? "");
      setJobTitle(value.jobTitle ?? "");
      setIndustry(value.industry ?? "");
      setStatus(value.status);
      setRelType(value.relationshipType);
      setShowNotes(Boolean(value.notes));
    }
  }, [open, value]);

  const industryOptions: ComboboxOption[] = industries.map((i) => ({
    value: i.value,
    label: i.value,
  }));

  const jobTitleOptions: ComboboxOption[] = jobTitles.map((j) => ({
    value: j.value,
    label: j.value,
  }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    fd.set("customerId", customerId);
    fd.set("phone", phone);
    fd.set("jobTitle", jobTitle);
    fd.set("industry", industry);
    fd.set("status", status);
    fd.set("relationshipType", relType);

    setLoading(true);
    try {
      if (jobTitle && !jobTitles.some((j) => j.value === jobTitle)) {
        await addContactLookup("JOB_TITLE", jobTitle);
      }

      if (isEdit && value) {
        const res = await updateContact(value.id, fd);
        if (res.ok) {
          toast.success(t("contacts.updated"));
          setOpen(false);
          router.refresh();
        }
      } else {
        const res = await createContact(fd);
        if (res.ok) {
          toast.success(t("contacts.created"));
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
            {isEdit ? t("contacts.editContact") : t("contacts.newContact")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("contacts.editContactDescription")
              : t("contacts.newContactDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          key={value?.id ?? "new"}
          onSubmit={onSubmit}
          className="space-y-4"
        >
          {isEdit && value && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {t("contacts.code")}: {value.code}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {t("common.created")}: {formatDate(value.createdAt, "en")}
              </Badge>
            </div>
          )}
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              {t("contacts.codeAutoHint")}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("contacts.status")}>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContactStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`contacts.statuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("contacts.relationshipType")}>
              <Select value={relType} onValueChange={setRelType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContactRelationshipType).map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`contacts.relationshipTypes.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("contacts.companyName")}
              className="sm:col-span-2"
            >
              <Input
                name="company"
                defaultValue={value?.company ?? ""}
                placeholder="Acme Corp"
              />
            </Field>

            {customers.length > 0 && (
              <Field
                label={t("contacts.linkCustomer")}
                className="sm:col-span-2"
              >
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("contacts.linkCustomerHint")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">---</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label={t("contacts.taxId")} className="sm:col-span-2">
              <Input
                name="taxId"
                defaultValue={value?.taxId ?? ""}
                placeholder="e.g. 123456789"
                maxLength={50}
              />
            </Field>

            <Field label={t("contacts.fullName")} className="sm:col-span-2">
              <Input
                name="name"
                required
                defaultValue={value?.name ?? ""}
                placeholder="Jane Smith"
              />
            </Field>

            <Field label={t("common.phone")}>
              <PhoneField
                name="phone_display"
                value={phone}
                onChange={(v) => setPhone(v ?? "")}
              />
            </Field>

            <Field label={t("common.email")}>
              <Input
                name="email"
                type="email"
                defaultValue={value?.email ?? ""}
              />
            </Field>

            <Field label={t("contacts.jobTitle")} className="sm:col-span-2">
              <Combobox
                options={jobTitleOptions}
                value={jobTitle}
                onValueChange={(v) => setJobTitle(v ?? "")}
                placeholder={t("contacts.jobTitle")}
                searchPlaceholder="Search or type..."
              />
            </Field>

            <Field label={t("contacts.industry")} className="sm:col-span-2">
              <Combobox
                options={industryOptions}
                value={industry}
                onValueChange={(v) => setIndustry(v ?? "")}
                placeholder={t("contacts.industry")}
                searchPlaceholder="Search..."
              />
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
            <Field label={t("contacts.notes")}>
              <Textarea
                name="notes"
                defaultValue={value?.notes ?? ""}
                rows={3}
              />
            </Field>
          )}

          <CustomFieldsForm definitions={customFields} />

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
