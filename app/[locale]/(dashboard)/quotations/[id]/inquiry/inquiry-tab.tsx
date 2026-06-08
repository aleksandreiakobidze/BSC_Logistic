"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Briefcase,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Paperclip,
  TrendingDown,
  Truck,
  Wrench,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { RfqDetailsCard, type RfqHeader } from "./rfq-details-card";
import {
  SupplierOffersTable,
  type SupplierOfferRow,
} from "./supplier-offers-table";
import { CostBreakdown } from "./cost-breakdown";
import { QuoteBuilderCard } from "./quote-builder-card";
import {
  ClientOfferPreview,
  type ClientOfferLine,
} from "./client-offer-preview";
import {
  RfqAttachmentsCard,
  type AttachmentRow,
} from "./rfq-attachments-card";
import { InquiryActivity, type ActivityRow } from "./inquiry-activity";

type UserOption = { id: string; name: string | null };

interface InquiryTabProps {
  quotationId: string;
  status: string;
  number: string;
  customerName: string;
  contactName: string | null;
  ownerName: string | null;
  createdAt: string;
  currency: string;
  total: number;
  header: RfqHeader;
  offers: SupplierOfferRow[];
  lines: ClientOfferLine[];
  documents: AttachmentRow[];
  activities: ActivityRow[];
  users: UserOption[];
  locale: string;
  canEditHeader: boolean;
}

export function InquiryTab(props: InquiryTabProps) {
  const t = useTranslations();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);
  const selected = React.useMemo(
    () => props.offers.filter((o) => o.isSelected),
    [props.offers],
  );

  const lowestCost = React.useMemo(() => {
    if (props.offers.length === 0) return null;
    const min = Math.min(...props.offers.map((o) => o.totalCost));
    const row = props.offers.find((o) => o.totalCost === min);
    return row ? { value: min, currency: row.currency } : null;
  }, [props.offers]);

  const fastestDays = React.useMemo(() => {
    const days = props.offers
      .map((o) => o.transitTimeDays)
      .filter((d): d is number => d != null);
    if (days.length === 0) return null;
    return Math.min(...days);
  }, [props.offers]);

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <RfqDetailsCard
        quotationId={props.quotationId}
        quoteNumber={props.number}
        customerName={props.customerName}
        contactName={props.contactName}
        ownerName={props.ownerName}
        createdAt={props.createdAt}
        header={props.header}
        users={props.users}
        readOnly={!props.canEditHeader}
        locale={props.locale}
      />

      <div className="min-w-0 space-y-5">
        <HeroHeader
          title={tx(
            "quotations.inquiry.workspaceTitle",
            "RFQ workspace",
          )}
          subtitle={
            [props.customerName, props.ownerName].filter(Boolean).join(" • ") ||
            null
          }
          quoteNumber={props.number}
          status={props.status}
          statusLabel={tx(`quotations.status.${props.status}`, props.status)}
        />

        <Tabs defaultValue="offers" className="w-full">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/40 p-1">
            <SubTabTrigger
              value="offers"
              icon={<Truck className="h-4 w-4" />}
              label={t("quotations.inquiry.supplierOffers")}
            />
            <SubTabTrigger
              value="cost"
              icon={<Calculator className="h-4 w-4" />}
              label={t("quotations.inquiry.costBreakdown")}
            />
            <SubTabTrigger
              value="builder"
              icon={<Wrench className="h-4 w-4" />}
              label={t("quotations.inquiry.quoteBuilder")}
            />
            <SubTabTrigger
              value="client"
              icon={<FileText className="h-4 w-4" />}
              label={t("quotations.inquiry.clientOffer")}
            />
            <SubTabTrigger
              value="files"
              icon={<Paperclip className="h-4 w-4" />}
              label={t("quotations.inquiry.rfqAttachments")}
            />
            <SubTabTrigger
              value="activity"
              icon={<Activity className="h-4 w-4" />}
              label={t("quotations.inquiry.activity")}
            />
          </TabsList>

          <TabsContent value="offers" className="mt-4 space-y-4">
            <KpiStrip
              cards={[
                {
                  icon: <ClipboardList className="h-4 w-4" />,
                  label: tx(
                    "quotations.inquiry.kpiTotalOffers",
                    "Total offers",
                  ),
                  value: String(props.offers.length),
                  hint:
                    props.offers.length > 0
                      ? `${
                          new Set(props.offers.map((o) => o.team)).size
                        } ${tx("quotations.inquiry.teamsLabel", "teams")}`
                      : "—",
                },
                {
                  icon: <CheckCircle2 className="h-4 w-4" />,
                  label: tx(
                    "quotations.inquiry.kpiSelected",
                    "Selected",
                  ),
                  value: `${selected.length} / ${props.offers.length}`,
                  accent: selected.length > 0,
                },
                {
                  icon: <TrendingDown className="h-4 w-4" />,
                  label: tx("quotations.inquiry.kpiLowest", "Lowest cost"),
                  value: lowestCost
                    ? formatCurrency(
                        lowestCost.value,
                        lowestCost.currency,
                        props.locale,
                      )
                    : "—",
                },
                {
                  icon: <Clock className="h-4 w-4" />,
                  label: tx(
                    "quotations.inquiry.kpiFastest",
                    "Fastest transit",
                  ),
                  value: fastestDays != null ? `${fastestDays}d` : "—",
                },
              ]}
            />
            <SupplierOffersTable
              quotationId={props.quotationId}
              status={props.status}
              offers={props.offers}
              users={props.users}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="cost" className="mt-4">
            <CostBreakdown
              offers={props.offers}
              currency={props.currency}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="builder" className="mt-4">
            <QuoteBuilderCard
              quotationId={props.quotationId}
              status={props.status}
              selectedOffers={selected}
              currency={props.currency}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="client" className="mt-4">
            <ClientOfferPreview
              lines={props.lines}
              currency={props.currency}
              total={props.total}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <RfqAttachmentsCard
              documents={props.documents}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <InquiryActivity
              quotationId={props.quotationId}
              activities={props.activities}
              locale={props.locale}
              canPost
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HeroHeader({
  title,
  subtitle,
  quoteNumber,
  status,
  statusLabel,
}: {
  title: string;
  subtitle: string | null;
  quoteNumber: string;
  status: string;
  statusLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border bg-background shadow-sm">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold leading-tight">{title}</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {quoteNumber}
              </Badge>
            </div>
            {subtitle && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="self-start sm:self-auto">
          <span className="font-mono text-[10px]">{status}</span>
          <span className="ml-1 hidden sm:inline">{statusLabel}</span>
        </Badge>
      </div>
    </div>
  );
}

function SubTabTrigger({
  value,
  icon,
  label,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </TabsTrigger>
  );
}

function KpiStrip({
  cards,
}: {
  cards: {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint?: string;
    accent?: boolean;
  }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <div
          key={i}
          className={`group relative overflow-hidden rounded-xl border p-4 transition-colors ${
            c.accent
              ? "bg-primary/5 hover:bg-primary/10"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                c.accent
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {c.icon}
            </span>
            {c.hint && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {c.hint}
              </span>
            )}
          </div>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
            {c.label}
          </div>
          <div className="mt-1 truncate text-xl font-semibold tabular-nums">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
