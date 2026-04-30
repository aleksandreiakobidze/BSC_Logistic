"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";

const PRESETS = ["7d", "30d", "mtd", "qtd", "ytd", "all", "custom"] as const;
export type RangePreset = (typeof PRESETS)[number];

export function DateRangeToolbar({
  range,
  dateFrom,
  dateTo,
  fromLabel,
  toLabel,
}: {
  range: RangePreset;
  dateFrom: string | null;
  dateTo: string | null;
  fromLabel: string;
  toLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [isPending, startTransition] = React.useTransition();

  const buildUrl = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    return `${pathname}?${params.toString()}`;
  };

  const setPreset = (next: RangePreset) => {
    const patch: Record<string, string | null> = { range: next };
    if (next !== "custom") {
      patch.dateFrom = null;
      patch.dateTo = null;
    }
    startTransition(() => router.push(buildUrl(patch)));
  };

  const setCustom = (key: "dateFrom" | "dateTo", value: Date | undefined) => {
    const iso = value ? value.toISOString().slice(0, 10) : null;
    startTransition(() =>
      router.push(buildUrl({ range: "custom", [key]: iso })),
    );
  };

  const fromDate = dateFrom ? new Date(dateFrom) : undefined;
  const toDate = dateTo ? new Date(dateTo) : undefined;

  return (
    <div
      className={cn(
        "no-print sticky top-2 z-20 rounded-2xl border bg-background/70 px-3 py-2.5 shadow-sm backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/55",
        isPending && "opacity-90",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          <span className="uppercase tracking-[0.18em]">
            {t("reports.dateRange")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-full border bg-muted/40 p-0.5">
          {PRESETS.map((p) => {
            const active = range === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={cn(
                  "relative rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`reports.presets.${p}`)}
                {active && p !== "custom" && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {range === "custom" && (
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {fromLabel}
            </div>
            <div className="w-[180px]">
              <DateTimePicker
                value={fromDate}
                onChange={(d) => setCustom("dateFrom", d)}
                placeholder={fromLabel}
              />
            </div>
            <div className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {toLabel}
            </div>
            <div className="w-[180px]">
              <DateTimePicker
                value={toDate}
                onChange={(d) => setCustom("dateTo", d)}
                placeholder={toLabel}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("30d")}
                className="h-8 text-[11px]"
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        )}

        {range !== "custom" && (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full border bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3 w-3" />
            {t("reports.livePeriod")}
          </div>
        )}
      </div>
    </div>
  );
}
