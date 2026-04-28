import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Users,
  Package,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { NewContactButton } from "@/app/[locale]/(dashboard)/contacts/new-contact-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const customer = await prisma.customer.findFirst({
    where: { id, orgId },
    include: {
      contacts: { orderBy: { name: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          price: true,
          currency: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          paid: true,
          currency: true,
          dueDate: true,
          issueDate: true,
        },
      },
      _count: { select: { orders: true, invoices: true, contacts: true } },
    },
  });

  if (!customer) notFound();

  const customers = [{ id: customer.id, name: customer.name }];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/customers"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {customer.name}
          </span>
        }
        description={customer.code ? `#${customer.code}` : undefined}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: t("common.total") + " " + t("nav.orders"),
            value: customer._count.orders,
          },
          {
            label: t("nav.invoices"),
            value: customer._count.invoices,
          },
          {
            label: t("contacts.title"),
            value: customer._count.contacts,
          },
          {
            label: t("customers.creditLimit"),
            value: formatCurrency(Number(customer.creditLimit), "USD", locale),
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar — info */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("leads.details")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {customer.email && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="break-all hover:underline"
                  >
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${customer.phone}`} className="hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {(customer.city || customer.country) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {[customer.city, customer.country].filter(Boolean).join(", ")}
                </div>
              )}
              {customer.taxId && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tax ID</span>
                    <span className="font-mono text-xs">{customer.taxId}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("customers.creditLimit")}
                </span>
                <span className="font-medium">
                  {formatCurrency(Number(customer.creditLimit), "USD", locale)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span
                  className={
                    Number(customer.balance) < 0
                      ? "font-medium text-destructive"
                      : "font-medium"
                  }
                >
                  {formatCurrency(Number(customer.balance), "USD", locale)}
                </span>
              </div>
              {customer.notes && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    {customer.notes}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="contacts">
            <TabsList>
              <TabsTrigger value="contacts" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t("contacts.title")}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {customer._count.contacts}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {t("nav.orders")}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {customer._count.orders}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {t("nav.invoices")}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {customer._count.invoices}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Contacts tab */}
            <TabsContent value="contacts" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t("contacts.title")}
                  </CardTitle>
                  <NewContactButton
                    customers={customers}
                    defaultCustomerId={customer.id}
                  />
                </CardHeader>
                <CardContent className="p-0">
                  {customer.contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Users className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("contacts.empty")}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.name")}</TableHead>
                          <TableHead>{t("contacts.position")}</TableHead>
                          <TableHead>{t("common.email")}</TableHead>
                          <TableHead>{t("common.phone")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.contacts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              {c.name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {c.position ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {c.email ? (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="hover:underline"
                                >
                                  {c.email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {c.phone ? (
                                <a
                                  href={`tel:${c.phone}`}
                                  className="hover:underline"
                                >
                                  {c.phone}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders tab */}
            <TabsContent value="orders" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {customer.orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Package className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("common.empty")}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("orders.number")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead>{t("common.date")}</TableHead>
                          <TableHead className="text-right">
                            {t("orders.price")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>
                              <Link
                                href={`/orders`}
                                className="font-medium hover:underline"
                              >
                                {o.number}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <StatusBadge kind="order" status={o.status} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(o.createdAt, locale)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(
                                Number(o.price),
                                o.currency,
                                locale,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices tab */}
            <TabsContent value="invoices" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {customer.invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("common.empty")}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("invoices.number")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead>{t("invoices.dueDate")}</TableHead>
                          <TableHead className="text-right">
                            {t("common.total")}
                          </TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Link
                                href={`/invoices`}
                                className="font-medium hover:underline"
                              >
                                {inv.number}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                kind="invoice"
                                status={inv.status}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(inv.dueDate, locale)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(
                                Number(inv.total),
                                inv.currency,
                                locale,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(
                                Number(inv.paid),
                                inv.currency,
                                locale,
                              )}
                            </TableCell>
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
      </div>
    </div>
  );
}
