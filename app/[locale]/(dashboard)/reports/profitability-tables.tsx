"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface PnLRow {
  id: string;
  label: string;
  sub?: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number;
  marginNumeric: number;
  revenueNumeric: number;
  costNumeric: number;
  /** ISO 4217 code used to format the totals row consistently. */
  currency?: string;
}

/**
 * Pre-formatted totals strings — produced server-side so client hydration
 * can't disagree with Node's `Intl` output.
 */
export interface PnLTotals {
  revenue: string;
  cost: string;
  margin: string;
  marginNumeric: number;
  marginPct: number;
}

function totalsFromRows(rows: PnLRow[]): {
  revenueNum: number;
  costNum: number;
  marginNum: number;
  marginPct: number;
} {
  const revenueNum = rows.reduce((acc, r) => acc + r.revenueNumeric, 0);
  const costNum = rows.reduce((acc, r) => acc + r.costNumeric, 0);
  const marginNum = rows.reduce((acc, r) => acc + r.marginNumeric, 0);
  const marginPct = revenueNum > 0 ? (marginNum / revenueNum) * 100 : 0;
  return { revenueNum, costNum, marginNum, marginPct };
}

export function ProfitabilityTables({
  byOrder,
  byTrip,
  byCustomer,
  byVehicle,
  byDriver,
  totals,
}: {
  byOrder: PnLRow[];
  byTrip: PnLRow[];
  byCustomer: PnLRow[];
  byVehicle: PnLRow[];
  byDriver: PnLRow[];
  totals: {
    order: PnLTotals;
    trip: PnLTotals;
    customer: PnLTotals;
    vehicle: PnLTotals;
    driver: PnLTotals;
  };
}) {
  return (
    <Tabs defaultValue="order">
      <TabsList>
        <TabsTrigger value="order">By Order</TabsTrigger>
        <TabsTrigger value="trip">By Trip</TabsTrigger>
        <TabsTrigger value="customer">By Customer</TabsTrigger>
        <TabsTrigger value="vehicle">By Vehicle</TabsTrigger>
        <TabsTrigger value="driver">By Driver</TabsTrigger>
      </TabsList>
      <TabsContent value="order">
        <PnLTable rows={byOrder} totals={totals.order} />
      </TabsContent>
      <TabsContent value="trip">
        <PnLTable rows={byTrip} totals={totals.trip} />
      </TabsContent>
      <TabsContent value="customer">
        <PnLTable rows={byCustomer} totals={totals.customer} />
      </TabsContent>
      <TabsContent value="vehicle">
        <PnLTable rows={byVehicle} totals={totals.vehicle} />
      </TabsContent>
      <TabsContent value="driver">
        <PnLTable rows={byDriver} totals={totals.driver} />
      </TabsContent>
    </Tabs>
  );
}

function PnLTable({ rows, totals }: { rows: PnLRow[]; totals: PnLTotals }) {
  const t = useTranslations();

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-muted-foreground">No data.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="group">
                <TableCell className="relative before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary before:opacity-0 group-hover:before:opacity-70 before:transition-opacity">
                  <div className="font-medium">{r.label}</div>
                  {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{r.revenue}</TableCell>
                <TableCell className="text-right font-mono text-sm">{r.cost}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${r.marginNumeric >= 0 ? "text-success" : "text-destructive"}`}>
                  {r.margin}
                </TableCell>
                <TableCell className={`text-right text-sm ${r.marginPct >= 0 ? "text-success" : "text-destructive"}`}>
                  {r.marginPct.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t bg-muted/40 font-semibold">
              <TableCell className="uppercase tracking-wider text-[11px] text-muted-foreground">
                {t("reports.subtotal")} ·{" "}
                <span className="font-mono normal-case">{rows.length}</span>{" "}
                {t("reports.rows")}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-[10px] text-muted-foreground">Σ </span>
                {totals.revenue}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-[10px] text-muted-foreground">Σ </span>
                {totals.cost}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono",
                  totals.marginNumeric >= 0 ? "text-success" : "text-destructive",
                )}
              >
                <span className="text-[10px] opacity-70">Σ </span>
                {totals.margin}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right",
                  totals.marginPct >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {totals.marginPct.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
