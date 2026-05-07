import { setRequestLocale, getTranslations } from "next-intl/server";
import { Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import { MaintenanceKind } from "@/lib/enums";

const KIND_OPTIONS = Object.values(MaintenanceKind).map((k) => ({ label: k, value: k }));

export default async function MaintenancePage({
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
  const kind = sp?.kind ?? "";

  const records = await prisma.maintenance.findMany({
    where: {
      vehicle: { orgId },
      ...(kind ? { kind } : {}),
      ...(q ? {
        OR: [
          { description: { contains: q } },
          { vehicle: { plate: { contains: q } } },
        ],
      } : {}),
    },
    include: { vehicle: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.maintenance")} />

      <ListFilters
        searchPlaceholder="Search plate or description…"
        filters={[
          { key: "kind", label: "Kind", type: "select", options: KIND_OPTIONS },
        ]}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance records"
          description="Log maintenance against vehicles to track costs and plan ahead."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    {t("common.created")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.vehicle.plate}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.kind}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{m.description}</TableCell>
                    <TableCell>{m.dueDate ? formatDate(m.dueDate, locale) : "—"}</TableCell>
                    <TableCell>
                      {m.completedAt ? (
                        formatDate(m.completedAt, locale)
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(m.cost), "USD", locale)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(m.createdAt, locale)}
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
