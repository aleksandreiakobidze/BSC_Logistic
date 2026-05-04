import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { parseTemplate } from "@/lib/invoice-template";
import { InvoiceDesigner } from "./invoice-designer";

export default async function InvoiceDesignerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireRole(["ADMIN"]);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      invoiceTemplate: true,
      name: true,
      logoUrl: true,
      baseCurrency: true,
    },
  });

  const template = parseTemplate(org?.invoiceTemplate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("invoiceDesigner.title")}
        description={t("invoiceDesigner.description")}
      />
      <InvoiceDesigner
        initialTemplate={template}
        orgName={org?.name ?? ""}
        initialLogoUrl={org?.logoUrl ?? null}
        baseCurrency={org?.baseCurrency ?? "USD"}
      />
    </div>
  );
}
