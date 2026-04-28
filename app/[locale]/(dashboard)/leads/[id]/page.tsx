import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  PhoneCall,
  Video,
  Clock,
  GitBranch,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/app/lead-status-badge";
import { EditLeadForm } from "./edit-lead-form";
import { ActivityTimeline } from "./activity-timeline";
import { ConvertButton } from "./convert-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [lead, users] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, orgId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        activities: {
          orderBy: { at: "desc" },
          include: { lead: false },
        },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
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
                <ConvertButton leadId={lead.id} leadName={lead.name} />
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
              <EditLeadForm lead={lead} users={users} />
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
