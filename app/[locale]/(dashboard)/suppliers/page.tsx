import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck, Mail, Phone, Globe2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { ListFilters } from "@/components/app/list-filters";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { SupplierStatus, SupplierType } from "@/lib/enums";
import {
  NewSupplierButton,
  EditSupplierButton,
  type SupplierValue,
} from "./supplier-dialog";

const STATUS_OPTIONS = Object.values(SupplierStatus).map((s) => ({
  label: s,
  value: s,
}));

const TYPE_OPTIONS = Object.values(SupplierType).map((t) => ({
  label: t,
  value: t,
}));

function statusVariant(
  s: string,
): "success" | "warning" | "destructive" | "outline" {
  switch (s) {
    case "ACTIVE":
      return "success";
    case "INACTIVE":
      return "outline";
    case "SUSPENDED":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const { locale } = await params;
  const { q, status, type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [suppliers, users] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { code: { contains: q } },
                { taxId: { contains: q } },
                { phone: { contains: q } },
                { country: { contains: q } },
                { city: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { offers: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("suppliers.title")}
        description={t("suppliers.description")}
        actions={<NewSupplierButton users={users} />}
      />

      <ListFilters
        searchPlaceholder={tx(
          "suppliers.searchPlaceholder",
          "Search suppliers...",
        )}
        filters={[
          {
            key: "status",
            label: t("suppliers.status"),
            type: "select",
            options: STATUS_OPTIONS,
          },
          {
            key: "type",
            label: t("suppliers.type"),
            type: "select",
            options: TYPE_OPTIONS,
          },
        ]}
      />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t("suppliers.empty")}
          description={t("suppliers.emptyDescription")}
          action={<NewSupplierButton users={users} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">
                      {t("suppliers.code")}
                    </TableHead>
                    <TableHead className="w-[90px]">
                      {t("suppliers.status")}
                    </TableHead>
                    <TableHead>{t("suppliers.name")}</TableHead>
                    <TableHead>{t("suppliers.type")}</TableHead>
                    <TableHead>{t("common.country")}</TableHead>
                    <TableHead>{t("common.email")}</TableHead>
                    <TableHead>{t("common.phone")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("suppliers.owner")}
                    </TableHead>
                    <TableHead className="text-right text-xs text-muted-foreground">
                      {t("suppliers.offerCount")}
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">
                      {t("common.created")}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => {
                    const sv: SupplierValue = {
                      id: supplier.id,
                      code: supplier.code,
                      name: supplier.name,
                      type: supplier.type,
                      status: supplier.status,
                      email: supplier.email,
                      phone: supplier.phone,
                      website: supplier.website,
                      taxId: supplier.taxId,
                      address: supplier.address,
                      city: supplier.city,
                      country: supplier.country,
                      currency: supplier.currency,
                      paymentTerms: supplier.paymentTerms,
                      defaultTransitTimeDays: supplier.defaultTransitTimeDays,
                      notes: supplier.notes,
                      ownerId: supplier.ownerId,
                      createdAt: supplier.createdAt.toISOString(),
                    };
                    return (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {supplier.code ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(supplier.status)}>
                            {t(`suppliers.statuses.${supplier.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className="hover:underline"
                          >
                            {supplier.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {t(`suppliers.types.${supplier.type}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[supplier.city, supplier.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {supplier.email ? (
                            <a
                              href={`mailto:${supplier.email}`}
                              className="flex items-center gap-1 hover:underline"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {supplier.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {supplier.phone ? (
                            <a
                              href={`tel:${supplier.phone}`}
                              className="flex items-center gap-1 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {supplier.phone}
                            </a>
                          ) : supplier.website ? (
                            <a
                              href={supplier.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline"
                            >
                              <Globe2 className="h-3.5 w-3.5" />
                              {supplier.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {supplier.owner?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {supplier._count.offers}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(supplier.createdAt, locale)}
                        </TableCell>
                        <TableCell>
                          <EditSupplierButton supplier={sv} users={users} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
