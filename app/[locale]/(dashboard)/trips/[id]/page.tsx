import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TripShipments } from "./trip-shipments";
import { ExpenseAllocationDialog } from "@/components/app/expense-allocation-dialog";
import { getTripProfitability } from "@/lib/profitability";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const trip = await prisma.trip.findFirst({
    where: { id, orgId },
    include: {
      driver: true,
      vehicle: true,
      shipments: {
        include: {
          order: { include: { customer: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      expenses: {
        include: {
          allocations: { include: { order: { select: { id: true, number: true } } } },
        },
        orderBy: { incurredAt: "desc" },
      },
    },
  });
  if (!trip) notFound();

  // Available shipments (not on any trip yet, same org)
  const availableRaw = await prisma.shipment.findMany({
    where: { orgId, tripId: null },
    include: { order: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const attached = trip.shipments.map((s) => ({
    id: s.id,
    number: s.number,
    status: s.status,
    cargoType: s.cargoType,
    cargoWeightKg: s.cargoWeightKg,
    customer: s.order.customer.name,
    orderNumber: s.order.number,
  }));

  const available = availableRaw.map((s) => ({
    id: s.id,
    number: s.number,
    customer: s.order.customer.name,
    orderNumber: s.order.number,
  }));

  // Build per-order data for allocation dialogs.
  const orderMap = new Map<
    string,
    { orderId: string; number: string; customerName: string; weightKg: number; volumeM3: number; distanceKm: number; revenue: number }
  >();
  for (const s of trip.shipments) {
    const cur = orderMap.get(s.orderId) ?? {
      orderId: s.orderId,
      number: s.order.number,
      customerName: s.order.customer.name,
      weightKg: 0,
      volumeM3: 0,
      distanceKm: 0,
      revenue: Number(s.order.price),
    };
    cur.weightKg += Number(s.cargoWeightKg ?? 0);
    cur.volumeM3 += Number(s.cargoVolumeM3 ?? 0);
    cur.distanceKm += Number(s.plannedDistanceKm ?? 0);
    orderMap.set(s.orderId, cur);
  }
  const orders = [...orderMap.values()];

  const pnl = await getTripProfitability(trip.id);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 gap-1.5">
          <Link href="/trips"><ArrowLeft className="h-4 w-4" /> {t("trips.title")}</Link>
        </Button>
        <PageHeader
          title={trip.number}
          description={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge kind="shipment" status={trip.status} />
              <span className="text-muted-foreground">·</span>
              <span>{trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : "Unassigned driver"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-xs">{trip.vehicle?.plate ?? "No vehicle"}</span>
            </div>
          }
        />
      </div>

      {/* P&L summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Revenue (orders)</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(pnl.revenue, "USD", locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Trip cost</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(pnl.cost, "USD", locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Margin</div>
            <div className={`mt-2 text-2xl font-semibold ${pnl.margin >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(pnl.margin, "USD", locale)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{pnl.marginPct.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments */}
      <Card>
        <CardContent className="p-5">
          <TripShipments tripId={trip.id} attached={attached} available={available} />
        </CardContent>
      </Card>

      {/* Trip expenses with allocate button */}
      <Card>
        <CardHeader><CardTitle className="text-base">Trip expenses</CardTitle></CardHeader>
        <CardContent className="p-0">
          {trip.expenses.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No trip-level expenses yet. Create one from the Expenses page with this trip selected as scope.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Allocations</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trip.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{formatDate(e.incurredAt, locale)}</TableCell>
                    <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(e.amount), e.currency, locale)}</TableCell>
                    <TableCell className="text-xs">
                      {e.allocations.length === 0 ? (
                        <span className="text-muted-foreground">Not allocated</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.allocations.map((a) => (
                            <Badge key={a.id} variant="secondary" className="font-mono">
                              {a.order.number}: {formatCurrency(Number(a.amount), e.currency, locale)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {orders.length > 0 && (
                        <ExpenseAllocationDialog
                          expenseId={e.id}
                          expenseAmount={Number(e.amount)}
                          expenseCurrency={e.currency}
                          expenseDescription={e.description}
                          orders={orders}
                          initialAllocations={e.allocations.map((a) => ({
                            orderId: a.orderId,
                            amount: Number(a.amount),
                            method: a.method,
                          }))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
