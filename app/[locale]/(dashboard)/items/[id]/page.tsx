import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Tag,
  Coins,
  Percent,
  Weight,
  Ruler,
  FileSignature,
  ArrowUpRight,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { staffRoles } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { EditItemButton } from "../new-item-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);
  const { orgId } = await requireRole(staffRoles);

  const item = await prisma.stockItem.findFirst({
    where: { id, orgId },
    include: {
      movements: {
        orderBy: { at: "desc" },
        take: 20,
        include: { warehouse: { select: { name: true } } },
      },
      _count: { select: { quotationLines: true, movements: true } },
    },
  });

  if (!item) notFound();

  const stock = item.movements.reduce((acc, m) => {
    if (m.kind === "INBOUND") return acc + Number(m.quantity);
    if (m.kind === "OUTBOUND") return acc - Number(m.quantity);
    if (m.kind === "ADJUSTMENT") return acc + Number(m.quantity);
    return acc;
  }, 0);

  // Quotations referencing this item (so the user can navigate from a SKU
  // back to the deals where it was sold).
  const lines = await prisma.quotationLine.findMany({
    where: { itemId: item.id, quotation: { orgId } },
    orderBy: { quotation: { updatedAt: "desc" } },
    take: 20,
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      quotation: {
        select: {
          id: true,
          number: true,
          status: true,
          updatedAt: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/items"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Package className="h-5 w-5 text-muted-foreground" />
            {item.name}
          </span>
        }
        description={
          <span className="font-mono text-xs uppercase">{item.sku}</span>
        }
        actions={
          <EditItemButton
            value={{
              id: item.id,
              sku: item.sku,
              name: item.name,
              description: item.description,
              unit: item.unit,
              unitPrice: Number(item.unitPrice),
              currency: item.currency,
              taxRate: Number(item.taxRate),
              weightKg: item.weightKg ?? "",
              notes: item.notes,
            }}
          />
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Coins}
          label={tx("items.fields.unitPrice", "Unit price")}
          value={formatCurrency(Number(item.unitPrice), item.currency, locale)}
          hint={item.currency}
        />
        <SummaryCard
          icon={Ruler}
          label={tx("items.fields.unit", "Unit")}
          value={item.unit}
        />
        <SummaryCard
          icon={Percent}
          label={tx("items.fields.tax", "Tax")}
          value={`${Number(item.taxRate)}%`}
        />
        <SummaryCard
          icon={Weight}
          label={tx("items.fields.weightKg", "Weight (kg)")}
          value={item.weightKg ?? "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Description */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">
              {tx("items.fields.description", "Description")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground whitespace-pre-line">
              {item.description?.trim() ||
                tx("items.noDescription", "No description.")}
            </p>
            <Separator />
            <Stat
              icon={Tag}
              label={tx("items.usageQuotations", "Used in quotations")}
              value={item._count.quotationLines}
            />
            <Stat
              icon={Package}
              label={tx("items.currentStock", "Current stock (latest 20 moves)")}
              value={`${stock} ${item.unit}`}
            />
            {item.notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("common.notes")}
                  </div>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {item.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Movements */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("warehouse.movements")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {item.movements.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                {tx("items.noMovements", "No stock movements yet.")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("warehouse.title")}</TableHead>
                    <TableHead>{tx("items.movementKind", "Kind")}</TableHead>
                    <TableHead className="text-right">
                      {t("warehouse.quantity")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">
                        {formatDateTime(m.at, locale)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.warehouse.name}
                      </TableCell>
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
                      <TableCell className="text-right font-mono">
                        {Number(m.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quotation usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            {tx("items.usageQuotations", "Used in quotations")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              {tx("items.noQuotations", "Not used in any quotation yet.")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("quotations.number", "Number")}</TableHead>
                  <TableHead>{t("nav.customers")}</TableHead>
                  <TableHead className="text-right">
                    {tx("items.fields.qty", "Qty")}
                  </TableHead>
                  <TableHead className="text-right">
                    {tx("items.fields.unitPrice", "Unit price")}
                  </TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/quotations/${l.quotation.id}`}
                        className="text-primary hover:underline"
                      >
                        {l.quotation.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.quotation.customer ? (
                        <Link
                          href={`/customers/${l.quotation.customer.id}`}
                          className="hover:underline"
                        >
                          {l.quotation.customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(l.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(
                        Number(l.unitPrice),
                        item.currency,
                        locale,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted" className="text-[10px]">
                        {l.quotation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quotations/${l.quotation.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="truncate font-mono text-base font-medium">
              {value}
            </div>
            {hint && (
              <div className="text-[10px] uppercase text-muted-foreground">
                {hint}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}
