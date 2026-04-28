import { setRequestLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDate } from "@/lib/utils";
import { NewDriverButton } from "./new-driver-button";

export default async function DriversPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireOrg();

  const drivers = await prisma.driver.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { shipments: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("drivers.title")} actions={<NewDriverButton />} />

      {drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No drivers yet"
          description="Add drivers to assign to shipments."
          action={<NewDriverButton />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("drivers.licenseNo")}</TableHead>
                  <TableHead>{t("drivers.licenseExpiry")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.firstName} {d.lastName}</div>
                      {d.email && <div className="text-xs text-muted-foreground">{d.email}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.licenseNo}</TableCell>
                    <TableCell>{d.licenseExpiry ? formatDate(d.licenseExpiry, locale) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.phone ?? "—"}</TableCell>
                    <TableCell>{d._count.shipments}</TableCell>
                    <TableCell>
                      <StatusBadge kind="driver" status={d.status} label={t(`drivers.status.${d.status}`)} />
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
