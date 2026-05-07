"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface QuotationTabsProps {
  initialTab: "inquiry" | "offer";
  inquirySlot: React.ReactNode;
  offerSlot: React.ReactNode;
}

/**
 * Top-level tab switcher between the internal RFQ workspace ("Inquiry") and
 * the customer-facing offer editor. Lives client-side so users can flip back
 * and forth without a route change. The underlying URL stays on the same
 * route since both tabs operate on the same quotation record.
 */
export function QuotationTabs({
  initialTab,
  inquirySlot,
  offerSlot,
}: QuotationTabsProps) {
  const t = useTranslations();
  const [tab, setTab] = React.useState<"inquiry" | "offer">(initialTab);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "inquiry" | "offer")}
      className="w-full"
    >
      <TabsList className="h-auto rounded-xl">
        <TabsTrigger value="inquiry" className="px-4 py-2">
          {t("quotations.tabs.inquiry")}
        </TabsTrigger>
        <TabsTrigger value="offer" className="px-4 py-2">
          {t("quotations.tabs.offer")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inquiry" className="mt-4">
        {inquirySlot}
      </TabsContent>
      <TabsContent value="offer" className="mt-4">
        {offerSlot}
      </TabsContent>
    </Tabs>
  );
}
