"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { SupplierOfferRow } from "./supplier-offers-table";

interface CostBreakdownProps {
  offers: SupplierOfferRow[];
  currency: string;
  locale: string;
}

/**
 * Per-team breakdown comparing the selected (winning) supplier offer to all
 * the alternatives in the same team. Useful to gut-check that the pricing
 * decision is defensible before clicking "Generate Quote".
 */
export function CostBreakdown({ offers, currency, locale }: CostBreakdownProps) {
  const t = useTranslations();
  const teams = React.useMemo(() => {
    const grouped = new Map<string, SupplierOfferRow[]>();
    for (const o of offers) {
      const arr = grouped.get(o.team) ?? [];
      arr.push(o);
      grouped.set(o.team, arr);
    }
    for (const arr of grouped.values()) {
      arr.sort((a, b) => a.totalCost - b.totalCost);
    }
    return Array.from(grouped.entries());
  }, [offers]);

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t("quotations.inquiry.noOffers")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {teams.map(([team, rows]) => {
        const winner = rows.find((r) => r.isSelected);
        const baseline = winner?.totalCost ?? rows[0].totalCost;
        return (
          <Card key={team}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {t(`quotations.inquiry.teams.${team}`)}
              </CardTitle>
              {winner && (
                <Badge variant="success" className="text-[10px]">
                  {winner.supplier.name} —{" "}
                  {formatCurrency(winner.totalCost, winner.currency, locale)}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("quotations.inquiry.supplier")}</TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.totalCost")}
                    </TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.transitTime")}
                    </TableHead>
                    <TableHead className="w-[80px]">
                      {t("suppliers.offerStatus")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => {
                    const delta = o.totalCost - baseline;
                    const isWinner = o.isSelected;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm font-medium">
                          {o.supplier.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(o.totalCost, o.currency, locale)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-xs ${
                            delta > 0
                              ? "text-rose-500"
                              : delta < 0
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {delta === 0
                            ? "—"
                            : (delta > 0 ? "+" : "") +
                              formatCurrency(
                                Math.abs(delta),
                                o.currency,
                                locale,
                              )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {o.transitTimeDays != null
                            ? `${o.transitTimeDays}d`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isWinner ? "success" : "outline"}
                            className="text-[10px]"
                          >
                            {isWinner
                              ? t("quotations.inquiry.selected")
                              : o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
