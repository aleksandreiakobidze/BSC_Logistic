import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, Wallet, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { SettlementRowActions } from "../settlement-row-actions";
import { PaymentKind } from "@/lib/enums";

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const settlement = await prisma.settlement.findFirst({
    where: { id, orgId },
    include: {
      driver: { select: { id: true, firstName: true, lastName: true } },
      payments: {
        where: { kind: PaymentKind.SETTLEMENT_PAYOUT },
        orderBy: { paidAt: "desc" },
        include: { createdBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!settlement) notFound();

  const driverName = `${settlement.driver.firstName} ${settlement.driver.lastName}`;
  const periodLabel = `${formatDate(settlement.periodFrom, locale)} – ${formatDate(settlement.periodTo, locale)}`;
  const paid = Boolean(settlement.paidAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("settlements.title")} · ${driverName}`}
        description={
          <div className="flex items-center gap-2">
            <Link
              href="/drivers/settlements"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("settlements.title")}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant={paid ? "success" : "warning"}>
              {t(`settlements.status.${paid ? "PAID" : "UNPAID"}`)}
            </Badge>
          </div>
        }
        actions={
          <SettlementRowActions
            settlementId={settlement.id}
            net={Number(settlement.net)}
            currency={settlement.currency}
            driverName={driverName}
            periodLabel={periodLabel}
            paid={paid}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {t("settlements.summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("settlements.period")} value={periodLabel} />
            <Row
              label={t("settlements.totalKm")}
              value={settlement.totalKm.toFixed(0)}
            />
            <Separator />
            <Row
              label={t("settlements.gross")}
              value={formatCurrency(Number(settlement.gross), settlement.currency, locale)}
            />
            <Row
              label={t("settlements.deductions")}
              value={
                <span className="text-rose-600 dark:text-rose-400">
                  −{formatCurrency(Number(settlement.deductions), settlement.currency, locale)}
                </span>
              }
            />
            <Separator />
            <Row
              label={t("settlements.net")}
              value={
                <span className="font-mono text-base font-semibold">
                  {formatCurrency(Number(settlement.net), settlement.currency, locale)}
                </span>
              }
              strong
            />
            {settlement.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("payments.note")}
                  </div>
                  <p className="text-foreground/80">{settlement.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("drivers.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/drivers/${settlement.driver.id}`}
              className="font-medium hover:underline"
            >
              {driverName}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {t("settlements.payouts")}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({settlement.payments.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {settlement.payments.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <Receipt className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("payments.empty")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("payments.paidAt")}</TableHead>
                  <TableHead>{t("payments.method")}</TableHead>
                  <TableHead>{t("payments.reference")}</TableHead>
                  <TableHead>{t("payments.recordedBy")}</TableHead>
                  <TableHead className="text-right">{t("payments.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlement.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(p.paidAt, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`payments.methods.${p.method}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.reference || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.createdBy?.name || p.createdBy?.email || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                      −{formatCurrency(Number(p.amount), p.currency, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "text-sm"}>{value}</span>
    </div>
  );
}

export const dynamic = "force-dynamic";
