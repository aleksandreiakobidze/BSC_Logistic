import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDateTime } from "@/lib/utils";
import { ListFilters } from "@/components/app/list-filters";
import { MovementKind } from "@/lib/enums";

const MOVEMENT_OPTIONS = Object.values(MovementKind).map((k) => ({ label: k, value: k }));

export default async function WarehousePage({
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
  const movementKind = sp?.kind ?? "";

  // Items / catalog management lives entirely at /items now. Warehouse only
  // shows physical locations and their stock movements.
  const [warehouses, movements] = await Promise.all([
    prisma.warehouse.findMany({
      where: { orgId },
      include: { _count: { select: { bins: true } } },
    }),
    prisma.stockMovement.findMany({
      where: {
        warehouse: { orgId },
        ...(movementKind ? { kind: movementKind } : {}),
        ...(q ? {
          OR: [
            { item: { sku: { contains: q } } },
            { item: { name: { contains: q } } },
            { warehouse: { name: { contains: q } } },
          ],
        } : {}),
      },
      orderBy: { at: "desc" },
      take: 50,
      include: { warehouse: true, item: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("warehouse.title")} />

      <ListFilters
        searchPlaceholder="Search SKU or warehouse name…"
        filters={[
          { key: "kind", label: "Movement", type: "select", options: MOVEMENT_OPTIONS },
        ]}
      />

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

          <Card>
            <CardHeader>
              <CardTitle>{t("warehouse.movements")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>{t("warehouse.sku")}</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">{t("warehouse.quantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDateTime(m.at, locale)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/items/${m.item.id}`}
                          className="text-primary hover:underline"
                        >
                          {m.item.sku}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{m.warehouse.name}</TableCell>
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
        </>
      )}
    </div>
  );
}
