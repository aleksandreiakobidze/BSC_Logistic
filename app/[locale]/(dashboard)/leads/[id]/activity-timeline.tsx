"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Loader2, MessageSquare, PhoneCall, Mail, Users, GitBranch, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityKind } from "@/lib/enums";
import { addActivity } from "../actions";
import type { LeadActivity } from "@prisma/client";

const kindIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  [ActivityKind.NOTE]: MessageSquare,
  [ActivityKind.CALL]: PhoneCall,
  [ActivityKind.EMAIL]: Mail,
  [ActivityKind.MEETING]: Users,
  [ActivityKind.STATUS_CHANGE]: GitBranch,
};

const KIND_OPTIONS = [
  ActivityKind.NOTE,
  ActivityKind.CALL,
  ActivityKind.EMAIL,
  ActivityKind.MEETING,
];

export function ActivityTimeline({
  leadId,
  activities,
}: {
  leadId: string;
  activities: LeadActivity[];
}) {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(false);
  const [kind, setKind] = React.useState(ActivityKind.NOTE);
  const [note, setNote] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("note", note);
    setLoading(true);
    try {
      await addActivity(leadId, fd);
      toast.success(t("leads.activityAdded"));
      setNote("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add activity form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`leads.activityKinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            className="min-h-[40px] flex-1 resize-none"
            placeholder={t("leads.activityPlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={loading || !note.trim()}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t("leads.logActivity")}
          </Button>
        </div>
      </form>

      {/* Timeline */}
      <div className="space-y-3">
        {activities.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            {t("leads.noActivity")}
          </p>
        )}
        {activities.map((a) => {
          const Icon = kindIcon[a.kind] ?? MessageSquare;
          return (
            <div key={a.id} className="flex gap-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize">
                    {a.kind.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(a.at), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                {a.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
