import { setRequestLocale, getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { NewCustomerButton } from "./new-customer-button";

export default async function CustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const customers = await prisma.customer.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true, invoices: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customers.title")}
        actions={<NewCustomerButton />}
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers yet"
          description="Add your first customer to start creating orders and invoices."
          action={<NewCustomerButton />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead className="text-right">{t("customers.creditLimit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.code && (
                        <div className="text-xs text-muted-foreground">{c.code}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell>{c._count.orders}</TableCell>
                    <TableCell>{c._count.invoices}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(c.creditLimit), "USD", locale)}
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
