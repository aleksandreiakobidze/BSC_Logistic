import { setRequestLocale, getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { staffRoles } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import { NewItemButton } from "./new-item-button";
import { ItemsTable, type ItemRow } from "./items-table";

export default async function ItemsPage({
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
  const { orgId } = await requireRole(staffRoles);
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  const q = sp?.q?.trim() ?? "";

  const items = await prisma.stockItem.findMany({
    where: {
      orgId,
      ...(q
        ? {
            OR: [
              { sku: { contains: q } },
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const rows: ItemRow[] = items.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    description: i.description,
    unit: i.unit,
    unitPrice: Number(i.unitPrice),
    currency: i.currency,
    taxRate: Number(i.taxRate),
    weightKg: i.weightKg ?? null,
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  // Quick KPI: distinct currencies in this org's catalog.
  const currencies = Array.from(new Set(rows.map((r) => r.currency)));

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx("items.title", "Items")}
        description={
          rows.length > 0
            ? tx("items.summary", "{count} items · {currencies} currencies")
                .replace("{count}", String(rows.length))
                .replace("{currencies}", String(currencies.length))
            : tx(
                "items.subtitle",
                "Catalog of products and services you sell. Items are reusable across quotations, orders and invoices.",
              )
        }
        actions={<NewItemButton />}
      />

      <ListFilters
        searchPlaceholder={tx("items.searchPlaceholder", "Search SKU or name…")}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            q
              ? tx("items.noMatch", "No items match your search")
              : tx("items.emptyTitle", "No items yet")
          }
          description={
            q
              ? tx(
                  "items.noMatchDesc",
                  "Try a different SKU or name, or create a new item.",
                )
              : tx(
                  "items.emptyDesc",
                  "Create your first item to start using it in quotations and invoices.",
                )
          }
          action={<NewItemButton />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ItemsTable rows={rows} locale={locale} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
