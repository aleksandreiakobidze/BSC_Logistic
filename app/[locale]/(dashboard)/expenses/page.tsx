import { setRequestLocale, getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { ExportButton } from "@/components/app/export-button";

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const expenses = await prisma.expense.findMany({
    where: { orgId },
    orderBy: { incurredAt: "desc" },
  });

  const total = expenses.reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.expenses")}
        description={`Total: ${formatCurrency(total, "USD", locale)}`}
        actions={<ExportButton entity="expenses" />}
      />

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses logged" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.incurredAt, locale)}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.vendor ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(e.amount), e.currency, locale)}
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
