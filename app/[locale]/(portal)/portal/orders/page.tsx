import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Package } from "lucide-react";

export default async function PortalOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();
  const q = typeof sp.q === "string" ? sp.q : "";

  const orders = await prisma.order.findMany({
    where: {
      customerId: session.user.customerId,
      ...(q ? { number: { contains: q } } : {}),
    },
    include: { shipmentLinks: { include: { shipment: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("portal.orders.title")} />

      <form className="flex items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder={t("portal.orders.searchPlaceholder")}
          className="max-w-xs"
        />
      </form>

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("portal.orders.empty")}
              description={t("portal.orders.emptyDesc")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.number")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("shipments.title")}</TableHead>
                  <TableHead className="text-right">
                    {t("orders.price")}
                  </TableHead>
                  <TableHead>{t("common.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/${locale}/portal/orders/${o.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {o.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} kind="order" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {o.shipmentLinks.map((l) => (
                          <Link
                            key={l.shipment.id}
                            href={`/${locale}/portal/track/${l.shipment.trackingCode}`}
                            className="rounded-full border px-2 py-0.5 text-xs font-mono hover:bg-accent"
                          >
                            {l.shipment.trackingCode}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {o.price
                        ? formatCurrency(Number(o.price), o.currency, locale)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(o.createdAt, locale)}
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
