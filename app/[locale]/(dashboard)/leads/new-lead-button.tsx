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
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import {
  ContactPicker,
  type ContactSnapshot,
} from "@/components/app/contact-picker";
import { createLead } from "./actions";

const STATUS_OPTIONS = Object.values(LeadStatus);
const SOURCE_OPTIONS = Object.values(LeadSource);
const PRIORITY_OPTIONS = Object.values(LeadPriority);
const UNASSIGNED = "__none__";

export function NewLeadButton({
  users = [],
  customFields = [],
}: {
  users?: { id: string; name: string | null }[];
  customFields?: CustomFieldDefinitionView[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string>(LeadStatus.NEW);
  const [source, setSource] = React.useState<string>("");
  const [priority, setPriority] = React.useState<string>(LeadPriority.MEDIUM);
  const [assignedTo, setAssignedTo] = React.useState<string>(UNASSIGNED);
  const [contact, setContact] = React.useState<ContactSnapshot | undefined>();
  const [followUp, setFollowUp] = React.useState<Date | undefined>();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");

  function applyContact(c: ContactSnapshot | undefined) {
    setContact(c);
    if (c) {
      if (!name) setName(c.name);
      if (!email && c.email) setEmail(c.email);
      if (!phone && c.phone) setPhone(c.phone);
      if (!company && c.company) setCompany(c.company);
    }
  }

  function reset() {
    setStatus(LeadStatus.NEW);
    setSource("");
    setPriority(LeadPriority.MEDIUM);
    setAssignedTo(UNASSIGNED);
    setContact(undefined);
    setFollowUp(undefined);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("status", status);
      fd.set("source", source);
      fd.set("priority", priority);
      if (assignedTo !== UNASSIGNED) fd.set("assignedToId", assignedTo);
      else fd.delete("assignedToId");
      if (contact?.id) fd.set("contactId", contact.id);
      if (followUp) fd.set("nextFollowUp", followUp.toISOString());
      else fd.delete("nextFollowUp");
      const res = await createLead(fd);
      if (res.ok) {
        toast.success(t("leads.created"));
        form.reset();
        reset();
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
          <Plus className="h-4 w-4" /> {t("leads.newLead")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" withDescription>
        <DialogHeader>
          <DialogTitle>{t("leads.newLead")}</DialogTitle>
          <DialogDescription>{t("leads.newLeadDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t("leads.contact")}>
            <ContactPicker value={contact?.id} onChange={applyContact} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")} className="sm:col-span-2">
              <Input
                name="name"
                required
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t("leads.company")}>
              <Input
                name="company"
                placeholder="Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </Field>
            <Field label={t("common.email")}>
              <Input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label={t("common.phone")}>
              <Input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label={t("leads.estimatedValue")}>
              <Input
                name="estimatedValue"
                type="number"
                step="0.01"
                defaultValue={0}
              />
            </Field>
            <Field label={t("leads.status")}>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`leads.statuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
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
                defaultValue={0}
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
              <Textarea name="notes" rows={3} />
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
