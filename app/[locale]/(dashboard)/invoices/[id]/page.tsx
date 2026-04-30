import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Download,
  FileText,
  Receipt,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { refreshOverdueInvoices } from "@/lib/payments";
import { InvoicePaymentPanel } from "./invoice-payment-panel";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  await refreshOverdueInvoices(orgId);

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      lines: { orderBy: { id: "asc" } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { createdBy: { select: { name: true, email: true } } },
      },
      order: { select: { id: true, number: true } },
    },
  });

  if (!invoice) notFound();

  const total = Number(invoice.total);
  const paid = Number(invoice.paid);
  const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);
  const subtotal = Number(invoice.subtotal);
  const taxAmount = Number(invoice.taxAmount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("invoices.number")} ${invoice.number}`}
        description={
          <div className="flex items-center gap-2">
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("invoices.title")}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <StatusBadge
              kind="invoice"
              status={invoice.status}
              label={t(`invoices.status.${invoice.status}`)}
            />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Link>
            </Button>
            <InvoicePaymentPanel
              invoiceId={invoice.id}
              invoiceNumber={invoice.number}
              total={total}
              paid={paid}
              currency={invoice.currency}
              status={invoice.status}
              customerName={invoice.customer.name}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("invoices.lines")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoices.description")}</TableHead>
                    <TableHead className="text-right">{t("invoices.quantity")}</TableHead>
                    <TableHead className="text-right">{t("invoices.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("invoices.lineTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium">{line.description}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {line.kind}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(line.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Number(line.unitPrice), invoice.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(Number(line.total), invoice.currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t("payments.timeline")}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({invoice.payments.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoice.payments.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("payments.empty")}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("payments.paidAt")}</TableHead>
                      <TableHead>{t("payments.method")}</TableHead>
                      <TableHead>{t("payments.reference")}</TableHead>
                      <TableHead>{t("payments.recordedBy")}</TableHead>
                      <TableHead className="text-right">{t("payments.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          {formatDateTime(p.paidAt, locale)}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium">
                            {t(`payments.methods.${p.method}`)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.reference || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.createdBy?.name || p.createdBy?.email || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(Number(p.amount), p.currency, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("invoices.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow
                label={t("invoices.subtotal")}
                value={formatCurrency(subtotal, invoice.currency, locale)}
              />
              <SummaryRow
                label={`${t("invoices.tax")} (${Number(invoice.taxRate).toFixed(2)}%)`}
                value={formatCurrency(taxAmount, invoice.currency, locale)}
              />
              <Separator />
              <SummaryRow
                label={t("invoices.total")}
                value={formatCurrency(total, invoice.currency, locale)}
                strong
              />
              <SummaryRow
                label={t("payments.totalPaid")}
                value={formatCurrency(paid, invoice.currency, locale)}
                muted
              />
              <Separator />
              <SummaryRow
                label={t("invoices.balanceDue")}
                value={formatCurrency(balanceDue, invoice.currency, locale)}
                strong
                accent={balanceDue > 0 ? "warning" : "success"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("orders.customer")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link
                href={`/customers/${invoice.customer.id}`}
                className="font-medium hover:underline"
              >
                {invoice.customer.name}
              </Link>
              {invoice.customer.email && (
                <div className="text-muted-foreground">{invoice.customer.email}</div>
              )}
              {invoice.customer.phone && (
                <div className="text-muted-foreground">{invoice.customer.phone}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t("invoices.dates")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SummaryRow
                label={t("invoices.issueDate")}
                value={formatDate(invoice.issueDate, locale)}
              />
              <SummaryRow
                label={t("invoices.dueDate")}
                value={formatDate(invoice.dueDate, locale)}
              />
              {invoice.order && (
                <SummaryRow
                  label={t("orders.title")}
                  value={
                    <Link
                      href={`/orders/${invoice.order.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      #{invoice.order.number}
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  muted,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
  accent?: "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-xs ${muted ? "text-muted-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span
        className={[
          "font-mono",
          strong ? "text-sm font-semibold" : "text-sm",
          accent === "warning" ? "text-amber-600 dark:text-amber-400" : "",
          accent === "success" ? "text-emerald-600 dark:text-emerald-400" : "",
          muted ? "text-muted-foreground" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
