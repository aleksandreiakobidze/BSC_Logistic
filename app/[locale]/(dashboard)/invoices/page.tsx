import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewInvoiceButton } from "./new-invoice-button";
import { ExportButton } from "@/components/app/export-button";

export default async function InvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [invoices, customers, orders] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
      take: 200,
    }),
    prisma.customer.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { orgId, status: { in: ["COMPLETED", "IN_PROGRESS", "CONFIRMED"] } },
      select: { id: true, number: true, price: true, currency: true, customerId: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("invoices.title")}
        actions={
          <>
            <ExportButton entity="invoices" />
            <NewInvoiceButton customers={customers} orders={orders.map((o) => ({ ...o, price: Number(o.price) }))} />
          </>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Generate invoices for completed orders."
          action={<NewInvoiceButton customers={customers} orders={orders.map((o) => ({ ...o, price: Number(o.price) }))} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>{t("invoices.issueDate")}</TableHead>
                  <TableHead>{t("invoices.dueDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("invoices.total")}</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.customer.name}</TableCell>
                    <TableCell>{formatDate(inv.issueDate, locale)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate, locale)}</TableCell>
                    <TableCell>
                      <StatusBadge kind="invoice" status={inv.status} label={t(`invoices.status.${inv.status}`)} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(inv.total), inv.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        className="text-xs font-medium text-primary hover:underline"
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                      >
                        Download
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
