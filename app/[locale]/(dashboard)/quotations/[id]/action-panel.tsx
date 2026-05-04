"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Send,
  Check,
  X,
  Ban,
  ArrowRightCircle,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/utils";
import {
  sendQuotationEmail,
  acceptQuotation,
  rejectQuotation,
  cancelQuotation,
  convertQuotationToOrder,
  sendAdminCounter,
} from "../actions";
import { QuotationStatus } from "@/lib/enums";

const TERMINAL = new Set<string>([
  QuotationStatus.CONVERTED,
  QuotationStatus.CANCELLED,
  QuotationStatus.REJECTED,
  QuotationStatus.EXPIRED,
]);

type Ref = { id: string; name: string | null } | null;

type ConvertedOrder = { id: string; number: string; status: string };

export type QuotationMeta = {
  customer: { id: string; name: string };
  contact?: Ref;
  lead?: Ref;
  owner?: { name: string | null } | null;
  validUntil?: string | null;
  createdAt: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  convertedAt?: string | null;
  convertedOrders?: ConvertedOrder[];
};

/**
 * Sidebar action card for the admin quotation page. Holds the lifecycle
 * buttons (Send / Accept / Reject / Convert / Cancel / Download PDF) plus a
 * compact meta strip and converted-orders list, so the right column can be
 * a single card instead of three.
 */
export function QuotationActionPanel({
  quotationId,
  status,
  convertedOrderId,
  meta,
}: {
  quotationId: string;
  status: string;
  convertedOrderId?: string | null;
  meta?: QuotationMeta;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

  const tx = (key: string, fb: string) => (t.has(key) ? t(key) : fb);

  async function run(
    name: string,
    fn: () => Promise<{ ok: boolean; orderId?: string }>,
    okMessage: string,
  ) {
    setBusyAction(name);
    try {
      const res = await fn();
      if (!res.ok) throw new Error("Failed");
      toast.success(okMessage);
      if (res.orderId) router.push(`/orders/${res.orderId}`);
      else router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("quotations.actions.title") ?? "Actions"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {status === QuotationStatus.DRAFT && (
          <ActionButton
            icon={Send}
            label={t("quotations.actions.send")}
            busy={busyAction === "send"}
            onClick={() =>
              run(
                "send",
                () => sendQuotationEmail({ quotationId, locale }),
                t("quotations.sentSuccess"),
              )
            }
          />
        )}
        {status === QuotationStatus.COUNTERED && (
          <ActionButton
            icon={Send}
            label={
              t.has("quotations.portal.sendCounter")
                ? t("quotations.portal.sendCounter")
                : "Send counter"
            }
            busy={busyAction === "counter"}
            onClick={() =>
              run(
                "counter",
                () => sendAdminCounter({ quotationId, locale }),
                t.has("quotations.portal.counterSentToast")
                  ? t("quotations.portal.counterSentToast")
                  : "Counter sent",
              )
            }
          />
        )}
        {(status === QuotationStatus.DRAFT ||
          status === QuotationStatus.SENT) && (
          <>
            <ActionButton
              icon={Check}
              label={t("quotations.actions.accept")}
              variant="default"
              busy={busyAction === "accept"}
              onClick={() =>
                run(
                  "accept",
                  () => acceptQuotation(quotationId),
                  t("quotations.acceptedSuccess"),
                )
              }
            />
            <ActionButton
              icon={X}
              label={t("quotations.actions.reject")}
              variant="outline"
              busy={busyAction === "reject"}
              onClick={() =>
                run(
                  "reject",
                  () => rejectQuotation(quotationId),
                  t("quotations.rejectedSuccess"),
                )
              }
            />
          </>
        )}
        {status === QuotationStatus.ACCEPTED && (
          <ActionButton
            icon={ArrowRightCircle}
            label={t("quotations.actions.convert")}
            variant="default"
            busy={busyAction === "convert"}
            onClick={() =>
              run(
                "convert",
                () => convertQuotationToOrder(quotationId),
                t("quotations.convertedSuccess"),
              )
            }
          />
        )}
        {!TERMINAL.has(status) && (
          <ActionButton
            icon={Ban}
            label={t("quotations.actions.cancel")}
            variant="outline"
            busy={busyAction === "cancel"}
            onClick={() =>
              run(
                "cancel",
                () => cancelQuotation(quotationId),
                t("quotations.cancelledSuccess"),
              )
            }
          />
        )}
        <a
          href={`/api/quotations/${quotationId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button type="button" variant="outline" className="w-full justify-start gap-2">
            <Download className="h-4 w-4" />
            {t("quotations.actions.download")}
          </Button>
        </a>
        {convertedOrderId && (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => router.push(`/orders/${convertedOrderId}`)}
          >
            <ArrowRightCircle className="h-4 w-4" />
            {t("quotations.viewOrder")}
          </Button>
        )}

        {meta && (
          <MetaSection
            meta={meta}
            locale={locale}
            tx={tx}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MetaSection({
  meta,
  locale,
  tx,
}: {
  meta: QuotationMeta;
  locale: string;
  tx: (key: string, fb: string) => string;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];

  rows.push({
    label: tx("orders.customer", "Customer"),
    value: (
      <Link
        href={`/customers/${meta.customer.id}`}
        className="hover:underline"
      >
        {meta.customer.name}
      </Link>
    ),
  });

  if (meta.contact?.id && meta.contact.name) {
    rows.push({
      label: tx("contacts.title", "Contact"),
      value: (
        <Link href={`/contacts`} className="hover:underline">
          {meta.contact.name}
        </Link>
      ),
    });
  }

  if (meta.lead?.id && meta.lead.name) {
    rows.push({
      label: tx("leads.title", "Lead"),
      value: (
        <Link href={`/leads/${meta.lead.id}`} className="hover:underline">
          {meta.lead.name}
        </Link>
      ),
    });
  }

  if (meta.owner?.name) {
    rows.push({
      label: tx("common.owner", "Owner"),
      value: meta.owner.name,
    });
  }

  if (meta.validUntil) {
    rows.push({
      label: tx("quotations.validUntil", "Valid until"),
      value: formatDate(meta.validUntil, locale),
    });
  }

  rows.push({
    label: tx("common.created", "Created"),
    value: formatDate(meta.createdAt, locale),
  });

  if (meta.sentAt) {
    rows.push({
      label: tx("quotations.sentAt", "Sent"),
      value: formatDate(meta.sentAt, locale),
    });
  }
  if (meta.acceptedAt) {
    rows.push({
      label: tx("quotations.acceptedAt", "Accepted"),
      value: formatDate(meta.acceptedAt, locale),
    });
  }
  if (meta.convertedAt) {
    rows.push({
      label: tx("quotations.convertedAt", "Converted"),
      value: formatDate(meta.convertedAt, locale),
    });
  }

  const hasOrders = (meta.convertedOrders?.length ?? 0) > 0;

  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right truncate">{r.value}</dd>
          </React.Fragment>
        ))}
      </dl>

      {hasOrders && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {tx("quotations.convertedOrders", "Converted to orders")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {meta.convertedOrders!.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted/30"
              >
                <span className="font-medium">{o.number}</span>
                <StatusBadge kind="order" status={o.status} label={o.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  busy,
  onClick,
  variant = "outline",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  busy?: boolean;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      className="w-full justify-start gap-2"
      onClick={onClick}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}
