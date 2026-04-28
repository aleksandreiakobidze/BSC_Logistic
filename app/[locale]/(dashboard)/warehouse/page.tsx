import { setRequestLocale, getTranslations } from "next-intl/server";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDateTime } from "@/lib/utils";

export default async function WarehousePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [warehouses, items, movements] = await Promise.all([
    prisma.warehouse.findMany({
      where: { orgId },
      include: { _count: { select: { bins: true } } },
    }),
    prisma.stockItem.findMany({
      where: { orgId },
      include: { movements: true },
    }),
    prisma.stockMovement.findMany({
      where: { warehouse: { orgId } },
      orderBy: { at: "desc" },
      take: 25,
      include: { warehouse: true, item: true },
    }),
  ]);

  const itemsWithStock = items.map((item) => {
    const qty = item.movements.reduce((acc, m) => {
      if (m.kind === "INBOUND") return acc + Number(m.quantity);
      if (m.kind === "OUTBOUND") return acc - Number(m.quantity);
      if (m.kind === "ADJUSTMENT") return acc + Number(m.quantity);
      return acc;
    }, 0);
    return { ...item, stock: qty };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("warehouse.title")} />

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add warehouses to manage inventory."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <WarehouseIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[w.city, w.country].filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">{w._count.bins} bins</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("warehouse.items")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("warehouse.sku")}</TableHead>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsWithStock.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                        <TableCell>{i.name}</TableCell>
                        <TableCell className="text-right font-mono">{i.stock} {i.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("warehouse.movements")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>{t("warehouse.sku")}</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead className="text-right">{t("warehouse.quantity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{formatDateTime(m.at, locale)}</TableCell>
                        <TableCell className="font-mono text-xs">{m.item.sku}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              m.kind === "INBOUND"
                                ? "success"
                                : m.kind === "OUTBOUND"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {m.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{Number(m.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
