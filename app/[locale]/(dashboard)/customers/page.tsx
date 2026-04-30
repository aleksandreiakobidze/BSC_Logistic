import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { NewCustomerButton } from "./new-customer-button";
import { ExportButton } from "@/components/app/export-button";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";
import { ListFilters } from "@/components/app/list-filters";

export default async function CustomersPage({
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

  const [customers, customFields] = await Promise.all([
    prisma.customer.findMany({
      where: {
        orgId,
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { code: { contains: q } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true, invoices: true } } },
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.CUSTOMER),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customers.title")}
        actions={
          <>
            <ExportButton entity="customers" />
            <NewCustomerButton customFields={customFields} />
          </>
        }
      />

      <ListFilters searchPlaceholder="Search customers…" />

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers yet"
          description="Add your first customer to start creating orders and invoices."
          action={<NewCustomerButton customFields={customFields} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead className="text-right">{t("customers.creditLimit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.code && (
                        <div className="text-xs text-muted-foreground">{c.code}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell>{c._count.orders}</TableCell>
                    <TableCell>{c._count.invoices}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(c.creditLimit), "USD", locale)}
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
