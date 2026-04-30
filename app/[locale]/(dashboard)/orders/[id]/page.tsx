import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileSignature } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getOrderProfitability } from "@/lib/profitability";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const order = await prisma.order.findFirst({
    where: { id, orgId },
    include: {
      customer: true,
      shipments: {
        include: { driver: true, vehicle: true, trip: true },
        orderBy: { createdAt: "desc" },
      },
      expenses: { orderBy: { incurredAt: "desc" } },
      expenseAllocations: { include: { expense: true }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issueDate: "desc" } },
      lines: { orderBy: { sortOrder: "asc" } },
      sourceQuotation: { select: { id: true, number: true, status: true } },
    },
  });
  if (!order) notFound();

  const pnl = await getOrderProfitability(order.id);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 gap-1.5">
          <Link href="/orders"><ArrowLeft className="h-4 w-4" /> {t("orders.title")}</Link>
        </Button>
        <PageHeader
          title={`${order.number} · ${order.customer.name}`}
          description={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge kind="order" status={order.status} />
              <span className="text-muted-foreground">·</span>
              <span className="font-mono">{formatCurrency(Number(order.price), order.currency, locale)}</span>
              {order.sourceQuotation && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    href={`/quotations/${order.sourceQuotation.id}`}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs hover:bg-muted"
                  >
                    <FileSignature className="h-3 w-3" />
                    {t("orders.fromQuotation", { number: order.sourceQuotation.number })}
                  </Link>
                </>
              )}
            </div>
          }
        />
      </div>

      {/* Profitability summary card */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="mt-1 text-xl font-semibold">{formatCurrency(pnl.revenue, order.currency, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Cost (direct + allocated)</div>
            <div className="mt-1 text-xl font-semibold">{formatCurrency(pnl.cost, order.currency, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Margin</div>
            <div className={`mt-1 text-xl font-semibold ${pnl.margin >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(pnl.margin, order.currency, locale)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Margin %</div>
            <div className={`mt-1 text-xl font-semibold ${pnl.marginPct >= 0 ? "text-success" : "text-destructive"}`}>
              {pnl.marginPct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={order.lines.length > 0 ? "lines" : "shipments"}>
        <TabsList>
          {order.lines.length > 0 && (
            <TabsTrigger value="lines">{t("orders.lines")} ({order.lines.length})</TabsTrigger>
          )}
          <TabsTrigger value="shipments">Shipments ({order.shipments.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({order.expenses.length + order.expenseAllocations.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({order.invoices.length})</TabsTrigger>
        </TabsList>

        {order.lines.length > 0 && (
          <TabsContent value="lines">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("quotations.lines.description")}</TableHead>
                      <TableHead className="text-right">{t("quotations.lines.quantity")}</TableHead>
                      <TableHead className="text-right">{t("quotations.lines.unitPrice")}</TableHead>
                      <TableHead className="text-right">{t("quotations.lines.lineTotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="text-right font-mono">{Number(l.quantity)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(l.unitPrice), order.currency, locale)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(l.total), order.currency, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="shipments">
          <Card>
            <CardContent className="p-0">
              {order.shipments.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No shipments yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.shipments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <Link href={`/shipments/${s.id}`} className="hover:underline">{s.number}</Link>
                        </TableCell>
                        <TableCell><StatusBadge kind="shipment" status={s.status} /></TableCell>
                        <TableCell className="text-xs">
                          {s.trip ? <Link className="hover:underline" href={`/trips/${s.trip.id}`}>{s.trip.number}</Link> : "—"}
                        </TableCell>
                        <TableCell>{s.driver ? `${s.driver.firstName} ${s.driver.lastName}` : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.vehicle?.plate ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s.cargoType ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{s.cargoWeightKg ? `${s.cargoWeightKg} kg` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-3 text-sm font-medium">Direct expenses</div>
                {order.expenses.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">No direct expenses.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.expenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{formatDate(e.incurredAt, locale)}</TableCell>
                          <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                          <TableCell className="max-w-xs truncate">
                            {e.description}
                            {e.billable && <Badge variant="secondary" className="ml-2 text-[10px]">Billable</Badge>}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(e.amount), e.currency, locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b p-3 text-sm font-medium">Allocated trip expenses</div>
                {order.expenseAllocations.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">No allocations.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source expense</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.expenseAllocations.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{formatDate(a.createdAt, locale)}</TableCell>
                          <TableCell className="text-xs">{a.expense.description}</TableCell>
                          <TableCell className="text-xs"><Badge variant="outline">{a.method}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(a.amount), a.expense.currency, locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {order.invoices.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No invoices.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Issue date</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell className="text-xs">{formatDate(inv.issueDate, locale)}</TableCell>
                        <TableCell className="text-xs">{formatDate(inv.dueDate, locale)}</TableCell>
                        <TableCell><StatusBadge kind="invoice" status={inv.status} /></TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(inv.total), inv.currency, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
