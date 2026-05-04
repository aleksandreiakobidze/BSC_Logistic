import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileSignature } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuotationStatus } from "@/lib/enums";
import { CustomerQuoteEditor } from "./customer-quote-editor";
import { WrongAccountNotice } from "../wrong-account-notice";
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
import { markQuotationMessagesRead } from "@/app/[locale]/(dashboard)/quotations/actions";

export default async function PortalQuotationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  const portalPath = `/${locale}/portal/quotations/${id}`;

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(portalPath)}`);
  }

  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    const fullUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") + portalPath;
    return (
      <WrongAccountNotice
        url={fullUrl || portalPath}
        signedInAs={session.user.email ?? session.user.id}
        role={session.user.role}
        adminHref={`/${locale}/quotations/${id}`}
        texts={{
          title: t.has("quotations.portal.wrongAccountTitle")
            ? t("quotations.portal.wrongAccountTitle")
            : "This link is for a customer account",
          body: t.has("quotations.portal.wrongAccountBody")
            ? t("quotations.portal.wrongAccountBody")
            : "Open the link below in an incognito window and sign in with the customer's credentials. Your current dashboard session won't be affected.",
          urlLabel: t.has("quotations.portal.wrongAccountUrlLabel")
            ? t("quotations.portal.wrongAccountUrlLabel")
            : "Customer link",
          copy: t.has("quotations.portal.wrongAccountCopy")
            ? t("quotations.portal.wrongAccountCopy")
            : "Copy URL",
          copied: t.has("quotations.portal.wrongAccountCopied")
            ? t("quotations.portal.wrongAccountCopied")
            : "URL copied",
          adminLink: t.has("quotations.portal.wrongAccountAdminLink")
            ? t("quotations.portal.wrongAccountAdminLink")
            : "Open the admin view of this quotation",
        }}
      />
    );
  }

  const q = await prisma.quotation.findFirst({
    where: { id, customerId: session.user.customerId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: { select: { name: true } },
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

  const editable = q.status === QuotationStatus.SENT;
  const tx = (key: string, fb: string) => (t.has(key) ? t(key) : fb);

  const lastCustomerSubmit = [...q.revisions]
    .reverse()
    .find((r) => r.source === "CUSTOMER");

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

  const editorLines = q.lines.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    total: Number(l.total),
    customerStatus: (l.customerStatus as "ACCEPTED" | "MODIFIED" | null) ?? null,
    customerNote: l.customerNote,
    proposedDescription: l.proposedDescription,
    proposedQuantity:
      l.proposedQuantity == null ? null : Number(l.proposedQuantity),
    proposedUnitPrice:
      l.proposedUnitPrice == null ? null : Number(l.proposedUnitPrice),
    messages: messagesByLine.get(l.id) ?? [],
  }));

  const versions: QuotationVersion[] = buildVersionsFromRevisions(
    q.revisions,
    null, // Customers don't see the "Live" working copy; only finalized snapshots.
  );

  return (
    <QuotationRealtimeProvider quotationId={q.id} viewerRole="CUSTOMER">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/portal/quotations`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <FileSignature className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{q.number}</h1>
            <StatusBadge
              kind="quotation"
              status={q.status}
              label={
                t.has(`quotations.status.${q.status}`)
                  ? t(`quotations.status.${q.status}`)
                  : q.status
              }
            />
          </div>
          <QuotationHistoryButton versions={versions} locale={locale} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {tx("quotations.portal.title", "Review your quotation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CustomerQuoteEditor
                  quotationId={q.id}
                  lines={editorLines}
                  currency={q.currency}
                  locale={locale}
                  editable={editable}
                  status={q.status}
                  submittedAt={
                    lastCustomerSubmit
                      ? lastCustomerSubmit.createdAt.toISOString()
                      : null
                  }
                />
                <TotalsFooter
                  subtotal={Number(q.subtotal)}
                  discount={Number(q.discount)}
                  taxAmount={Number(q.taxAmount)}
                  taxRate={Number(q.taxRate)}
                  total={Number(q.total)}
                  validUntil={q.validUntil ? q.validUntil.toISOString() : null}
                  currency={q.currency}
                  locale={locale}
                  labels={{
                    subtotal: tx("quotations.subtotal", "Subtotal"),
                    discount: tx("quotations.discount", "Discount"),
                    tax: tx("quotations.taxAmount", "Tax"),
                    total: tx("quotations.total", "Total"),
                    validUntil: tx("quotations.validUntil", "Valid until"),
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
            <QuotationChatPanel
              quotationId={q.id}
              messages={chatMessages}
              viewerRole="CUSTOMER"
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
  validUntil,
  currency,
  locale,
  labels,
}: {
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  validUntil: string | null;
  currency: string;
  locale: string;
  labels: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    validUntil: string;
  };
}) {
  return (
    <div className="ml-auto w-full max-w-sm space-y-1 border-t pt-3 text-sm font-mono">
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
      {validUntil && (
        <Row label={labels.validUntil} value={formatDate(validUntil, locale)} />
      )}
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
