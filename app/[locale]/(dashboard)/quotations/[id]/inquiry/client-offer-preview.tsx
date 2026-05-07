"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

export interface ClientOfferLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ClientOfferPreviewProps {
  lines: ClientOfferLine[];
  currency: string;
  total: number;
  locale: string;
}

/**
 * Read-only mirror of the QuotationLine table — what the customer will see in
 * the portal. Lives on the inquiry tab so internal users can preview without
 * leaving their workspace.
 */
export function ClientOfferPreview({
  lines,
  currency,
  total,
  locale,
}: ClientOfferPreviewProps) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.clientOffer")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("quotations.inquiry.noLines")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("quotations.lines.description")}</TableHead>
                  <TableHead className="text-right">
                    {t("quotations.lines.quantity")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("quotations.lines.unitPrice")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("quotations.lines.lineTotal")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {l.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(l.unitPrice, currency, locale)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(l.total, currency, locale)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={3} className="text-right font-medium">
                    {t("quotations.total")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-base font-semibold">
                    {formatCurrency(total, currency, locale)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
