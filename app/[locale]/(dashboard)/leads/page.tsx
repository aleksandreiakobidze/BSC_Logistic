import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { UserPlus, Calendar, Building2, AlertCircle } from "lucide-react";
import { Prisma } from "@prisma/client";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/empty-state";
import { LeadStatusBadge } from "@/components/app/lead-status-badge";
import {
  LeadPriorityBadge,
  LeadScoreChip,
} from "@/components/app/lead-priority-badge";
import { PipelineBoard } from "@/components/app/pipeline-board";
import { NewLeadButton } from "./new-lead-button";
import { ExportButton } from "@/components/app/export-button";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { LeadPriority } from "@/lib/enums";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "../settings/custom-fields/actions";

const PIPELINE_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const PRIORITY_OPTIONS = Object.values(LeadPriority);

const SORT_OPTIONS = [
  { value: "newest", label: "newest" },
  { value: "score-desc", label: "scoreDesc" },
  { value: "value-desc", label: "valueDesc" },
  { value: "follow-up", label: "followUp" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    q?: string;
    priority?: string;
    assignee?: string;
    dueWithin?: string;
    sort?: string;
    tab?: string;
  }>;
}) {
  const { locale } = await params;
  const { status, q, priority, assignee, dueWithin, sort, tab } =
    await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const now = new Date();
  const dueFilter: Prisma.LeadWhereInput | undefined = (() => {
    if (!dueWithin) return undefined;
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    if (dueWithin === "today") {
      return { nextFollowUp: { gte: startOfToday, lt: endOfToday } };
    }
    if (dueWithin === "week") {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 7);
      return { nextFollowUp: { gte: startOfToday, lt: end } };
    }
    if (dueWithin === "overdue") {
      return { nextFollowUp: { lt: startOfToday } };
    }
    return undefined;
  })();

  const where: Prisma.LeadWhereInput = {
    orgId,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assignee ? { assignedToId: assignee } : {}),
    ...(dueFilter ?? {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const sortValue = (sort as SortValue) ?? "newest";
  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sortValue === "score-desc"
      ? { score: "desc" }
      : sortValue === "value-desc"
        ? { estimatedValue: "desc" }
        : sortValue === "follow-up"
          ? { nextFollowUp: "asc" }
          : { createdAt: "desc" };

  const [leads, customFields, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { activities: true, tasks: true } },
      },
    }),
    getCustomFieldDefinitions(orgId, CustomFieldEntity.LEAD),
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const statusCounts = await prisma.lead.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  );

  const pipelineLeads = leads.map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company,
    email: l.email,
    status: l.status,
    estimatedValue: Number(l.estimatedValue),
    currency: l.currency,
    nextFollowUp: l.nextFollowUp,
    priority: l.priority,
    score: l.score,
    assignedTo: l.assignedTo
      ? { name: l.assignedTo.name }
      : null,
  }));

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (priority) filterParams.set("priority", priority);
  if (assignee) filterParams.set("assignee", assignee);
  if (dueWithin) filterParams.set("dueWithin", dueWithin);
  if (sort) filterParams.set("sort", sort);
  if (tab) filterParams.set("tab", tab);
  function withStatus(s: string | null) {
    const params = new URLSearchParams(filterParams);
    if (s) params.set("status", s);
    else params.delete("status");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("leads.title")}
        description={t("leads.description")}
        actions={
          <>
            <ExportButton entity="leads" />
            <NewLeadButton users={users} customFields={customFields} />
          </>
        }
      />

      <Tabs defaultValue={tab === "pipeline" ? "pipeline" : "list"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="list">{t("leads.pipeline.tabList")}</TabsTrigger>
            <TabsTrigger value="pipeline">
              {t("leads.pipeline.tabPipeline")}
            </TabsTrigger>
          </TabsList>
          <FilterBar
            t={t}
            users={users}
            priority={priority}
            assignee={assignee}
            dueWithin={dueWithin}
            sort={sort ?? "newest"}
          />
        </div>

        <TabsContent value="list" className="space-y-4">
          {/* Pipeline summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PIPELINE_STATUSES.map((s) => (
              <Link
                key={s}
                href={withStatus(s === status ? null : s)}
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
              action={
                <NewLeadButton users={users} customFields={customFields} />
              }
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
                      <TableHead>{t("leads.priority")}</TableHead>
                      <TableHead>{t("leads.score")}</TableHead>
                      <TableHead>{t("leads.source")}</TableHead>
                      <TableHead>{t("leads.assignedTo")}</TableHead>
                      <TableHead>{t("leads.nextFollowUp")}</TableHead>
                      <TableHead className="text-right">
                        {t("leads.estimatedValue")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const overdue =
                        lead.nextFollowUp && lead.nextFollowUp < now;
                      return (
                        <TableRow
                          key={lead.id}
                          className="cursor-pointer hover:bg-muted/50"
                        >
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
                          <TableCell>
                            <LeadPriorityBadge priority={lead.priority} />
                          </TableCell>
                          <TableCell>
                            <LeadScoreChip score={lead.score} />
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
                              <span
                                className={`flex items-center gap-1 ${
                                  overdue ? "text-destructive" : ""
                                }`}
                              >
                                {overdue ? (
                                  <AlertCircle className="h-3.5 w-3.5" />
                                ) : (
                                  <Calendar className="h-3.5 w-3.5" />
                                )}
                                {format(
                                  new Date(lead.nextFollowUp),
                                  "MMM d, yyyy",
                                )}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pipeline">
          {pipelineLeads.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={t("leads.empty")}
              description={t("leads.pipeline.empty")}
            />
          ) : (
            <Card>
              <CardContent className="p-3">
                <PipelineBoard leads={pipelineLeads} locale={locale} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterBar({
  t,
  users,
  priority,
  assignee,
  dueWithin,
  sort,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
  users: { id: string; name: string | null }[];
  priority?: string;
  assignee?: string;
  dueWithin?: string;
  sort: string;
}) {
  function paramLink(updates: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (priority) params.set("priority", priority);
    if (assignee) params.set("assignee", assignee);
    if (dueWithin) params.set("dueWithin", dueWithin);
    if (sort) params.set("sort", sort);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <FilterDropdown
        label={t("leads.priority")}
        active={priority}
        options={[
          { value: "", label: "—" },
          ...PRIORITY_OPTIONS.map((p) => ({
            value: p,
            label: t(`leads.priorities.${p}`),
          })),
        ]}
        toLink={(v) => paramLink({ priority: v || null })}
      />
      <FilterDropdown
        label={t("leads.assignedTo")}
        active={assignee}
        options={[
          { value: "", label: "—" },
          ...users.map((u) => ({ value: u.id, label: u.name ?? u.id })),
        ]}
        toLink={(v) => paramLink({ assignee: v || null })}
      />
      <FilterDropdown
        label={t("leads.tasks.due")}
        active={dueWithin}
        options={[
          { value: "", label: "—" },
          { value: "today", label: t("leads.dueWithin.today") },
          { value: "week", label: t("leads.dueWithin.week") },
          { value: "overdue", label: t("leads.dueWithin.overdue") },
        ]}
        toLink={(v) => paramLink({ dueWithin: v || null })}
      />
      <FilterDropdown
        label={t("leads.sort.label")}
        active={sort}
        options={SORT_OPTIONS.map((o) => ({
          value: o.value,
          label: t(`leads.sort.${o.label}`),
        }))}
        toLink={(v) => paramLink({ sort: v || null })}
      />
    </div>
  );
}

function FilterDropdown({
  label,
  active,
  options,
  toLink,
}: {
  label: string;
  active?: string;
  options: { value: string; label: string }[];
  toLink: (v: string) => string;
}) {
  const current = options.find((o) => o.value === (active ?? ""));
  return (
    <details className="group relative">
      <summary
        className={`flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 hover:bg-accent ${
          active ? "border-primary text-primary" : ""
        }`}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{current?.label ?? "—"}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-md border bg-popover p-1 shadow-md">
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={toLink(opt.value)}
            className={`block rounded px-2 py-1 hover:bg-accent ${
              opt.value === (active ?? "") ? "bg-accent/60 font-medium" : ""
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
