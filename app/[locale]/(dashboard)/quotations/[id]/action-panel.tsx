"use client";

import * as React from "react";
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

export function QuotationActionPanel({
  quotationId,
  status,
  convertedOrderId,
}: {
  quotationId: string;
  status: string;
  convertedOrderId?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

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
      </CardContent>
    </Card>
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
