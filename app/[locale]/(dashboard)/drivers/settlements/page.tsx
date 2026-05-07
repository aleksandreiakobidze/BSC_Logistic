import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Wallet } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import { ExportButton } from "@/components/app/export-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GenerateSettlementButton } from "./generate-settlement-button";
import { SettlementRowActions } from "./settlement-row-actions";

const STATUS_OPTIONS = [
  { label: "PAID", value: "paid" },
  { label: "UNPAID", value: "unpaid" },
];

export default async function SettlementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const driverFilter = sp?.driverId ?? "";
  const status = sp?.status ?? "";
  const dateFrom = sp?.dateFrom ?? "";
  const dateTo = sp?.dateTo ?? "";

  const where: Prisma.SettlementWhereInput = { orgId };
  if (driverFilter) where.driverId = driverFilter;
  if (status === "paid") where.paidAt = { not: null };
  if (status === "unpaid") where.paidAt = null;
  if (dateFrom || dateTo) {
    where.periodFrom = where.periodFrom ?? {};
    if (dateFrom) (where.periodFrom as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo)
      (where.periodFrom as Prisma.DateTimeFilter).lte = new Date(
        dateTo + "T23:59:59.999Z",
      );
  }

  const [settlements, drivers] = await Promise.all([
    prisma.settlement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { driver: true },
      take: 200,
    }),
    prisma.driver.findMany({
      where: { orgId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settlements.title")}
        description={t("settlements.description")}
        actions={
          <>
            <ExportButton entity="settlements" />
            <GenerateSettlementButton drivers={drivers} />
          </>
        }
      />

      <ListFilters
        searchPlaceholder={t("settlements.searchPlaceholder")}
        filters={[
          {
            key: "driverId",
            label: t("drivers.title"),
            type: "select",
            options: drivers.map((d) => ({
              label: `${d.firstName} ${d.lastName}`,
              value: d.id,
            })),
          },
          {
            key: "status",
            label: t("common.status"),
            type: "select",
            options: STATUS_OPTIONS,
          },
          { key: "dateFrom", label: t("common.from"), type: "date" },
          { key: "dateTo", label: t("common.to"), type: "date" },
        ]}
      />

      {settlements.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("settlements.emptyTitle")}
          description={t("settlements.empty")}
          action={<GenerateSettlementButton drivers={drivers} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("drivers.title")}</TableHead>
                  <TableHead>{t("settlements.period")}</TableHead>
                  <TableHead className="text-right">{t("settlements.totalKm")}</TableHead>
                  <TableHead className="text-right">{t("settlements.gross")}</TableHead>
                  <TableHead className="text-right">{t("settlements.deductions")}</TableHead>
                  <TableHead className="text-right">{t("settlements.net")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    {t("common.created")}
                  </TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => {
                  const driverName = `${s.driver.firstName} ${s.driver.lastName}`;
                  const periodLabel = `${formatDate(s.periodFrom, locale)} – ${formatDate(s.periodTo, locale)}`;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/drivers/settlements/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {driverName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {periodLabel}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {s.totalKm.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Number(s.gross), s.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-rose-600 dark:text-rose-400">
                        −{formatCurrency(Number(s.deductions), s.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(Number(s.net), s.currency, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.paidAt ? "success" : "warning"}>
                          {t(`settlements.status.${s.paidAt ? "PAID" : "UNPAID"}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.createdAt, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <SettlementRowActions
                          settlementId={s.id}
                          net={Number(s.net)}
                          currency={s.currency}
                          driverName={driverName}
                          periodLabel={periodLabel}
                          paid={Boolean(s.paidAt)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
