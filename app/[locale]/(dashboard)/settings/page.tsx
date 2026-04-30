import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, SlidersHorizontal } from "lucide-react";
import { InviteUserButton } from "./invite-user-button";
import { OrgForm } from "./org-form";
import { NewBranchButton } from "./new-branch-button";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const [org, branches, users, invitations] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.branch.findMany({ where: { orgId } }),
    prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitation.findMany({
      where: { orgId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Invoice Designer card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{t("invoiceDesigner.title")}</CardTitle>
              <CardDescription className="text-xs">{t("invoiceDesigner.description")}</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
              <Link href={`/${locale}/settings/invoice-designer`}>
                {t("invoiceDesigner.open")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
        </Card>

        {/* Custom Fields card */}
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <SlidersHorizontal className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{t("customFields.title")}</CardTitle>
              <CardDescription className="text-xs">{t("customFields.description")}</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
              <Link href={`/${locale}/settings/custom-fields`}>
                {t("customFields.open")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="org">
        <TabsList className="w-full max-w-xl">
          <TabsTrigger value="org">{t("settings.organization")}</TabsTrigger>
          <TabsTrigger value="branches">{t("settings.branches")}</TabsTrigger>
          <TabsTrigger value="users">{t("settings.users")}</TabsTrigger>
        </TabsList>

        <TabsContent value="org">
          <Card>
            <CardHeader><CardTitle>{t("settings.organization")}</CardTitle></CardHeader>
            <CardContent>
              {org && <OrgForm org={{ id: org.id, name: org.name, baseCurrency: org.baseCurrency, locale: org.locale }} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("settings.branches")}</CardTitle>
              <NewBranchButton />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("common.city")}</TableHead>
                    <TableHead>{t("common.country")}</TableHead>
                    <TableHead>{t("common.phone")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{b.city ?? "—"}</TableCell>
                      <TableCell>{b.country ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{b.phone ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("settings.users")}</CardTitle>
              <InviteUserButton />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("common.email")}</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="muted">Inactive</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-muted-foreground">(pending)</TableCell>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{i.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">Invited</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
