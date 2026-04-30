"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { format, isBefore, startOfToday } from "date-fns";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { LeadPriorityBadge } from "@/components/app/lead-priority-badge";
import { LeadPriority } from "@/lib/enums";
import {
  createLeadTask,
  completeLeadTask,
  deleteLeadTask,
} from "../actions";

type Task = {
  id: string;
  title: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  assignedToId: string | null;
  priority: string;
  notes: string | null;
};

const PRIORITY_OPTIONS = Object.values(LeadPriority);

export function LeadTasks({
  leadId,
  tasks,
  users,
}: {
  leadId: string;
  tasks: Task[];
  users: { id: string; name: string | null }[];
}) {
  const t = useTranslations();
  const [showForm, setShowForm] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [priority, setPriority] = React.useState<string>(LeadPriority.MEDIUM);
  const [assignedTo, setAssignedTo] = React.useState<string>("__none__");
  const [dueAt, setDueAt] = React.useState<Date | undefined>();

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("priority", priority);
    if (assignedTo !== "__none__") fd.set("assignedToId", assignedTo);
    else fd.delete("assignedToId");
    if (dueAt) fd.set("dueAt", dueAt.toISOString());
    else fd.delete("dueAt");
    setCreating(true);
    try {
      await createLeadTask(leadId, fd);
      toast.success(t("leads.tasks.created"));
      form.reset();
      setShowForm(false);
      setPriority(LeadPriority.MEDIUM);
      setAssignedTo("__none__");
      setDueAt(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  async function onToggle(id: string) {
    setPendingId(id);
    try {
      await completeLeadTask(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t("leads.tasks.deleteConfirm"))) return;
    setPendingId(id);
    try {
      await deleteLeadTask(id);
      toast.success(t("leads.tasks.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPendingId(null);
    }
  }

  const today = startOfToday();

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          {t("leads.tasks.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const completed = !!task.completedAt;
            const due = task.dueAt ? new Date(task.dueAt) : null;
            const overdue = !completed && due && isBefore(due, today);
            const userName =
              users.find((u) => u.id === task.assignedToId)?.name ?? null;
            return (
              <li
                key={task.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  overdue ? "border-destructive/50 bg-destructive/5" : ""
                } ${completed ? "opacity-60" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(task.id)}
                  disabled={pendingId === task.id}
                  className="mt-0.5 shrink-0"
                  aria-label={
                    completed
                      ? t("leads.tasks.reopen")
                      : t("leads.tasks.complete")
                  }
                >
                  {pendingId === task.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : completed ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        completed ? "line-through" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                    <LeadPriorityBadge priority={task.priority} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {due && (
                      <span
                        className={`flex items-center gap-1 ${
                          overdue ? "text-destructive font-medium" : ""
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {format(due, "MMM d, yyyy HH:mm")}
                        {overdue && ` · ${t("leads.tasks.overdue")}`}
                      </span>
                    )}
                    {userName && <span>{userName}</span>}
                    {task.notes && <span className="italic">— {task.notes}</span>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(task.id)}
                  disabled={pendingId === task.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs">
              {t("leads.tasks.title")}
            </Label>
            <Input id="task-title" name="title" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("leads.tasks.due")}</Label>
              <DateTimePicker value={dueAt} onChange={setDueAt} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("leads.priority")}</Label>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("leads.assignedTo")}</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  — {t("leads.unassigned")} —
                </SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-notes" className="text-xs">
              {t("common.notes")}
            </Label>
            <Textarea id="task-notes" name="notes" rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={creating}>
              {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("leads.tasks.add")}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("leads.tasks.add")}
        </Button>
      )}
    </div>
  );
}
