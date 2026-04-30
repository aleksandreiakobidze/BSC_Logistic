import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FileSignature } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuotationStatus } from "@/lib/enums";
import { expireQuotations } from "@/lib/quotations";
import { NewQuotationButton } from "./new-quotation-button";

const STATUS_OPTIONS = Object.values(QuotationStatus).map((s) => ({
  label: s,
  value: s,
}));

export default async function QuotationsPage({
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

  await expireQuotations(orgId);

  const q = sp?.q?.trim() ?? "";
  const status = sp?.status ?? "";
  const customerId = sp?.customerId ?? "";
  const dateFrom = sp?.dateFrom ?? "";
  const dateTo = sp?.dateTo ?? "";

  const [quotations, customers] = await Promise.all([
    prisma.quotation.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo
                  ? { lte: new Date(dateTo + "T23:59:59.999Z") }
                  : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q } },
                { customer: { name: { contains: q } } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.customer.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("quotations.title")}
        description={t("quotations.description")}
        actions={<NewQuotationButton customers={customers} />}
      />

      <ListFilters
        searchPlaceholder={t("quotations.searchPlaceholder")}
        filters={[
          {
            key: "status",
            label: t("common.status"),
            type: "select",
            options: STATUS_OPTIONS,
          },
          {
            key: "customerId",
            label: t("orders.customer"),
            type: "select",
            options: customers.map((c) => ({ label: c.name, value: c.id })),
          },
          { key: "dateFrom", label: t("common.from"), type: "date" },
          { key: "dateTo", label: t("common.to"), type: "date" },
        ]}
      />

      {quotations.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={t("quotations.empty.title")}
          description={t("quotations.empty.description")}
          action={<NewQuotationButton customers={customers} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("orders.customer")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("quotations.validUntil")}</TableHead>
                  <TableHead>{t("common.created")}</TableHead>
                  <TableHead className="text-right">{t("quotations.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="hover:underline"
                      >
                        {q.number}
                      </Link>
                    </TableCell>
                    <TableCell>{q.customer.name}</TableCell>
                    <TableCell>
                      <StatusBadge
                        kind="quotation"
                        status={q.status}
                        label={t(`quotations.status.${q.status}`)}
                      />
                    </TableCell>
                    <TableCell>
                      {q.validUntil ? formatDate(q.validUntil, locale) : "—"}
                    </TableCell>
                    <TableCell>{formatDate(q.createdAt, locale)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(q.total), q.currency, locale)}
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
