"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { QuotationStatus } from "@/lib/enums";
import { generateQuoteFromSelected } from "./actions";
import type { SupplierOfferRow } from "./supplier-offers-table";

interface QuoteBuilderCardProps {
  quotationId: string;
  status: string;
  selectedOffers: SupplierOfferRow[];
  currency: string;
  locale: string;
}

export function QuoteBuilderCard({
  quotationId,
  status,
  selectedOffers,
  currency,
  locale,
}: QuoteBuilderCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const [markup, setMarkup] = React.useState("15");
  const [loading, setLoading] = React.useState(false);

  const isPricing = status === QuotationStatus.PRICING;
  const m = Number(markup) || 0;

  const previewLines = React.useMemo(
    () =>
      selectedOffers.map((o) => {
        const sell = round2(o.totalCost * (1 + m / 100));
        return {
          id: o.id,
          team: o.team,
          supplier: o.supplier.name,
          cost: o.totalCost,
          currency: o.currency,
          sell,
        };
      }),
    [selectedOffers, m],
  );

  const totals = previewLines.reduce(
    (acc, l) => ({
      cost: acc.cost + l.cost,
      sell: acc.sell + l.sell,
    }),
    { cost: 0, sell: 0 },
  );

  async function onGenerate() {
    setLoading(true);
    try {
      const res = await generateQuoteFromSelected({
        quotationId,
        defaultMarkupPercent: m,
        replaceExisting: true,
      });
      if (res.ok) {
        toast.success(`+${res.linesCreated} lines`);
        router.refresh();
      } else {
        toast.error(res.error.code);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.quoteBuilder")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("quotations.inquiry.selectWinnerHint")}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Label className="text-xs">
                {t("quotations.inquiry.generateQuoteMarkup")}
              </Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">
                Margin {totals.cost > 0
                  ? (((totals.sell - totals.cost) / totals.sell) * 100).toFixed(
                      1,
                    )
                  : "0.0"}
                %
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("quotations.inquiry.team")}</TableHead>
                    <TableHead>{t("quotations.inquiry.supplier")}</TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.totalCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.sellPrice")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewLines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`quotations.inquiry.teams.${l.team}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {l.supplier}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(l.cost, l.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(l.sell, currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {isPricing && (
              <div className="flex justify-end">
                <Button
                  onClick={onGenerate}
                  disabled={loading || selectedOffers.length === 0}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSignature className="mr-2 h-4 w-4" />
                  )}
                  {t("quotations.actions.generateQuote")}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
