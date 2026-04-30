import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileSignature } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import {
  QuotationLinesEditor,
  type QuotationLineRow,
} from "@/components/app/quotation-lines-editor";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuotationStatus } from "@/lib/enums";
import { QuotationActionPanel } from "./action-panel";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const q = await prisma.quotation.findFirst({
    where: { id, orgId },
    include: {
      customer: { select: { id: true, name: true, status: true } },
      contact: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      convertedOrders: {
        select: { id: true, number: true, status: true },
        take: 5,
      },
    },
  });
  if (!q) notFound();

  const lines: QuotationLineRow[] = q.lines.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    total: Number(l.total),
  }));

  const editable = q.status === QuotationStatus.DRAFT;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/quotations"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <FileSignature className="h-5 w-5 text-muted-foreground" />
            {q.number}
            <StatusBadge
              kind="quotation"
              status={q.status}
              label={t(`quotations.status.${q.status}`)}
            />
          </span>
        }
        description={q.customer.name}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("quotations.lines.title")}</CardTitle>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {q.currency}
              </span>
            </CardHeader>
            <CardContent>
              <QuotationLinesEditor
                quotationId={q.id}
                lines={lines}
                currency={q.currency}
                locale={locale}
                readOnly={!editable}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("quotations.totals")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 font-mono text-sm">
              <Row
                label={t("quotations.subtotal")}
                value={formatCurrency(Number(q.subtotal), q.currency, locale)}
              />
              <Row
                label={t("quotations.discount")}
                value={formatCurrency(Number(q.discount), q.currency, locale)}
              />
              <Row
                label={`${t("quotations.taxAmount")} (${Number(q.taxRate)}%)`}
                value={formatCurrency(Number(q.taxAmount), q.currency, locale)}
              />
              <div className="my-2 border-t" />
              <Row
                label={t("quotations.total")}
                value={formatCurrency(Number(q.total), q.currency, locale)}
                strong
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <QuotationActionPanel
            quotationId={q.id}
            status={q.status}
            convertedOrderId={q.convertedOrders[0]?.id}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("quotations.details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label={t("orders.customer")}
                value={
                  <Link
                    href={`/customers/${q.customer.id}`}
                    className="hover:underline"
                  >
                    {q.customer.name}
                  </Link>
                }
              />
              {q.contact && (
                <Row
                  label={t("contacts.title")}
                  value={
                    <Link
                      href={`/contacts`}
                      className="hover:underline"
                    >
                      {q.contact.name}
                    </Link>
                  }
                />
              )}
              {q.lead && (
                <Row
                  label={t("leads.title")}
                  value={
                    <Link
                      href={`/leads/${q.lead.id}`}
                      className="hover:underline"
                    >
                      {q.lead.name}
                    </Link>
                  }
                />
              )}
              {q.owner && (
                <Row
                  label={t("common.owner") ?? "Owner"}
                  value={q.owner.name ?? "—"}
                />
              )}
              <Row
                label={t("quotations.validUntil")}
                value={q.validUntil ? formatDate(q.validUntil, locale) : "—"}
              />
              <Row
                label={t("common.created")}
                value={formatDate(q.createdAt, locale)}
              />
              {q.sentAt && (
                <Row
                  label={t("quotations.sentAt")}
                  value={formatDate(q.sentAt, locale)}
                />
              )}
              {q.acceptedAt && (
                <Row
                  label={t("quotations.acceptedAt")}
                  value={formatDate(q.acceptedAt, locale)}
                />
              )}
              {q.convertedAt && (
                <Row
                  label={t("quotations.convertedAt")}
                  value={formatDate(q.convertedAt, locale)}
                />
              )}
            </CardContent>
          </Card>

          {q.convertedOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("quotations.convertedOrders")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {q.convertedOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/30"
                  >
                    <span className="font-medium">{o.number}</span>
                    <StatusBadge
                      kind="order"
                      status={o.status}
                      label={o.status}
                    />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
