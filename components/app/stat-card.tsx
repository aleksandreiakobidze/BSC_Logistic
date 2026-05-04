import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

type Accent = "primary" | "success" | "warning" | "destructive" | "danger";

const accentBg: Record<Accent, string> = {
  primary: "hsl(var(--primary) / 0.12)",
  success: "hsl(var(--success) / 0.14)",
  warning: "hsl(var(--warning) / 0.14)",
  destructive: "hsl(var(--danger) / 0.12)",
  danger: "hsl(var(--danger) / 0.12)",
};

const accentFg: Record<Accent, string> = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--danger))",
  danger: "hsl(var(--danger))",
};

function Sparkline({ data, w = 70, h = 26 }: { data: number[]; w?: number; h?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const step = w / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} className="sparkline" aria-hidden>
      <path d={area} className="area" />
      <path d={line} className="line" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  spark,
  accent = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  trend?: { delta: number; suffix?: string; deltaInvert?: boolean; label?: string };
  spark?: number[];
  accent?: Accent;
  className?: string;
}) {
  const isPositive = trend
    ? trend.deltaInvert
      ? trend.delta < 0
      : trend.delta >= 0
    : true;
  const trendCls = isPositive ? "pill-success" : "pill-danger";
  const TrendIcon = trend && trend.delta >= 0 ? ArrowUp : ArrowDown;

  return (
    <div className={cn("card flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-dim text-[11.5px] font-medium uppercase tracking-wider">
          {label}
        </div>
        {Icon && (
          <div
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{ background: accentBg[accent], color: accentFg[accent] }}
          >
            <Icon className="h-[13px] w-[13px]" strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="big-num text-[28px] leading-none">{value}</div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
      {(trend || hint) && (
        <div className="flex items-center gap-2 text-[11px]">
          {trend && (
            <span className={cn("pill num", trendCls)}>
              <TrendIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
              {Math.abs(trend.delta).toFixed(1)}
              {trend.suffix ?? "%"}
            </span>
          )}
          <span className="text-dim">
            {trend?.label ?? hint ?? "vs last period"}
          </span>
        </div>
      )}
    </div>
  );
}
