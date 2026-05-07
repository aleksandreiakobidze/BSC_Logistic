"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createQuotationFromLead } from "@/app/[locale]/(dashboard)/quotations/actions";

type Quotation = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  validUntil: Date | string | null;
  createdAt: Date | string;
};

export function LeadQuotationsCard({
  leadId,
  quotations,
  locale,
  canCreate,
}: {
  leadId: string;
  quotations: Quotation[];
  locale: string;
  canCreate: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onCreate() {
    setBusy(true);
    try {
      const res = await createQuotationFromLead({ leadId });
      if (!res.ok) {
        const code =
          "code" in res.error ? res.error.code : "LEAD_NOT_QUALIFIED";
        toast.error(t(`leads.transition.errors.${code}`));
        return;
      }
      toast.success(`${res.number}`);
      router.push(`/quotations/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel =
    quotations.length === 0
      ? t("leads.transition.actions.createQuotation")
      : t("leads.transition.actions.createAnotherQuotation");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">
          {t("nav.quotations")}
        </CardTitle>
        {canCreate && (
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            disabled={busy}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            {ctaLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FilePlus2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {canCreate
                ? t("leads.transition.actions.createQuotation")
                : t("common.empty")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.total")}</TableHead>
                <TableHead className="text-xs text-muted-foreground">
                  {t("common.created")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="font-mono text-sm hover:underline"
                    >
                      {q.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="quotation" status={q.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(Number(q.total), q.currency, locale)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(q.createdAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
