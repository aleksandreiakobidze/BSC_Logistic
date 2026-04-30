import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PaymentRowActions } from "../payment-row-actions";
import { PaymentKind } from "@/lib/enums";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const payment = await prisma.payment.findFirst({
    where: { id, orgId },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          paid: true,
          currency: true,
        },
      },
      customer: { select: { id: true, name: true } },
      settlement: {
        select: {
          id: true,
          periodFrom: true,
          periodTo: true,
          net: true,
        },
      },
      driver: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!payment) notFound();

  const isPayout = payment.kind === PaymentKind.SETTLEMENT_PAYOUT;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("payments.title")} · ${formatCurrency(Number(payment.amount), payment.currency, locale)}`}
        description={
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("payments.title")}
          </Link>
        }
        actions={
          <PaymentRowActions
            paymentId={payment.id}
            kind={payment.kind as "RECEIVABLE" | "SETTLEMENT_PAYOUT"}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("payments.summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={t("payments.kind")}>
              <Badge variant={isPayout ? "warning" : "success"}>
                {t(`payments.kinds.${payment.kind}`)}
              </Badge>
            </Row>
            <Row
              label={t("payments.amount")}
              value={
                <span
                  className={`font-mono text-base font-semibold ${
                    isPayout
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isPayout ? "-" : "+"}
                  {formatCurrency(Number(payment.amount), payment.currency, locale)}
                </span>
              }
            />
            <Row label={t("payments.method")}>
              <Badge variant="outline">
                {t(`payments.methods.${payment.method}`)}
              </Badge>
            </Row>
            <Row
              label={t("payments.paidAt")}
              value={formatDateTime(payment.paidAt, locale)}
            />
            {payment.reference && (
              <Row label={t("payments.reference")} value={payment.reference} />
            )}
            {payment.note && (
              <Row label={t("payments.note")} value={payment.note} />
            )}
            {payment.createdBy && (
              <Row
                label={t("payments.recordedBy")}
                value={payment.createdBy.name || payment.createdBy.email || "—"}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isPayout ? t("payments.payee") : t("payments.payer")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!isPayout && payment.invoice && (
              <Row
                label={t("invoices.title")}
                value={
                  <Link
                    href={`/invoices/${payment.invoice.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    #{payment.invoice.number}
                  </Link>
                }
              />
            )}
            {!isPayout && payment.customer && (
              <Row
                label={t("orders.customer")}
                value={
                  <Link
                    href={`/customers/${payment.customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {payment.customer.name}
                  </Link>
                }
              />
            )}
            {isPayout && payment.driver && (
              <Row
                label={t("drivers.title")}
                value={
                  <Link
                    href={`/drivers/${payment.driver.id}`}
                    className="font-medium hover:underline"
                  >
                    {payment.driver.firstName} {payment.driver.lastName}
                  </Link>
                }
              />
            )}
            {isPayout && payment.settlement && (
              <Row
                label={t("settlements.title")}
                value={
                  <Link
                    href={`/drivers/settlements/${payment.settlement.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    #{payment.settlement.id.slice(-6)}
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children ?? value}</div>
    </div>
  );
}

export const dynamic = "force-dynamic";
