import { cn } from "@/lib/utils";
import { LeadStatus } from "@/lib/enums";

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  [LeadStatus.NEW]: {
    label: "New",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  [LeadStatus.CONTACTED]: {
    label: "Contacted",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  [LeadStatus.QUALIFIED]: {
    label: "Qualified",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  [LeadStatus.LOST]: {
    label: "Lost",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

export function LeadStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
