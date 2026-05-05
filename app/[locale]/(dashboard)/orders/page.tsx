import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewOrderButton } from "./new-order-button";
import { ExportButton } from "@/components/app/export-button";
import { ImportButton } from "@/components/app/import-button";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";
import { ListFilters } from "@/components/app/list-filters";
import { OrderStatus } from "@/lib/enums";

const STATUS_OPTIONS = Object.values(OrderStatus).map((s) => ({ label: s.replace("_", " "), value: s }));

export default async function OrdersPage({
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

  const q = sp?.q?.trim() ?? "";
  const status = sp?.status ?? "";

  const [orders, customers, customFields] = await Promise.all([
    prisma.order.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(q ? {
          OR: [
            { number: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { customer: true, _count: { select: { shipmentLinks: true } } },
      take: 200,
    }),
    prisma.customer.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.ORDER),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("orders.title")}
        actions={
          <>
            <ImportButton entity="orders" />
            <ExportButton entity="orders" />
            <NewOrderButton customers={customers} customFields={customFields} />
          </>
        }
      />

      <ListFilters
        searchPlaceholder="Search by number or customer…"
        filters={[
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
        ]}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Create your first order to start dispatching."
          action={<NewOrderButton customers={customers} customFields={customFields} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.number")}</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead className="text-right">{t("orders.price")}</TableHead>
                  <TableHead className="text-right">{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">{o.number}</Link>
                    </TableCell>
                    <TableCell>{o.customer.name}</TableCell>
                    <TableCell>
                      <StatusBadge kind="order" status={o.status} label={t(`orders.status.${o.status}`)} />
                    </TableCell>
                    <TableCell>{o._count.shipmentLinks}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(o.price), o.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(o.createdAt, locale)}
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
