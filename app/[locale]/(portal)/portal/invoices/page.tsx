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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Receipt, FileDown } from "lucide-react";

export default async function PortalInvoicesPage({
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
  const status = typeof sp.status === "string" ? sp.status : "";

  const invoices = await prisma.invoice.findMany({
    where: {
      customerId: session.user.customerId,
      ...(q ? { number: { contains: q } } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { issueDate: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("portal.invoices.title")} />

      <form className="flex items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder={t("portal.invoices.searchPlaceholder")}
          className="max-w-xs"
        />
      </form>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("portal.invoices.empty")}
              description={t("portal.invoices.emptyDesc")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.number")}</TableHead>
                  <TableHead>{t("invoices.issueDate")}</TableHead>
                  <TableHead>{t("invoices.dueDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.total")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("invoices.balanceDue")}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const balance = Math.max(
                    0,
                    Number(inv.total) - Number(inv.paid),
                  );
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/${locale}/portal/invoices/${inv.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.issueDate, locale)}
                      </TableCell>
                      <TableCell
                        className={
                          inv.status === "OVERDUE"
                            ? "text-destructive font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {formatDate(inv.dueDate, locale)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} kind="invoice" />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(inv.total), inv.currency, locale)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          balance > 0 ? "text-destructive font-medium" : ""
                        }`}
                      >
                        {formatCurrency(balance, inv.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                          >
                            <FileDown className="mr-1 h-3 w-3" />
                            PDF
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
