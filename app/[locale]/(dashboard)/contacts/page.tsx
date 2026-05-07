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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { ExportButton } from "@/components/app/export-button";
import { ListFilters } from "@/components/app/list-filters";
import Link from "next/link";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";
import { formatDate } from "@/lib/utils";
import { ContactStatus } from "@/lib/enums";
import {
  NewContactButton,
  EditContactButton,
  type ContactValue,
} from "./contact-dialog";
import { listContactLookups } from "./actions";

const STATUS_OPTIONS = Object.values(ContactStatus).map((s) => ({
  label: s,
  value: s,
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

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; customerId?: string; status?: string }>;
}) {
  const { locale } = await params;
  const { q, customerId, status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [contacts, customers, customFields, industries, jobTitles] =
    await Promise.all([
      prisma.contact.findMany({
        where: {
          orgId,
          ...(customerId ? { customerId } : {}),
          ...(status ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { email: { contains: q } },
                  { code: { contains: q } },
                  { company: { contains: q } },
                  { taxId: { contains: q } },
                  { phone: { contains: q } },
                ],
              }
            : {}),
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.findMany({
        where: { orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getCustomFieldDefinitions(orgId, CustomFieldEntity.CONTACT),
      listContactLookups("INDUSTRY"),
      listContactLookups("JOB_TITLE"),
    ]);

  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("contacts.title")}
        description={t("contacts.description")}
        actions={
          <>
            <ExportButton entity="contacts" />
            <NewContactButton
              customers={customers}
              customFields={customFields}
              industries={industries}
              jobTitles={jobTitles}
            />
          </>
        }
      />

      <ListFilters
        searchPlaceholder={tx(
          "contacts.searchPlaceholder",
          "Search contacts...",
        )}
        filters={[
          {
            key: "status",
            label: t("contacts.status"),
            type: "select",
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t("contacts.empty")}
          description={t("contacts.emptyDescription")}
          action={
            <NewContactButton
              customers={customers}
              customFields={customFields}
              industries={industries}
              jobTitles={jobTitles}
            />
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">
                      {t("contacts.code")}
                    </TableHead>
                    <TableHead className="w-[90px]">
                      {t("contacts.status")}
                    </TableHead>
                    <TableHead>{t("contacts.fullName")}</TableHead>
                    <TableHead>{t("contacts.companyName")}</TableHead>
                    <TableHead>{t("contacts.customer")}</TableHead>
                    <TableHead>{t("common.phone")}</TableHead>
                    <TableHead>{t("common.email")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("contacts.jobTitle")}
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      {t("contacts.industry")}
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      {t("contacts.relationshipType")}
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">
                      {t("common.created")}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => {
                    const cv: ContactValue = {
                      id: contact.id,
                      code: contact.code,
                      name: contact.name,
                      jobTitle: contact.jobTitle,
                      email: contact.email,
                      phone: contact.phone,
                      company: contact.company,
                      taxId: contact.taxId,
                      industry: contact.industry,
                      status: contact.status,
                      relationshipType: contact.relationshipType,
                      notes: contact.notes,
                      customerId: contact.customerId,
                      createdAt: contact.createdAt.toISOString(),
                    };
                    return (
                      <TableRow key={contact.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {contact.code}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(contact.status)}>
                            {t(`contacts.statuses.${contact.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {contact.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.company || "---"}
                        </TableCell>
                        <TableCell>
                          {contact.customer ? (
                            <Link
                              href={`/customers/${contact.customer.id}`}
                              className="flex items-center gap-1.5 text-sm hover:underline"
                            >
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {contact.customer.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              ---
                            </span>
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
                            "---"
                          )}
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
                            "---"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {contact.jobTitle || "---"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {contact.industry || "---"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Badge variant="outline" className="text-[10px]">
                            {t(
                              `contacts.relationshipTypes.${contact.relationshipType}`,
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(contact.createdAt, locale)}
                        </TableCell>
                        <TableCell>
                          <EditContactButton
                            contact={cv}
                            customers={customers}
                            customFields={customFields}
                            industries={industries}
                            jobTitles={jobTitles}
                          />
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
