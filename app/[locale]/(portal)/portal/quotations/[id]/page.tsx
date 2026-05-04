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
  QuotationVersionsView,
  type QuotationVersion,
} from "@/components/app/quotation-versions-view";
import { buildVersionsFromRevisions } from "@/lib/quotations-versions";
import {
  QuotationChatPanel,
  type ChatMessage,
} from "@/components/app/quotation-chat-panel";
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

  // Reset the customer-side unread badge now that they've opened the page.
  // Fire-and-forget; we don't want a slow update to block render.
  await markQuotationMessagesRead(q.id);

  const editable = q.status === QuotationStatus.SENT;
  const tx = (key: string, fb: string) => (t.has(key) ? t(key) : fb);

  // Find when the customer last submitted (most recent CUSTOMER revision).
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
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {tx("quotations.portal.title", "Review your quotation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {versions.length > 0 && (
            <QuotationVersionsView versions={versions} locale={locale} />
          )}
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>
                {tx("quotations.portal.summary", "Summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label={tx("quotations.subtotal", "Subtotal")}
                value={formatCurrency(Number(q.subtotal), q.currency, locale)}
              />
              <Row
                label={tx("quotations.discount", "Discount")}
                value={formatCurrency(Number(q.discount), q.currency, locale)}
              />
              <Row
                label={`${tx("quotations.taxAmount", "Tax")} (${Number(q.taxRate)}%)`}
                value={formatCurrency(Number(q.taxAmount), q.currency, locale)}
              />
              <div className="my-2 border-t" />
              <Row
                label={tx("quotations.total", "Total")}
                value={formatCurrency(Number(q.total), q.currency, locale)}
                strong
              />
              {q.validUntil && (
                <Row
                  label={tx("quotations.validUntil", "Valid until")}
                  value={formatDate(q.validUntil, locale)}
                />
              )}
            </CardContent>
          </Card>

          <QuotationChatPanel
            quotationId={q.id}
            messages={chatMessages}
            viewerRole="CUSTOMER"
            locale={locale}
          />
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
