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
import { LeadStatus, LeadSource } from "@/lib/enums";
import { createLead } from "./actions";

const STATUS_OPTIONS = Object.values(LeadStatus);
const SOURCE_OPTIONS = Object.values(LeadSource);

export function NewLeadButton() {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string>(LeadStatus.NEW);
  const [source, setSource] = React.useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("status", status);
      fd.set("source", source);
      const res = await createLead(fd);
      if (res.ok) {
        toast.success(t("leads.created"));
        form.reset();
        setStatus(LeadStatus.NEW);
        setSource("");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("leads.newLead")}</DialogTitle>
          <DialogDescription>{t("leads.newLeadDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")} className="sm:col-span-2">
              <Input name="name" required placeholder="John Doe" />
            </Field>
            <Field label={t("leads.company")}>
              <Input name="company" placeholder="Acme Corp" />
            </Field>
            <Field label={t("common.email")}>
              <Input name="email" type="email" />
            </Field>
            <Field label={t("common.phone")}>
              <Input name="phone" />
            </Field>
            <Field label={t("leads.estimatedValue")}>
              <Input name="estimatedValue" type="number" step="0.01" defaultValue={0} />
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
            <Field label={t("leads.nextFollowUp")}>
              <Input name="nextFollowUp" type="date" />
            </Field>
            <Field label={t("common.notes")} className="sm:col-span-2">
              <Textarea name="notes" rows={3} />
            </Field>
          </div>
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
