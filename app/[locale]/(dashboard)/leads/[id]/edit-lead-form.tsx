"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { LeadStatus, LeadSource, LeadPriority } from "@/lib/enums";
import { LeadStatusBadge } from "@/components/app/lead-status-badge";
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type {
  CustomFieldDefinitionView,
  CustomFieldValueMap,
} from "@/lib/custom-fields";
import {
  ContactPicker,
  type ContactSnapshot,
} from "@/components/app/contact-picker";
import { updateLead } from "../actions";
import type { Lead, User, Contact } from "@prisma/client";

type LeadWithRelations = Lead & {
  assignedTo: Pick<User, "id" | "name"> | null;
  contact: Pick<
    Contact,
    "id" | "name" | "email" | "phone" | "company"
  > | null;
};

const SOURCE_OPTIONS = Object.values(LeadSource);
const PRIORITY_OPTIONS = Object.values(LeadPriority);
const UNASSIGNED = "__none__";

export function EditLeadForm({
  lead,
  users,
  customFields = [],
  customFieldValues = {},
}: {
  lead: LeadWithRelations;
  users: Pick<User, "id" | "name">[];
  customFields?: CustomFieldDefinitionView[];
  customFieldValues?: CustomFieldValueMap;
}) {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(false);
  const [source, setSource] = React.useState(lead.source ?? "");
  const [priority, setPriority] = React.useState(
    lead.priority ?? LeadPriority.MEDIUM,
  );
  const [assignedToId, setAssignedToId] = React.useState(
    lead.assignedToId ?? UNASSIGNED,
  );
  const [contact, setContact] = React.useState<ContactSnapshot | undefined>(
    lead.contact
      ? {
          id: lead.contact.id,
          name: lead.contact.name,
          email: lead.contact.email,
          phone: lead.contact.phone,
          company: lead.contact.company,
        }
      : undefined,
  );
  const [followUp, setFollowUp] = React.useState<Date | undefined>(
    lead.nextFollowUp ? new Date(lead.nextFollowUp) : undefined,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("source", source);
    fd.set("priority", priority);
    if (assignedToId && assignedToId !== UNASSIGNED) {
      fd.set("assignedToId", assignedToId);
    } else {
      fd.delete("assignedToId");
    }
    if (contact?.id) fd.set("contactId", contact.id);
    else fd.delete("contactId");
    if (followUp) fd.set("nextFollowUp", followUp.toISOString());
    else fd.delete("nextFollowUp");
    setLoading(true);
    try {
      await updateLead(lead.id, fd);
      toast.success(t("leads.updated"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={t("leads.contact")}>
        <ContactPicker
          value={contact?.id}
          initialContact={contact}
          onChange={setContact}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.name")} className="sm:col-span-2">
          <Input name="name" required defaultValue={lead.name} />
        </Field>
        <Field label={t("leads.company")}>
          <Input name="company" defaultValue={lead.company ?? ""} />
        </Field>
        <Field label={t("common.email")}>
          <Input name="email" type="email" defaultValue={lead.email ?? ""} />
        </Field>
        <Field label={t("common.phone")}>
          <Input name="phone" defaultValue={lead.phone ?? ""} />
        </Field>
        <Field label={t("leads.estimatedValue")}>
          <Input
            name="estimatedValue"
            type="number"
            step="0.01"
            defaultValue={Number(lead.estimatedValue)}
          />
        </Field>
        <Field label={t("leads.status")}>
          <div className="flex h-9 items-center px-1">
            <LeadStatusBadge status={lead.status} />
          </div>
        </Field>
        <Field label={t("leads.source")}>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder={t("leads.sourcePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`leads.sources.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("leads.priority")}>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`leads.priorities.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("leads.assignedTo")}>
          <Select value={assignedToId} onValueChange={setAssignedToId}>
            <SelectTrigger>
              <SelectValue placeholder={t("leads.unassigned")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>
                — {t("leads.unassigned")} —
              </SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("leads.score")}>
          <Input
            name="score"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={lead.score ?? 0}
          />
        </Field>
        <Field label={t("leads.nextFollowUp")}>
          <DateTimePicker
            value={followUp}
            onChange={setFollowUp}
            placeholder={t("leads.nextFollowUp")}
          />
        </Field>
        <Field label={t("common.notes")} className="sm:col-span-2">
          <Textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} />
        </Field>
        {lead.status === LeadStatus.LOST && (
          <Field label={t("leads.lostReason")} className="sm:col-span-2">
            <Textarea
              name="lostReason"
              rows={2}
              defaultValue={lead.lostReason ?? ""}
            />
          </Field>
        )}
      </div>
      <CustomFieldsForm definitions={customFields} values={customFieldValues} />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("common.save")}
        </Button>
      </div>
    </form>
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
