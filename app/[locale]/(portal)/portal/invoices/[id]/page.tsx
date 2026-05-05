import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ArrowLeft, FileDown, CreditCard, Receipt } from "lucide-react";

export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();

  const invoice = await prisma.invoice.findFirst({
    where: { id, customerId: session.user.customerId },
    include: {
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
      order: { select: { id: true, number: true } },
    },
  });

  if (!invoice) return notFound();

  const balance = Math.max(0, Number(invoice.total) - Number(invoice.paid));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={`/${locale}/portal/invoices`}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("portal.invoices.title")}
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{invoice.number}</span>
            <StatusBadge status={invoice.status} kind="invoice" />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Lines */}
          <Card>
            <CardHeader>
              <CardTitle>{t("invoices.lines")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoices.description")}</TableHead>
                    <TableHead className="text-right">
                      {t("invoices.quantity")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("invoices.unitPrice")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("invoices.lineTotal")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(line.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          Number(line.unitPrice),
                          invoice.currency,
                          locale,
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          Number(line.total),
                          invoice.currency,
                          locale,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t("portal.invoices.paymentHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 border-l pl-4">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="relative">
                      <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono font-medium">
                          {formatCurrency(
                            Number(p.amount),
                            p.currency,
                            locale,
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(p.paidAt)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("portal.invoices.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("invoices.subtotal")}
                </span>
                <span className="font-mono">
                  {formatCurrency(
                    Number(invoice.subtotal),
                    invoice.currency,
                    locale,
                  )}
                </span>
              </div>
              {Number(invoice.taxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("invoices.tax")} ({Number(invoice.taxRate)}%)
                  </span>
                  <span className="font-mono">
                    {formatCurrency(
                      Number(invoice.taxAmount),
                      invoice.currency,
                      locale,
                    )}
                  </span>
                </div>
              )}
              <hr />
              <div className="flex justify-between font-medium">
                <span>{t("invoices.total")}</span>
                <span className="font-mono">
                  {formatCurrency(
                    Number(invoice.total),
                    invoice.currency,
                    locale,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("invoices.paid")}
                </span>
                <span className="font-mono text-emerald-600">
                  {formatCurrency(
                    Number(invoice.paid),
                    invoice.currency,
                    locale,
                  )}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t("invoices.balanceDue")}</span>
                <span
                  className={`font-mono ${balance > 0 ? "text-destructive" : ""}`}
                >
                  {formatCurrency(balance, invoice.currency, locale)}
                </span>
              </div>

              <hr />

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t("invoices.issueDate")}</span>
                  <span>{formatDate(invoice.issueDate, locale)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("invoices.dueDate")}</span>
                  <span
                    className={
                      invoice.status === "OVERDUE" ? "text-destructive" : ""
                    }
                  >
                    {formatDate(invoice.dueDate, locale)}
                  </span>
                </div>
              </div>

              {invoice.order && (
                <>
                  <hr />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("orders.title")}
                    </span>
                    <Link
                      href={`/${locale}/portal/orders/${invoice.order.id}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {invoice.order.number}
                    </Link>
                  </div>
                </>
              )}

              <Button asChild className="w-full mt-2">
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank">
                  <FileDown className="mr-1.5 h-4 w-4" />
                  {t("common.exportPdf")}
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
