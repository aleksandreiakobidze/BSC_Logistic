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
import { LeadStatus, LeadSource } from "@/lib/enums";
import { updateLead } from "../actions";
import type { Lead, User } from "@prisma/client";

type LeadWithAssigned = Lead & { assignedTo: Pick<User, "id" | "name"> | null };

const STATUS_OPTIONS = Object.values(LeadStatus);
const SOURCE_OPTIONS = Object.values(LeadSource);

export function EditLeadForm({
  lead,
  users,
}: {
  lead: LeadWithAssigned;
  users: Pick<User, "id" | "name">[];
}) {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState(lead.status);
  const [source, setSource] = React.useState(lead.source ?? "");
  const [assignedToId, setAssignedToId] = React.useState(
    lead.assignedToId ?? "",
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("status", status);
    fd.set("source", source);
    fd.set("assignedToId", assignedToId);
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
        <Field label={t("leads.assignedTo")}>
          <Select value={assignedToId} onValueChange={setAssignedToId}>
            <SelectTrigger>
              <SelectValue placeholder={t("leads.unassigned")} />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("leads.nextFollowUp")}>
          <Input
            name="nextFollowUp"
            type="date"
            defaultValue={
              lead.nextFollowUp
                ? new Date(lead.nextFollowUp).toISOString().slice(0, 10)
                : ""
            }
          />
        </Field>
        <Field label={t("common.notes")} className="sm:col-span-2">
          <Textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} />
        </Field>
        {status === "LOST" && (
          <Field label={t("leads.lostReason")} className="sm:col-span-2">
            <Textarea
              name="lostReason"
              rows={2}
              defaultValue={lead.lostReason ?? ""}
            />
          </Field>
        )}
      </div>
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
