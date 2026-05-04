import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { FileSignature } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { WrongAccountNotice } from "./wrong-account-notice";

export default async function PortalQuotationsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await auth();
  const portalPath = `/${locale}/portal/quotations`;

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(portalPath)}`);
  }

  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    const fullUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") + portalPath;
    return (
      <WrongAccountNotice
        url={fullUrl || portalPath}
        signedInAs={session.user.email ?? session.user.id}
        role={session.user.role}
        adminHref={`/${locale}/quotations`}
        texts={{
          title: t.has("quotations.portal.wrongAccountTitle")
            ? t("quotations.portal.wrongAccountTitle")
            : "This link is for a customer account",
          body: t.has("quotations.portal.wrongAccountBody")
            ? t("quotations.portal.wrongAccountBody")
            : "Open the link below in an incognito window and sign in with the customer's credentials. Your current dashboard session won't be affected.",
          urlLabel: t.has("quotations.portal.wrongAccountUrlLabel")
            ? t("quotations.portal.wrongAccountUrlLabel")
            : "Customer link",
          copy: t.has("quotations.portal.wrongAccountCopy")
            ? t("quotations.portal.wrongAccountCopy")
            : "Copy URL",
          copied: t.has("quotations.portal.wrongAccountCopied")
            ? t("quotations.portal.wrongAccountCopied")
            : "URL copied",
          adminLink: t.has("quotations.portal.wrongAccountAdminLink")
            ? t("quotations.portal.wrongAccountAdminLink")
            : "Open the admin view",
        }}
      />
    );
  }

  const quotations = await prisma.quotation.findMany({
    where: {
      customerId: session.user.customerId,
      status: { notIn: ["DRAFT"] },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      total: true,
      sentAt: true,
      validUntil: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t.has("quotations.portal.listTitle")
          ? t("quotations.portal.listTitle")
          : "Your quotations"}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            {t.has("quotations.portal.listSubtitle")
              ? t("quotations.portal.listSubtitle")
              : "Open offers awaiting your review"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quotations.length === 0 ? (
            <EmptyState
              title={
                t.has("quotations.portal.empty")
                  ? t("quotations.portal.empty")
                  : "No quotations yet"
              }
              description={
                t.has("quotations.portal.emptyDesc")
                  ? t("quotations.portal.emptyDesc")
                  : "When your supplier sends you a quotation, it will show up here."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("common.status") || "Status"}</TableHead>
                  <TableHead>{t("quotations.sentAt") || "Sent"}</TableHead>
                  <TableHead>{t("quotations.validUntil") || "Valid until"}</TableHead>
                  <TableHead className="text-right">
                    {t("quotations.total") || "Total"}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">{q.number}</TableCell>
                    <TableCell>
                      <StatusBadge
                        kind="quotation"
                        status={q.status}
                        label={
                          t.has(`quotations.status.${q.status}`)
                            ? t(`quotations.status.${q.status}`)
                            : q.status
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {q.sentAt ? formatDate(q.sentAt, locale) : "—"}
                    </TableCell>
                    <TableCell>
                      {q.validUntil ? formatDate(q.validUntil, locale) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(q.total), q.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/${locale}/portal/quotations/${q.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {t.has("quotations.portal.review")
                          ? t("quotations.portal.review")
                          : "Review"}
                        →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
