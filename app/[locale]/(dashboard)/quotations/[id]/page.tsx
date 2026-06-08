import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileSignature } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  type QuotationLineRow,
} from "@/components/app/quotation-lines-editor";
import { QuotationStatus, Role } from "@/lib/enums";
import { buildLineDiff } from "@/lib/quotations";
import { QuotationActionPanel } from "./action-panel";
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
import { QuotationTabs } from "./quotation-tabs";
import { CostSummaryBar } from "./inquiry/cost-summary-bar";
import { TopActionBar } from "./inquiry/top-action-bar";
import { InquiryTab } from "./inquiry/inquiry-tab";
import { OfferTab } from "./offer-tab";
import type { SupplierOfferRow } from "./inquiry/supplier-offers-table";
import type { ActivityRow } from "./inquiry/inquiry-activity";
import type { AttachmentRow } from "./inquiry/rfq-attachments-card";
import type { ClientOfferLine } from "./inquiry/client-offer-preview";
import type { RfqHeader } from "./inquiry/rfq-details-card";

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
      customer: {
        select: {
          id: true,
          name: true,
          status: true,
          users: { where: { role: Role.CUSTOMER }, select: { id: true } },
        },
      },
      contact: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      salesManager: { select: { id: true, name: true } },
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
      supplierOffers: {
        include: {
          supplier: {
            select: { id: true, name: true, code: true, email: true },
          },
          manager: { select: { id: true, name: true } },
        },
        orderBy: [{ team: "asc" }, { totalCost: "asc" }],
      },
      activities: {
        orderBy: { at: "desc" },
        take: 100,
      },
    },
  });
  if (!q) notFound();

  const [users, documents, activityAuthors] = await Promise.all([
    prisma.user.findMany({
      where: { orgId, isActive: true, role: { not: Role.CUSTOMER } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.document.findMany({
      where: { orgId, ownerType: "Quotation", ownerId: q.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        id: {
          in: Array.from(
            new Set(q.activities.map((a) => a.userId).filter(Boolean) as string[]),
          ),
        },
      },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const authorById = new Map(activityAuthors.map((u) => [u.id, u]));

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

  const headerEditable =
    q.status === QuotationStatus.PRICING ||
    q.status === QuotationStatus.DRAFT ||
    q.status === QuotationStatus.COUNTERED;

  const hasPortalUser = q.customer.users.length > 0;

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

  // ─── Inquiry-tab projections ──────────────────────────────────────────────
  const offerRows: SupplierOfferRow[] = q.supplierOffers.map((o) => ({
    id: o.id,
    team: o.team,
    status: o.status,
    isSelected: o.isSelected,
    totalCost: Number(o.totalCost),
    currency: o.currency,
    transitTimeDays: o.transitTimeDays,
    manager: o.manager
      ? { id: o.manager.id, name: o.manager.name }
      : null,
    supplier: {
      id: o.supplier.id,
      name: o.supplier.name,
      code: o.supplier.code,
      email: o.supplier.email,
    },
    incoterms: o.incoterms,
    notes: o.notes,
  }));

  const selectedOffers = offerRows.filter((o) => o.isSelected);
  // V1 doesn't FX-convert; we sum naively assuming all selected offers are in
  // the quotation's currency. The cost-summary bar carries the quote currency
  // label so mixed-currency setups remain visually obvious.
  const bestCost = selectedOffers.reduce((acc, o) => acc + o.totalCost, 0);

  const clientLines: ClientOfferLine[] = lines.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.total,
  }));

  const documentsOut: AttachmentRow[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    fileUrl: d.fileUrl,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt.toISOString(),
  }));

  const activitiesOut: ActivityRow[] = q.activities.map((a) => {
    const author = a.userId ? authorById.get(a.userId) : undefined;
    return {
      id: a.id,
      kind: a.kind,
      note: a.note,
      at: a.at.toISOString(),
      authorName: author?.name ?? author?.email ?? null,
    };
  });

  const rfqHeader: RfqHeader = {
    salesManagerId: q.salesManagerId,
    requestedTeams: q.requestedTeams,
    priority: q.priority,
    mode: q.mode,
    incoterms: q.incoterms,
    originPort: q.originPort,
    originPortLat: q.originPortLat,
    originPortLng: q.originPortLng,
    originAddress: q.originAddress,
    originAddressLat: q.originAddressLat,
    originAddressLng: q.originAddressLng,
    destinationPort: q.destinationPort,
    destinationPortLat: q.destinationPortLat,
    destinationPortLng: q.destinationPortLng,
    destinationAddress: q.destinationAddress,
    destinationAddressLat: q.destinationAddressLat,
    destinationAddressLng: q.destinationAddressLng,
    cargoDescription: q.cargoDescription,
    shipmentDetails: q.shipmentDetails,
    cargoValue: q.cargoValue == null ? null : Number(q.cargoValue),
    cargoValueCurrency: q.cargoValueCurrency,
    cargoReadyDate: q.cargoReadyDate ? q.cargoReadyDate.toISOString() : null,
    specialRequirements: q.specialRequirements,
  };

  const initialTab: "inquiry" | "offer" =
    q.status === QuotationStatus.PRICING ? "inquiry" : "offer";

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

        <CostSummaryBar
          bestCost={bestCost}
          sellPrice={liveTotal}
          currency={q.currency}
          locale={locale}
        />

        <TopActionBar
          quotationId={q.id}
          status={q.status}
          hasSelectedOffers={selectedOffers.length > 0}
          hasLines={lines.length > 0}
          hasPortalUser={hasPortalUser}
        />

        <QuotationTabs
          initialTab={initialTab}
          inquirySlot={
            <InquiryTab
              quotationId={q.id}
              status={q.status}
              number={q.number}
              customerName={q.customer.name}
              contactName={q.contact?.name ?? null}
              ownerName={q.salesManager?.name ?? q.owner?.name ?? null}
              createdAt={q.createdAt.toISOString()}
              currency={q.currency}
              total={liveTotal}
              header={rfqHeader}
              offers={offerRows}
              lines={clientLines}
              documents={documentsOut}
              activities={activitiesOut}
              users={users}
              locale={locale}
              canEditHeader={headerEditable}
            />
          }
          offerSlot={
            <OfferTab
              quotationId={q.id}
              status={q.status}
              currency={q.currency}
              locale={locale}
              editable={editable}
              showNegotiation={q.status === QuotationStatus.COUNTERED}
              diff={diff}
              liveTotal={liveTotal}
              customerTotal={customerTotal}
              lines={lines}
              lineMessages={Object.fromEntries(messagesByLine)}
              totals={{
                subtotal: Number(q.subtotal),
                discount: Number(q.discount),
                taxAmount: Number(q.taxAmount),
                taxRate: Number(q.taxRate),
                total: Number(q.total),
              }}
              actionsSlot={
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
                    validUntil: q.validUntil
                      ? q.validUntil.toISOString()
                      : null,
                    createdAt: q.createdAt.toISOString(),
                    sentAt: q.sentAt ? q.sentAt.toISOString() : null,
                    acceptedAt: q.acceptedAt
                      ? q.acceptedAt.toISOString()
                      : null,
                    convertedAt: q.convertedAt
                      ? q.convertedAt.toISOString()
                      : null,
                    convertedOrders: q.convertedOrders,
                  }}
                />
              }
              conversationSlot={
                <QuotationChatPanel
                  quotationId={q.id}
                  messages={chatMessages}
                  viewerRole="ADMIN"
                  locale={locale}
                />
              }
            />
          }
        />
      </div>
    </QuotationRealtimeProvider>
  );
}
