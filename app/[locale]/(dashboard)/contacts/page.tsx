import { setRequestLocale, getTranslations } from "next-intl/server";
import { Users2, Mail, Phone, Building2 } from "lucide-react";
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
import { EmptyState } from "@/components/app/empty-state";
import { NewContactButton } from "./new-contact-button";
import { ExportButton } from "@/components/app/export-button";
import Link from "next/link";

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; customerId?: string }>;
}) {
  const { locale } = await params;
  const { q, customerId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [contacts, customers] = await Promise.all([
    prisma.contact.findMany({
      where: {
        customer: {
          orgId,
          ...(customerId ? { id: customerId } : {}),
        },
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { position: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("contacts.title")}
        description={t("contacts.description")}
        actions={
          <>
            <ExportButton entity="contacts" />
            <NewContactButton customers={customers} />
          </>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t("contacts.empty")}
          description={t("contacts.emptyDescription")}
          action={<NewContactButton customers={customers} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("contacts.position")}</TableHead>
                  <TableHead>{t("contacts.customer")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.position ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${contact.customer.id}`}
                        className="flex items-center gap-1.5 text-sm hover:underline"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {contact.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {contact.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </a>
                      ) : (
                        "—"
                      )}
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
