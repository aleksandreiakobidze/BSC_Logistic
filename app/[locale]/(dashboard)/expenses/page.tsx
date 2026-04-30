import { setRequestLocale, getTranslations } from "next-intl/server";
import { Receipt, DollarSign, TrendingDown, Tag } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { ExportButton } from "@/components/app/export-button";
import { StatCard } from "@/components/app/stat-card";
import { ListFilters } from "@/components/app/list-filters";
import { NewExpenseButton, type ScopeOptions } from "./new-expense-button";
import { EditExpenseButton } from "./edit-expense-button";
import { DeleteExpenseButton } from "./delete-expense-button";
import { EXPENSE_CATEGORIES } from "./expense-constants";

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: c }));
const SCOPE_OPTIONS = [
  { label: "Org", value: "ORG" },
  { label: "Order", value: "ORDER" },
  { label: "Trip", value: "TRIP" },
  { label: "Shipment", value: "SHIPMENT" },
  { label: "Driver", value: "DRIVER" },
  { label: "Vehicle", value: "VEHICLE" },
];

function scopeLabel(e: {
  orderId: string | null;
  tripId: string | null;
  shipmentId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  order?: { number: string } | null;
  trip?: { number: string } | null;
  shipment?: { number: string } | null;
  driver?: { firstName: string; lastName: string } | null;
  vehicle?: { plate: string } | null;
}): { kind: string; ref: string | null } {
  if (e.orderId) return { kind: "Order", ref: e.order?.number ?? null };
  if (e.tripId) return { kind: "Trip", ref: e.trip?.number ?? null };
  if (e.shipmentId) return { kind: "Shipment", ref: e.shipment?.number ?? null };
  if (e.driverId) return { kind: "Driver", ref: e.driver ? `${e.driver.firstName} ${e.driver.lastName}` : null };
  if (e.vehicleId) return { kind: "Vehicle", ref: e.vehicle?.plate ?? null };
  return { kind: "Org", ref: null };
}

export default async function ExpensesPage({
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
  const dateFrom = sp?.dateFrom ?? "";
  const dateTo = sp?.dateTo ?? "";
  const category = sp?.category ?? "";
  const scope = sp?.scope ?? "";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const scopeFilter =
    scope === "ORDER" ? { orderId: { not: null } }
    : scope === "TRIP" ? { tripId: { not: null }, orderId: null }
    : scope === "SHIPMENT" ? { shipmentId: { not: null } }
    : scope === "DRIVER" ? { driverId: { not: null }, tripId: null, orderId: null, shipmentId: null }
    : scope === "VEHICLE" ? { vehicleId: { not: null }, tripId: null, orderId: null, shipmentId: null, driverId: null }
    : scope === "ORG" ? { orderId: null, tripId: null, shipmentId: null, driverId: null, vehicleId: null }
    : {};

  const [expenses, allExpenses, monthExpenses, categoryGroups, scopeOptionsRaw] = await Promise.all([
    prisma.expense.findMany({
      where: {
        orgId,
        ...(category ? { category } : {}),
        ...(dateFrom || dateTo ? {
          incurredAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
          },
        } : {}),
        ...scopeFilter,
        ...(q ? {
          OR: [
            { description: { contains: q } },
            { vendor: { contains: q } },
            { category: { contains: q } },
          ],
        } : {}),
      },
      include: {
        order: { select: { id: true, number: true } },
        trip: { select: { id: true, number: true } },
        shipment: { select: { id: true, number: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        vehicle: { select: { id: true, plate: true } },
      },
      orderBy: { incurredAt: "desc" },
    }),
    prisma.expense.aggregate({ where: { orgId }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { orgId, incurredAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { orgId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    }),
    Promise.all([
      prisma.order.findMany({
        where: { orgId },
        select: { id: true, number: true, customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.trip.findMany({
        where: { orgId },
        select: { id: true, number: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.shipment.findMany({
        where: { orgId },
        select: { id: true, number: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.driver.findMany({
        where: { orgId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      }),
      prisma.vehicle.findMany({
        where: { orgId },
        select: { id: true, plate: true },
        orderBy: { plate: "asc" },
      }),
    ]),
  ]);

  const [ordersRaw, tripsRaw, shipmentsRaw, driversRaw, vehiclesRaw] = scopeOptionsRaw;

  const scopeOptions: ScopeOptions = {
    orders: ordersRaw.map((o) => ({ id: o.id, number: o.number, customerName: o.customer.name })),
    trips: tripsRaw,
    shipments: shipmentsRaw,
    drivers: driversRaw,
    vehicles: vehiclesRaw,
  };

  const totalAll = Number(allExpenses._sum.amount ?? 0);
  const totalMonth = Number(monthExpenses._sum.amount ?? 0);
  const topCategory = categoryGroups[0]?.category ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.expenses")}
        actions={
          <>
            <ExportButton entity="expenses" />
            <NewExpenseButton scopeOptions={scopeOptions} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total (all time)"
          value={formatCurrency(totalAll, "USD", locale)}
          icon={DollarSign}
          accent="primary"
        />
        <StatCard
          label="This month"
          value={formatCurrency(totalMonth, "USD", locale)}
          icon={TrendingDown}
          accent="warning"
          hint="Current month spending"
        />
        <StatCard
          label="Top category"
          value={topCategory}
          icon={Tag}
          accent="success"
          hint="Highest cumulative spend"
        />
      </div>

      <ListFilters
        searchPlaceholder="Search description, vendor or category…"
        filters={[
          { key: "category", label: "Category", type: "select", options: CATEGORY_OPTIONS },
          { key: "scope", label: "Scope", type: "select", options: SCOPE_OPTIONS },
          { key: "dateFrom", label: "From date", type: "date" },
          { key: "dateTo", label: "To date", type: "date" },
        ]}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses logged"
          description="Track your operational costs by adding expenses."
          action={<NewExpenseButton scopeOptions={scopeOptions} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const sl = scopeLabel(e);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(e.incurredAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {e.description}
                        {e.billable && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Billable</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={sl.kind === "Org" ? "outline" : "secondary"}>{sl.kind}</Badge>
                        {sl.ref && <span className="ml-1.5 text-muted-foreground">{sl.ref}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.vendor ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(Number(e.amount), e.currency, locale)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <EditExpenseButton
                            expense={{
                              id: e.id,
                              category: e.category,
                              description: e.description,
                              amount: Number(e.amount),
                              currency: e.currency,
                              vendor: e.vendor,
                              incurredAt: e.incurredAt,
                              orderId: e.orderId,
                              tripId: e.tripId,
                              shipmentId: e.shipmentId,
                              driverId: e.driverId,
                              vehicleId: e.vehicleId,
                              billable: e.billable,
                            }}
                            scopeOptions={scopeOptions}
                          />
                          <DeleteExpenseButton id={e.id} description={e.description} />
                        </div>
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
