import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { UserPlus, Calendar, Building2 } from "lucide-react";
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
import { LeadStatusBadge } from "@/components/app/lead-status-badge";
import { NewLeadButton } from "./new-lead-button";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale } = await params;
  const { status, q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { company: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { activities: true } },
    },
  });

  const statusCounts = await prisma.lead.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  );

  const PIPELINE_STATUSES = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
    "WON",
    "LOST",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("leads.title")}
        description={t("leads.description")}
        actions={<NewLeadButton />}
      />

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {PIPELINE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`?status=${s === status ? "" : s}`}
            className={`rounded-xl border p-3 text-center transition-colors hover:bg-accent ${
              status === s ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="text-xl font-bold">{countMap[s] ?? 0}</div>
            <div className="mt-1">
              <LeadStatusBadge status={s} />
            </div>
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t("leads.empty")}
          description={t("leads.emptyDescription")}
          action={<NewLeadButton />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("leads.company")}</TableHead>
                  <TableHead>{t("leads.status")}</TableHead>
                  <TableHead>{t("leads.source")}</TableHead>
                  <TableHead>{t("leads.assignedTo")}</TableHead>
                  <TableHead>{t("leads.nextFollowUp")}</TableHead>
                  <TableHead className="text-right">
                    {t("leads.estimatedValue")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {lead.name}
                      </Link>
                      {lead.email && (
                        <div className="text-xs text-muted-foreground">
                          {lead.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.company ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {lead.company}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.source
                        ? lead.source.charAt(0) +
                          lead.source.slice(1).toLowerCase()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.assignedTo?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.nextFollowUp ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(lead.nextFollowUp), "MMM d, yyyy")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(
                        Number(lead.estimatedValue),
                        lead.currency,
                        locale,
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
