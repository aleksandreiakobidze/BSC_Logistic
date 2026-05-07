import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe2, MapPin, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  EditSupplierButton,
  type SupplierValue,
} from "../supplier-dialog";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [supplier, users] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id, orgId },
      include: {
        owner: { select: { id: true, name: true } },
        offers: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            quotation: {
              select: {
                id: true,
                number: true,
                status: true,
                customer: { select: { id: true, name: true } },
              },
            },
            manager: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!supplier) notFound();

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
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/suppliers"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Truck className="h-5 w-5 text-muted-foreground" />
            {supplier.name}
            <Badge variant="outline" className="text-[10px]">
              {t(`suppliers.types.${supplier.type}`)}
            </Badge>
          </span>
        }
        description={supplier.code ?? undefined}
        actions={<EditSupplierButton supplier={sv} users={users} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("suppliers.details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {supplier.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <a
                  href={`mailto:${supplier.email}`}
                  className="hover:underline"
                >
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${supplier.phone}`} className="hover:underline">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe2 className="h-4 w-4 shrink-0" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {supplier.website}
                </a>
              </div>
            )}
            {(supplier.city || supplier.country || supplier.address) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {[supplier.address, supplier.city, supplier.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            <Separator />
            <Row
              label={t("common.currency")}
              value={supplier.currency}
            />
            {supplier.paymentTerms && (
              <Row
                label={t("suppliers.paymentTerms")}
                value={supplier.paymentTerms}
              />
            )}
            {supplier.defaultTransitTimeDays != null && (
              <Row
                label={t("suppliers.defaultTransitTimeDays")}
                value={`${supplier.defaultTransitTimeDays}d`}
              />
            )}
            {supplier.taxId && (
              <Row label={t("contacts.taxId")} value={supplier.taxId} />
            )}
            {supplier.owner?.name && (
              <Row
                label={t("suppliers.owner")}
                value={supplier.owner.name}
              />
            )}
            <Row
              label={t("common.created")}
              value={formatDate(supplier.createdAt, locale)}
            />
            {supplier.notes && (
              <>
                <Separator />
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {supplier.notes}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("suppliers.recentOffers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supplier.offers.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                {t("suppliers.noOffers")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("quotations.number")}</TableHead>
                    <TableHead>{t("orders.customer")}</TableHead>
                    <TableHead>{t("quotations.inquiry.team")}</TableHead>
                    <TableHead>{t("suppliers.offerStatus")}</TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.totalCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("quotations.inquiry.transitTime")}
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">
                      {t("common.created")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell>
                        <Link
                          href={`/quotations/${offer.quotation.id}`}
                          className="font-mono text-sm hover:underline"
                        >
                          {offer.quotation.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {offer.quotation.customer.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`quotations.inquiry.teams.${offer.team}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            offer.isSelected
                              ? "success"
                              : offer.status === "REJECTED"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {offer.isSelected
                            ? t("suppliers.selected")
                            : offer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(
                          Number(offer.totalCost),
                          offer.currency,
                          locale,
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {offer.transitTimeDays != null
                          ? `${offer.transitTimeDays}d`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(offer.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
