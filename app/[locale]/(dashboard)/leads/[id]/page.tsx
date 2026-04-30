import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  Package,
  UserCircle2,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/app/lead-status-badge";
import {
  LeadPriorityBadge,
  LeadScoreChip,
} from "@/components/app/lead-priority-badge";
import { EditLeadForm } from "./edit-lead-form";
import { ActivityTimeline } from "./activity-timeline";
import { QualificationWizard } from "./qualification-wizard";
import { LeadTasks } from "./lead-tasks";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CustomFieldsDisplay } from "@/components/app/custom-fields/custom-fields-display";
import { CustomFieldEntity } from "@/lib/custom-fields";
import {
  getCustomFieldDefinitions,
  getCustomFieldValues,
} from "../../settings/custom-fields/actions";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [lead, users, customFields, customFieldValues] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, orgId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        activities: {
          orderBy: { at: "desc" },
          include: { lead: false },
        },
        customer: { select: { id: true, name: true } },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
          },
        },
        tasks: { orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }] },
        orders: { select: { id: true, number: true, status: true, price: true } },
      },
    }),
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.LEAD),
    getCustomFieldValues(orgId, CustomFieldEntity.LEAD, id),
  ]);

  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link
              href="/leads"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {lead.name}
            <LeadStatusBadge status={lead.status} />
            <LeadPriorityBadge priority={lead.priority} />
            <LeadScoreChip score={lead.score} />
          </span>
        }
        description={lead.company ?? undefined}
        actions={
          <div className="flex gap-2">
            {lead.customer ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/customers/${lead.customer.id}`}>
                  <Building2 className="mr-2 h-4 w-4" />
                  {lead.customer.name}
                </Link>
              </Button>
            ) : (
              lead.status !== "LOST" && (
                <QualificationWizard
                  lead={{
                    id: lead.id,
                    name: lead.name,
                    email: lead.email ?? null,
                    phone: lead.phone ?? null,
                    company: lead.company ?? null,
                    notes: lead.notes ?? null,
                    estimatedValue: Number(lead.estimatedValue),
                    currency: lead.currency,
                    contact: lead.contact
                      ? {
                          id: lead.contact.id,
                          name: lead.contact.name,
                          email: lead.contact.email,
                          phone: lead.contact.phone,
                          company: lead.contact.company,
                        }
                      : null,
                    customer: null,
                  }}
                />
              )
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — quick info */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("leads.details")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lead.contact && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-2">
                  <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{lead.contact.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        lead.contact.email,
                        lead.contact.phone,
                        lead.contact.company,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${lead.email}`} className="hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${lead.phone}`} className="hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.nextFollowUp && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {formatDate(lead.nextFollowUp, locale)}
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("leads.estimatedValue")}
                </span>
                <span className="font-medium">
                  {formatCurrency(
                    Number(lead.estimatedValue),
                    lead.currency,
                    locale,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("leads.priority")}
                </span>
                <LeadPriorityBadge priority={lead.priority} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("leads.score")}
                </span>
                <LeadScoreChip score={lead.score} />
              </div>
              {lead.source && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("leads.source")}
                  </span>
                  <span>
                    {lead.source.charAt(0) + lead.source.slice(1).toLowerCase()}
                  </span>
                </div>
              )}
              {lead.assignedTo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("leads.assignedTo")}
                  </span>
                  <span>{lead.assignedTo.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("common.date")}
                </span>
                <span>{formatDate(lead.createdAt, locale)}</span>
              </div>
              {lead.convertedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("leads.convertedAt")}
                  </span>
                  <span>{formatDate(lead.convertedAt, locale)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("leads.tasks.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTasks leadId={lead.id} tasks={lead.tasks} users={users} />
            </CardContent>
          </Card>

          {lead.orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("orders.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{o.number}</span>
                      <span className="text-xs text-muted-foreground">
                        {o.status}
                      </span>
                    </span>
                    <span className="font-mono text-xs">
                      {formatCurrency(Number(o.price), lead.currency, locale)}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <CustomFieldsDisplay
            definitions={customFields}
            values={customFieldValues}
            currency={lead.currency}
          />
        </div>

        {/* Right — edit form + activity */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("leads.editLead")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditLeadForm
                lead={lead}
                users={users}
                customFields={customFields}
                customFieldValues={customFieldValues}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("leads.activity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                leadId={lead.id}
                activities={lead.activities}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
