"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp, DollarSign, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CostSummaryBarProps {
  bestCost: number;
  sellPrice: number;
  currency: string;
  locale: string;
}

/**
 * Pure presentational header strip with the four headline RFQ KPIs.
 * Best Cost = sum of selected supplier offers (in quote currency).
 * Sell Price = current quotation total (after Generate Quote).
 * Margin = sell − cost.
 * Profit% = margin / sell.
 */
export function CostSummaryBar({
  bestCost,
  sellPrice,
  currency,
  locale,
}: CostSummaryBarProps) {
  const t = useTranslations();
  const margin = round2(sellPrice - bestCost);
  const profitPct = sellPrice > 0 ? round2((margin / sellPrice) * 100) : 0;
  const profitTone =
    margin > 0 ? "text-emerald-600" : margin < 0 ? "text-rose-600" : "text-muted-foreground";

  return (
    <Card className="grid gap-2 p-4 sm:grid-cols-4">
      <Tile
        icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
        label={t("quotations.inquiry.bestCost")}
        value={formatCurrency(bestCost, currency, locale)}
      />
      <Tile
        icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        label={t("quotations.inquiry.sellPrice")}
        value={formatCurrency(sellPrice, currency, locale)}
      />
      <Tile
        icon={<DollarSign className={`h-4 w-4 ${profitTone}`} />}
        label={t("quotations.inquiry.margin")}
        value={formatCurrency(margin, currency, locale)}
        tone={profitTone}
      />
      <Tile
        icon={<Percent className={`h-4 w-4 ${profitTone}`} />}
        label={t("quotations.inquiry.profit")}
        value={`${profitPct.toFixed(1)}%`}
        tone={profitTone}
      />
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`truncate text-base font-semibold ${tone ?? ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
