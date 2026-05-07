import { setRequestLocale, getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { NewCustomerButton } from "./new-customer-button";
import { ExportButton } from "@/components/app/export-button";
import { ImportButton } from "@/components/app/import-button";
import { CustomFieldEntity, parseValue } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";
import { ListFilters } from "@/components/app/list-filters";
import { CustomersTable, type CustomerRow } from "./customers-table";

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

  const [customers, customFields, org] = await Promise.all([
    prisma.customer.findMany({
      where: {
        orgId,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
                { code: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true, invoices: true } } },
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.CUSTOMER),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { baseCurrency: true },
    }),
  ]);

  // Batch-fetch all custom field values for the rendered customers in one
  // query — keyed by definitionId+recordId — so the table can render any
  // visible custom column without N+1 lookups.
  const customerIds = customers.map((c) => c.id);
  const definitionIds = customFields.map((d) => d.id);
  const values =
    customerIds.length > 0 && definitionIds.length > 0
      ? await prisma.customFieldValue.findMany({
          where: {
            orgId,
            entityType: CustomFieldEntity.CUSTOMER,
            recordId: { in: customerIds },
            definitionId: { in: definitionIds },
          },
        })
      : [];

  const defKeyById = new Map(customFields.map((d) => [d.id, d.key]));
  const valuesByCustomer = new Map<string, Record<string, unknown>>();
  for (const v of values) {
    const key = defKeyById.get(v.definitionId);
    if (!key) continue;
    const map = valuesByCustomer.get(v.recordId) ?? {};
    map[key] = parseValue(v.valueJson);
    valuesByCustomer.set(v.recordId, map);
  }

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    orderCount: c._count.orders,
    invoiceCount: c._count.invoices,
    creditLimit: Number(c.creditLimit),
    createdAt: c.createdAt.toISOString(),
    cf: valuesByCustomer.get(c.id) ?? {},
  }));

  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customers.title")}
        actions={
          <>
            <ImportButton entity="customers" />
            <ExportButton entity="customers" />
            <NewCustomerButton customFields={customFields} />
          </>
        }
      />

      <ListFilters searchPlaceholder={tx("customers.searchPlaceholder", "Search customers…")} />

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={tx("customers.emptyTitle", "No customers yet")}
          description={tx(
            "customers.emptyDesc",
            "Add your first customer to start creating orders and invoices.",
          )}
          action={<NewCustomerButton customFields={customFields} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <CustomersTable
              customers={rows}
              customFields={customFields}
              locale={locale}
              baseCurrency={org?.baseCurrency ?? "USD"}
              storageScope={`customers:${orgId}`}
              fixedLabels={{
                name: t("common.name"),
                email: t("common.email"),
                phone: t("common.phone"),
                orders: tx("customers.ordersCol", "Orders"),
                invoices: tx("customers.invoicesCol", "Invoices"),
                credit: t("customers.creditLimit"),
                created: t("common.created"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
