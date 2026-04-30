"use client";

import { useTranslations } from "next-intl";
import { Flame, ArrowUp, Equal, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadPriority } from "@/lib/enums";

const config: Record<
  string,
  { className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  [LeadPriority.LOW]: {
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: ArrowDown,
  },
  [LeadPriority.MEDIUM]: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: Equal,
  },
  [LeadPriority.HIGH]: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: ArrowUp,
  },
  [LeadPriority.URGENT]: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: Flame,
  },
};

export function LeadPriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: string;
  showLabel?: boolean;
}) {
  const t = useTranslations();
  const c = config[priority] ?? config[LeadPriority.MEDIUM];
  const Icon = c.icon;
  const label =
    priority in LeadPriority ? t(`leads.priorities.${priority}`) : priority;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        c.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && label}
    </span>
  );
}

export function LeadScoreChip({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : score >= 50
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : score >= 25
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-medium tabular-nums",
        tone,
      )}
    >
      {score}
    </span>
  );
}
