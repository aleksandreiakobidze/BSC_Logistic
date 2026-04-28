import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Package, Receipt } from "lucide-react";

export default async function MyPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();

  const [orders, invoices] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: session.user.customerId },
      include: { shipments: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { customerId: session.user.customerId },
      orderBy: { issueDate: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("portal.myShipments")}</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> Orders</CardTitle>
          <Button asChild variant="outline" size="sm"><Link href={`/${locale}/portal`}>Track shipment</Link></Button>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders placed with us will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.number}</TableCell>
                    <TableCell><StatusBadge status={o.status} kind="order" /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {o.shipments.map((s) => (
                          <Link
                            key={s.id}
                            href={`/${locale}/portal/track/${s.trackingCode}`}
                            className="rounded-full border px-2 py-0.5 text-xs font-mono hover:bg-accent"
                          >
                            {s.trackingCode}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {o.price ? formatCurrency(Number(o.price)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> {t("portal.myInvoices")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.number}</TableCell>
                    <TableCell>{formatDateTime(inv.issueDate)}</TableCell>
                    <TableCell>{formatDateTime(inv.dueDate)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} kind="invoice" /></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(inv.total))}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank">Download</a>
                      </Button>
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
