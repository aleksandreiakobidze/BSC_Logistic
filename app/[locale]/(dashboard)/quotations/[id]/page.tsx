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
import { formatCurrency } from "@/lib/utils";
import { QuotationStatus } from "@/lib/enums";
import { buildLineDiff } from "@/lib/quotations";
import { QuotationActionPanel } from "./action-panel";
import { NegotiationPanel } from "./negotiation-panel";
import {
  type QuotationVersion,
} from "@/components/app/quotation-versions-view";
import { buildVersionsFromRevisions } from "@/lib/quotations-versions";
import {
  QuotationChatPanel,
  type ChatMessage,
} from "@/components/app/quotation-chat-panel";
import { QuotationRealtimeProvider } from "@/components/app/quotation-realtime";
import { QuotationHistoryButton } from "@/components/app/quotation-history-sheet";
import { markQuotationMessagesRead } from "../actions";

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
      revisions: {
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          source: true,
          message: true,
          createdAt: true,
          total: true,
          currency: true,
          linesJson: true,
          author: { select: { name: true, email: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!q) notFound();

  await markQuotationMessagesRead(q.id);

  const diff = buildLineDiff(
    q.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      customerStatus: l.customerStatus,
      customerNote: l.customerNote,
      proposedQuantity: l.proposedQuantity,
      proposedUnitPrice: l.proposedUnitPrice,
      proposedDescription: l.proposedDescription,
    })),
  );

  const allMessages: ChatMessage[] = q.messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    authorRole: (m.authorRole as ChatMessage["authorRole"]) ?? "SYSTEM",
    authorName: m.author?.name ?? m.author?.email ?? null,
    lineId: m.lineId,
  }));
  const chatMessages = allMessages.filter((m) => m.lineId === null);
  const messagesByLine = new Map<string, ChatMessage[]>();
  for (const m of allMessages) {
    if (!m.lineId) continue;
    const arr = messagesByLine.get(m.lineId) ?? [];
    arr.push(m);
    messagesByLine.set(m.lineId, arr);
  }

  const lines: QuotationLineRow[] = q.lines.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    total: Number(l.total),
    itemId: l.itemId,
    customerStatus: l.customerStatus ?? null,
    customerNote: l.customerNote ?? null,
    proposedDescription: l.proposedDescription ?? null,
    proposedQuantity:
      l.proposedQuantity == null ? null : Number(l.proposedQuantity),
    proposedUnitPrice:
      l.proposedUnitPrice == null ? null : Number(l.proposedUnitPrice),
    messages: messagesByLine.get(l.id) ?? [],
  }));

  const versions: QuotationVersion[] = buildVersionsFromRevisions(q.revisions, {
    total: Number(q.total),
    currency: q.currency,
    lines: q.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      total: Number(l.total),
      customerStatus: l.customerStatus ?? null,
      customerNote: l.customerNote ?? null,
      proposedQuantity:
        l.proposedQuantity == null ? null : Number(l.proposedQuantity),
      proposedUnitPrice:
        l.proposedUnitPrice == null ? null : Number(l.proposedUnitPrice),
      proposedDescription: l.proposedDescription ?? null,
    })),
  });

  const editable =
    q.status === QuotationStatus.DRAFT ||
    q.status === QuotationStatus.COUNTERED;

  // For the negotiation panel header: customer's total according to their last
  // counter (effective values), and admin's current live total.
  const liveTotal = Number(q.total);
  const customerTotal = q.lines.reduce((acc, l) => {
    const isMod = l.customerStatus === "MODIFIED";
    const qty = isMod
      ? Number(l.proposedQuantity ?? l.quantity)
      : Number(l.quantity);
    const price = isMod
      ? Number(l.proposedUnitPrice ?? l.unitPrice)
      : Number(l.unitPrice);
    return acc + qty * price;
  }, 0);

  return (
    <QuotationRealtimeProvider quotationId={q.id} viewerRole="ADMIN">
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
          actions={
            <QuotationHistoryButton versions={versions} locale={locale} />
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            {q.status === QuotationStatus.COUNTERED && (
              <NegotiationPanel
                quotationId={q.id}
                diff={diff}
                currency={q.currency}
                liveTotal={liveTotal}
                customerTotal={customerTotal}
                lineMessages={Object.fromEntries(messagesByLine)}
              />
            )}
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
                <TotalsFooter
                  subtotal={Number(q.subtotal)}
                  discount={Number(q.discount)}
                  taxAmount={Number(q.taxAmount)}
                  taxRate={Number(q.taxRate)}
                  total={Number(q.total)}
                  currency={q.currency}
                  locale={locale}
                  labels={{
                    subtotal: t("quotations.subtotal"),
                    discount: t("quotations.discount"),
                    tax: t("quotations.taxAmount"),
                    total: t("quotations.total"),
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
            <QuotationActionPanel
              quotationId={q.id}
              status={q.status}
              convertedOrderId={q.convertedOrders[0]?.id}
              meta={{
                customer: { id: q.customer.id, name: q.customer.name },
                contact: q.contact
                  ? { id: q.contact.id, name: q.contact.name }
                  : null,
                lead: q.lead ? { id: q.lead.id, name: q.lead.name } : null,
                owner: q.owner ? { name: q.owner.name } : null,
                validUntil: q.validUntil ? q.validUntil.toISOString() : null,
                createdAt: q.createdAt.toISOString(),
                sentAt: q.sentAt ? q.sentAt.toISOString() : null,
                acceptedAt: q.acceptedAt ? q.acceptedAt.toISOString() : null,
                convertedAt: q.convertedAt ? q.convertedAt.toISOString() : null,
                convertedOrders: q.convertedOrders,
              }}
            />

            <QuotationChatPanel
              quotationId={q.id}
              messages={chatMessages}
              viewerRole="ADMIN"
              locale={locale}
            />
          </aside>
        </div>
      </div>
    </QuotationRealtimeProvider>
  );
}

function TotalsFooter({
  subtotal,
  discount,
  taxAmount,
  taxRate,
  total,
  currency,
  locale,
  labels,
}: {
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
  locale: string;
  labels: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
  };
}) {
  return (
    <div className="mt-4 ml-auto w-full max-w-sm space-y-1 border-t pt-3 text-sm font-mono">
      <Row label={labels.subtotal} value={formatCurrency(subtotal, currency, locale)} />
      <Row label={labels.discount} value={formatCurrency(discount, currency, locale)} />
      <Row
        label={`${labels.tax} (${taxRate}%)`}
        value={formatCurrency(taxAmount, currency, locale)}
      />
      <div className="my-1 border-t" />
      <Row
        label={labels.total}
        value={formatCurrency(total, currency, locale)}
        strong
      />
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
