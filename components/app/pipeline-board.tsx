"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { LeadStatusBadge } from "./lead-status-badge";
import {
  LeadPriorityBadge,
  LeadScoreChip,
} from "./lead-priority-badge";
import { formatCurrency } from "@/lib/utils";
import { updateLeadStatus } from "@/app/[locale]/(dashboard)/leads/actions";
import {
  checkLeadTransition,
  type LeadForCheck,
  type TransitionTarget,
} from "@/lib/lead-transitions";
import { LeadStatus } from "@/lib/enums";
import { Building2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type PipelineLead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  estimatedValue: number;
  currency: string;
  nextFollowUp: Date | null;
  priority: string;
  score: number;
  contactId: string | null;
  customerId: string | null;
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  assignedTo: { name: string | null } | null;
};

const COLUMNS: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.LOST,
];

function transitionErrorKey(
  err: ReturnType<typeof checkLeadTransition>,
): string {
  if (err.ok) return "";
  switch (err.error.code) {
    case "INVALID_TRANSITION":
      return "leads.transition.errors.INVALID_TRANSITION";
    case "LEAD_TERMINAL":
      return "leads.transition.errors.LEAD_TERMINAL";
    case "CONTACT_REQUIRED":
      return "leads.transition.errors.CONTACT_REQUIRED";
    case "CONTACT_INVALID":
      return err.error.reason === "name"
        ? "leads.transition.errors.CONTACT_INVALID_NAME"
        : "leads.transition.errors.CONTACT_INVALID_PHONE_OR_EMAIL";
    case "CUSTOMER_REQUIRED":
      return "leads.transition.errors.CUSTOMER_REQUIRED";
  }
}

export function PipelineBoard({
  leads: initialLeads,
  locale,
}: {
  leads: PipelineLead[];
  locale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [leads, setLeads] = React.useState(initialLeads);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeLead = leads.find((l) => l.id === activeId);

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const newStatus = over.id as string;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || lead.status === newStatus) return;

    const target = newStatus as TransitionTarget;
    if (
      target !== LeadStatus.CONTACTED &&
      target !== LeadStatus.QUALIFIED &&
      target !== LeadStatus.LOST
    ) {
      // NEW is creation-only; nothing else exists.
      toast.error(
        t("leads.transition.errors.INVALID_TRANSITION", {
          from: lead.status,
          to: newStatus,
        }),
      );
      return;
    }

    const leadForCheck: LeadForCheck = {
      status: lead.status as LeadStatus,
      contactId: lead.contactId,
      customerId: lead.customerId,
      contact: lead.contact,
    };
    const check = checkLeadTransition(leadForCheck, target);

    // Soft-handle gates by routing the user to the inline fix flow on the
    // detail page rather than a hard-fail toast.
    if (!check.ok) {
      if (
        target === LeadStatus.CONTACTED &&
        (check.error.code === "CONTACT_REQUIRED" ||
          check.error.code === "CONTACT_INVALID")
      ) {
        toast.message(t("leads.transition.errors.CONTACT_REQUIRED"));
        router.push(`/leads/${lead.id}?action=contact`);
        return;
      }
      if (
        target === LeadStatus.QUALIFIED &&
        (check.error.code === "CONTACT_REQUIRED" ||
          check.error.code === "CONTACT_INVALID" ||
          check.error.code === "CUSTOMER_REQUIRED")
      ) {
        toast.message(t("leads.transition.errors.CUSTOMER_REQUIRED"));
        router.push(`/leads/${lead.id}?action=qualify`);
        return;
      }
      const key = transitionErrorKey(check);
      const params =
        check.error.code === "INVALID_TRANSITION"
          ? { from: check.error.from, to: check.error.to }
          : undefined;
      toast.error(t(key, params as never));
      return;
    }

    // LOST requires a reason — bounce to detail page for the dialog.
    if (target === LeadStatus.LOST) {
      router.push(`/leads/${lead.id}?action=lost`);
      return;
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l)),
    );

    try {
      const res = await updateLeadStatus({
        leadId: lead.id,
        nextStatus: target,
      });
      if (!res.ok) {
        const key =
          res.error.code === "LOST_REASON_REQUIRED"
            ? "leads.transition.errors.LOST_REASON_REQUIRED"
            : transitionErrorKey({ ok: false, error: res.error });
        toast.error(t(key));
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lead.id ? { ...l, status: lead.status } : l,
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: lead.status } : l)),
      );
      toast.error("Failed to update status");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 rounded-lg border border-dashed bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        {t("leads.kanbanBanner")}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column
            key={col}
            status={col}
            leads={leads.filter((l) => l.status === col)}
            locale={locale}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <LeadCard lead={activeLead} locale={locale} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  leads,
  locale,
}: {
  status: string;
  leads: PipelineLead[];
  locale: string;
}) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = leads.reduce((s, l) => s + l.estimatedValue, 0);
  const currency = leads[0]?.currency ?? "USD";

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LeadStatusBadge status={status} />
          <span className="text-xs text-muted-foreground">
            ({leads.length})
          </span>
        </div>
        {leads.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {formatCurrency(total, currency, locale)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-3">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} locale={locale} />
        ))}
        {leads.length === 0 && (
          <div className="flex h-12 items-center justify-center text-xs text-muted-foreground">
            {t("leads.pipeline.dropHere")}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  locale,
  isDragging,
}: {
  lead: PipelineLead;
  locale: string;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: dragging } =
    useDraggable({ id: lead.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border bg-background p-3 shadow-sm active:cursor-grabbing ${
        dragging || isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : ""
      }`}
    >
      <a
        href={`/leads/${lead.id}`}
        className="block"
        onClick={(e) => {
          if (dragging) e.preventDefault();
        }}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="text-sm font-medium leading-tight">{lead.name}</div>
          <div className="flex shrink-0 items-center gap-1">
            <LeadPriorityBadge priority={lead.priority} showLabel={false} />
            <LeadScoreChip score={lead.score} />
          </div>
        </div>
        {lead.company && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {lead.company}
          </div>
        )}
        {lead.estimatedValue > 0 && (
          <div className="mt-2 text-xs font-medium text-primary">
            {formatCurrency(lead.estimatedValue, lead.currency, locale)}
          </div>
        )}
        {lead.nextFollowUp && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(lead.nextFollowUp), "MMM d")}
          </div>
        )}
      </a>
    </div>
  );
}
