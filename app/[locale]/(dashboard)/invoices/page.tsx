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
import { InvoiceRowActions } from "./invoice-row-actions";
import { ExportButton } from "@/components/app/export-button";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";
import { ListFilters } from "@/components/app/list-filters";
import { InvoiceStatus } from "@/lib/enums";
import { refreshOverdueInvoices } from "@/lib/payments";

const STATUS_OPTIONS = Object.values(InvoiceStatus).map((s) => ({ label: s, value: s }));

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  await refreshOverdueInvoices(orgId);

  const q = sp?.q?.trim() ?? "";
  const status = sp?.status ?? "";
  const dateFrom = sp?.dateFrom ?? "";
  const dateTo = sp?.dateTo ?? "";

  const [invoices, customers, orders, billableExpenses, tripsRaw, customFields] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(dateFrom || dateTo ? {
          issueDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
          },
        } : {}),
        ...(q ? {
          OR: [
            { number: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
      take: 200,
    }),
    prisma.customer.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { orgId, status: { in: ["COMPLETED", "IN_PROGRESS", "CONFIRMED"] } },
      select: { id: true, number: true, price: true, currency: true, customerId: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.expense.findMany({
      where: {
        orgId,
        billable: true,
        invoiceLineId: null,
        OR: [
          { orderId: { not: null } },
          { allocations: { some: {} } },
        ],
      },
      include: {
        order: { select: { customerId: true } },
        allocations: { include: { order: { select: { customerId: true } } } },
      },
    }),
    prisma.trip.findMany({
      where: { orgId },
      select: {
        id: true,
        number: true,
        shipments: {
          select: {
            orderLinks: { select: { order: { select: { customerId: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.INVOICE),
  ]);

  const expenseOptions = billableExpenses.flatMap((e) => {
    const customers = new Set<string>();
    if (e.order?.customerId) customers.add(e.order.customerId);
    for (const a of e.allocations) if (a.order?.customerId) customers.add(a.order.customerId);
    return [...customers].map((cid) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      currency: e.currency,
      category: e.category,
      customerId: cid,
    }));
  });

  const tripOptions = tripsRaw.map((tr) => ({
    id: tr.id,
    number: tr.number,
    customerIds: [
      ...new Set(
        tr.shipments.flatMap((s) =>
          s.orderLinks.map((l) => l.order.customerId),
        ),
      ),
    ],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("invoices.title")}
        actions={
          <>
            <ExportButton entity="invoices" />
            <NewInvoiceButton
              customers={customers}
              orders={orders.map((o) => ({ ...o, price: Number(o.price) }))}
              expenses={expenseOptions}
              trips={tripOptions}
              customFields={customFields}
            />
          </>
        }
      />

      <ListFilters
        searchPlaceholder="Search by number or customer…"
        filters={[
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
          { key: "dateFrom", label: "From date", type: "date" },
          { key: "dateTo", label: "To date", type: "date" },
        ]}
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Generate invoices for completed orders."
          action={
            <NewInvoiceButton
              customers={customers}
              orders={orders.map((o) => ({ ...o, price: Number(o.price) }))}
              expenses={expenseOptions}
              trips={tripOptions}
              customFields={customFields}
            />
          }
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
                  <TableHead className="text-right">{t("invoices.balanceDue")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const total = Number(inv.total);
                  const paid = Number(inv.paid);
                  const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.customer.name}</TableCell>
                      <TableCell>{formatDate(inv.issueDate, locale)}</TableCell>
                      <TableCell>{formatDate(inv.dueDate, locale)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          kind="invoice"
                          status={inv.status}
                          label={t(`invoices.status.${inv.status}`)}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(total, inv.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={balanceDue > 0 ? "text-foreground" : "text-muted-foreground"}>
                          {formatCurrency(balanceDue, inv.currency, locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InvoiceRowActions
                          invoiceId={inv.id}
                          invoiceNumber={inv.number}
                          total={total}
                          paid={paid}
                          currency={inv.currency}
                          status={inv.status}
                          customerName={inv.customer.name}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
