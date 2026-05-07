"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QuotationLinesEditor,
  type QuotationLineRow,
} from "@/components/app/quotation-lines-editor";
import { formatCurrency } from "@/lib/utils";
import { NegotiationPanel } from "./negotiation-panel";
import type { LineDiff } from "@/lib/quotations";
import type { ChatMessage } from "@/components/app/quotation-chat-panel";

interface OfferTabProps {
  quotationId: string;
  status: string;
  currency: string;
  locale: string;
  editable: boolean;
  showNegotiation: boolean;
  diff: LineDiff[];
  liveTotal: number;
  customerTotal: number;
  lines: QuotationLineRow[];
  lineMessages: Record<string, ChatMessage[]>;
  totals: {
    subtotal: number;
    discount: number;
    taxAmount: number;
    taxRate: number;
    total: number;
  };
}

/**
 * Wrapper for the customer-facing "Offer" workspace. Identical to the
 * pre-RFQ-tab layout — `QuotationLinesEditor` + an optional `NegotiationPanel`
 * + a totals footer — so existing quotations behave exactly as before.
 */
export function OfferTab({
  quotationId,
  currency,
  locale,
  editable,
  showNegotiation,
  diff,
  liveTotal,
  customerTotal,
  lines,
  lineMessages,
  totals,
}: OfferTabProps) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      {showNegotiation && (
        <NegotiationPanel
          quotationId={quotationId}
          diff={diff}
          currency={currency}
          liveTotal={liveTotal}
          customerTotal={customerTotal}
          lineMessages={lineMessages}
        />
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("quotations.lines.title")}</CardTitle>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {currency}
          </span>
        </CardHeader>
        <CardContent>
          <QuotationLinesEditor
            quotationId={quotationId}
            lines={lines}
            currency={currency}
            locale={locale}
            readOnly={!editable}
          />
          <div className="mt-4 ml-auto w-full max-w-sm space-y-1 border-t pt-3 text-sm font-mono">
            <Row
              label={t("quotations.subtotal")}
              value={formatCurrency(totals.subtotal, currency, locale)}
            />
            <Row
              label={t("quotations.discount")}
              value={formatCurrency(totals.discount, currency, locale)}
            />
            <Row
              label={`${t("quotations.taxAmount")} (${totals.taxRate}%)`}
              value={formatCurrency(totals.taxAmount, currency, locale)}
            />
            <div className="my-1 border-t" />
            <Row
              label={t("quotations.total")}
              value={formatCurrency(totals.total, currency, locale)}
              strong
            />
          </div>
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
