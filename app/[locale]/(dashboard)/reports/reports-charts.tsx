"use client";

import React, { useState } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ResponsiveContainer,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Shared constants ────────────────────────────────────────────────────────

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

function SharedAxes({ nameKey = "name" }: { nameKey?: string }) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
      <XAxis dataKey={nameKey} tick={axisStyle} tickLine={false} axisLine={false} />
      <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", radius: 6 }} />
    </>
  );
}

// ─── Type switcher pill ───────────────────────────────────────────────────────

type TypeOption = { id: string; label: string };

function TypeSwitcher({
  options,
  active,
  onChange,
}: {
  options: TypeOption[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1 shrink-0">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150",
            active === opt.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  description,
  options,
  active,
  onTypeChange,
  children,
}: {
  title: string;
  description?: string;
  options: TypeOption[];
  active: string;
  onTypeChange: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          )}
        </div>
        <TypeSwitcher options={options} active={active} onChange={onTypeChange} />
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

// ─── 1. Revenue widget ────────────────────────────────────────────────────────

const REVENUE_OPTS: TypeOption[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

export function RevenueWidget({
  data,
  title,
  description,
}: {
  data: { month: string; total: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("bar");

  return (
    <ChartCard title={title} description={description} options={REVENUE_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="month" />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <SharedAxes nameKey="month" />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                fill="url(#revGrad)"
                strokeWidth={2.5}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="month" />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ─── 2. Shipments by Status widget ───────────────────────────────────────────

const STATUS_OPTS: TypeOption[] = [
  { id: "donut", label: "Donut" },
  { id: "bar", label: "Bar" },
  { id: "hbar", label: "H-Bar" },
];

export function ShipmentsWidget({
  data,
  title,
  description,
}: {
  data: { status: string; count: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("donut");

  return (
    <ChartCard title={title} description={description} options={STATUS_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="status" />
              {data.map((_, i) => null)}
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : type === "hbar" ? (
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis dataKey="status" type="category" tick={axisStyle} tickLine={false} axisLine={false} width={64} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ─── 3. Leads by Status widget ────────────────────────────────────────────────

const LEADS_OPTS: TypeOption[] = [
  { id: "bar", label: "Bar" },
  { id: "donut", label: "Donut" },
  { id: "hbar", label: "H-Bar" },
];

export function LeadsWidget({
  data,
  title,
  description,
}: {
  data: { status: string; count: number; value: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("bar");

  return (
    <ChartCard title={title} description={description} options={LEADS_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "donut" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          ) : type === "hbar" ? (
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis dataKey="status" type="category" tick={axisStyle} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Est. Value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="status" />
              <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ─── 4. Expenses by Category widget ──────────────────────────────────────────

const EXPENSE_OPTS: TypeOption[] = [
  { id: "bar", label: "Bar" },
  { id: "donut", label: "Donut" },
  { id: "hbar", label: "H-Bar" },
];

export function ExpensesWidget({
  data,
  title,
  description,
}: {
  data: { category: string; amount: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("bar");

  return (
    <ChartCard title={title} description={description} options={EXPENSE_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "donut" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          ) : type === "hbar" ? (
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis dataKey="category" type="category" tick={axisStyle} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="category" />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ─── 5. Cash Flow widget ──────────────────────────────────────────────────────

const CASHFLOW_OPTS: TypeOption[] = [
  { id: "bar", label: "Bar" },
  { id: "area", label: "Area" },
];

export function CashFlowWidget({
  data,
  title,
  description,
}: {
  data: { month: string; collected: number; paidOut: number; net: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("bar");

  return (
    <ChartCard title={title} description={description} options={CASHFLOW_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="cfIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cfOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <SharedAxes nameKey="month" />
              <Legend iconType="circle" iconSize={8} />
              <Area
                type="monotone"
                name="Collected"
                dataKey="collected"
                stroke="hsl(142 71% 45%)"
                fill="url(#cfIn)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                name="Paid out"
                dataKey="paidOut"
                stroke="hsl(0 84% 60%)"
                fill="url(#cfOut)"
                strokeWidth={2}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <SharedAxes nameKey="month" />
              <Legend iconType="circle" iconSize={8} />
              <Bar
                name="Collected"
                dataKey="collected"
                fill="hsl(142 71% 45%)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                name="Paid out"
                dataKey="paidOut"
                fill="hsl(0 84% 60%)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ─── 6. Method Mix donut ─────────────────────────────────────────────────────

const METHOD_OPTS: TypeOption[] = [{ id: "donut", label: "Donut" }];

export function MethodMixWidget({
  data,
  title,
  description,
}: {
  data: { method: string; amount: number }[];
  title: string;
  description?: string;
}) {
  const [type, setType] = useState("donut");
  return (
    <ChartCard title={title} description={description} options={METHOD_OPTS} active={type} onTypeChange={setType}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="method"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={108}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
