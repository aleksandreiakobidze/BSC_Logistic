"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  const selected = React.useMemo(
    () => props.offers.filter((o) => o.isSelected),
    [props.offers],
  );

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

      <div className="min-w-0 space-y-4">
        <Tabs defaultValue="offers" className="w-full">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="offers">
              {t("quotations.inquiry.supplierOffers")}
            </TabsTrigger>
            <TabsTrigger value="cost">
              {t("quotations.inquiry.costBreakdown")}
            </TabsTrigger>
            <TabsTrigger value="builder">
              {t("quotations.inquiry.quoteBuilder")}
            </TabsTrigger>
            <TabsTrigger value="client">
              {t("quotations.inquiry.clientOffer")}
            </TabsTrigger>
            <TabsTrigger value="files">
              {t("quotations.inquiry.rfqAttachments")}
            </TabsTrigger>
            <TabsTrigger value="activity">
              {t("quotations.inquiry.activity")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-3">
            <SupplierOffersTable
              quotationId={props.quotationId}
              status={props.status}
              offers={props.offers}
              users={props.users}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="cost" className="mt-3">
            <CostBreakdown
              offers={props.offers}
              currency={props.currency}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="builder" className="mt-3">
            <QuoteBuilderCard
              quotationId={props.quotationId}
              status={props.status}
              selectedOffers={selected}
              currency={props.currency}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="client" className="mt-3">
            <ClientOfferPreview
              lines={props.lines}
              currency={props.currency}
              total={props.total}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="files" className="mt-3">
            <RfqAttachmentsCard
              documents={props.documents}
              locale={props.locale}
            />
          </TabsContent>
          <TabsContent value="activity" className="mt-3">
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
