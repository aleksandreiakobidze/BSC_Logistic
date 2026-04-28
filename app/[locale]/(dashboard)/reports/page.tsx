import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { RevenueChart, UtilizationChart } from "./reports-charts";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [revenueByMonth, topCustomers, shipmentsByStatus] = await Promise.all([
    (async () => {
      const invoices = await prisma.invoice.findMany({
        where: { orgId, status: { in: ["PAID", "SENT"] } },
        select: { issueDate: true, total: true },
      });
      const byMonth = new Map<string, number>();
      for (const inv of invoices) {
        const key = inv.issueDate.toISOString().slice(0, 7);
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(inv.total));
      }
      return [...byMonth.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, total]) => ({ month, total }));
    })(),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { orgId, status: { in: ["PAID", "SENT"] } },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.shipment.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
    }),
  ]);

  const customerIds = topCustomers.map((c) => c.customerId);
  const customerMap = new Map(
    (await prisma.customer.findMany({ where: { id: { in: customerIds } } })).map((c) => [c.id, c]),
  );

  const revenueData = revenueByMonth;

  const utilizationData = shipmentsByStatus.map((s) => ({
    status: s.status,
    count: s._count._all,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/api/reports/shipments.csv" target="_blank">{t("common.exportCsv")}</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("reports.revenue")}</CardTitle></CardHeader>
          <CardContent><RevenueChart data={revenueData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("reports.shipmentsOverTime")}</CardTitle></CardHeader>
          <CardContent><UtilizationChart data={utilizationData} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("reports.topCustomers")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topCustomers.map((c) => {
              const total = Number(c._sum.total ?? 0);
              const customer = customerMap.get(c.customerId);
              return (
                <div key={c.customerId} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="font-medium">{customer?.name ?? "—"}</div>
                  <div className="font-mono text-sm">{formatCurrency(total, "USD", locale)}</div>
                </div>
              );
            })}
            {topCustomers.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">{t("common.empty")}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
