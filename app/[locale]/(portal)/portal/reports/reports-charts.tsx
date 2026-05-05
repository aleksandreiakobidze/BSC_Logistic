"use client";

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(258 90% 66%)",
  "hsl(191 91% 45%)",
];

const tooltipStyle: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
};

const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

export function PortalReportsCharts({
  spendData,
  shipmentData,
  statusData,
  paymentData,
  aging,
  locale,
}: {
  spendData: { month: string; amount: number }[];
  shipmentData: { month: string; count: number }[];
  statusData: { status: string; count: number }[];
  paymentData: { month: string; invoiced: number; paid: number }[];
  aging: { current: number; d30: number; d60: number; d90: number; d90plus: number };
  locale: string;
}) {
  const t = useTranslations("portal.reports");
  const fmt = (n: number) => formatCurrency(n, "USD", locale);

  const agingData = [
    { label: t("agingCurrent"), value: Math.round(aging.current) },
    { label: "1-30 " + t("agingDays"), value: Math.round(aging.d30) },
    { label: "31-60 " + t("agingDays"), value: Math.round(aging.d60) },
    { label: "61-90 " + t("agingDays"), value: Math.round(aging.d90) },
    { label: "90+ " + t("agingDays"), value: Math.round(aging.d90plus) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("spendOverTime")}</CardTitle>
            <CardDescription>{t("spendOverTimeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={spendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={60} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("shipmentsOverTime")}</CardTitle>
            <CardDescription>{t("shipmentsOverTimeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={shipmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(217 91% 60%)"
                  fill="hsl(217 91% 60% / 0.15)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("deliveryBreakdown")}</CardTitle>
            <CardDescription>{t("deliveryBreakdownDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10">{t("noData")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ status, count }) =>
                      `${status.replace(/_/g, " ")} (${count})`
                    }
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("invoicedVsPaid")}</CardTitle>
            <CardDescription>{t("invoicedVsPaidDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={paymentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={60} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="invoiced"
                  stroke="hsl(0 84% 60%)"
                  fill="hsl(0 84% 60% / 0.1)"
                  strokeWidth={2}
                  name={t("invoiced")}
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="hsl(142 71% 45%)"
                  fill="hsl(142 71% 45% / 0.1)"
                  strokeWidth={2}
                  name={t("paid")}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("arAging")}</CardTitle>
          <CardDescription>{t("arAgingDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-5">
            {agingData.map((bucket) => (
              <div
                key={bucket.label}
                className="rounded-xl border p-4 text-center"
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {bucket.label}
                </div>
                <div className="mt-1 text-lg font-bold">
                  {fmt(bucket.value)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
