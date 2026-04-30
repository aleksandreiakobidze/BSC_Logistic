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
import { Building2, Calendar } from "lucide-react";
import { format } from "date-fns";

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
  assignedTo: { name: string | null } | null;
};

const COLUMNS = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export function PipelineBoard({
  leads: initialLeads,
  locale,
}: {
  leads: PipelineLead[];
  locale: string;
}) {
  const [leads, setLeads] = React.useState(initialLeads);
  const [activeId, setActiveId] = React.useState<string | null>(null);

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

    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l)),
    );

    try {
      await updateLeadStatus(lead.id, newStatus);
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
