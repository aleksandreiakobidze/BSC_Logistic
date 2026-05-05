import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Building2, Lock } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function PortalProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect(`/${locale}/overview`);
  }
  const t = await getTranslations();

  const customer = await prisma.customer.findUnique({
    where: { id: session.user.customerId },
    select: {
      name: true,
      code: true,
      email: true,
      phone: true,
      taxId: true,
      address: true,
      city: true,
      country: true,
    },
  });

  if (!customer) redirect(`/${locale}/portal/my`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("portal.profile.title")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("portal.profile.companyInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("common.name")}
              </div>
              <div className="mt-0.5 font-medium">{customer.name}</div>
            </div>
            {customer.code && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("portal.profile.customerCode")}
                </div>
                <div className="mt-0.5 font-mono">{customer.code}</div>
              </div>
            )}
            {customer.taxId && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("portal.profile.taxId")}
                </div>
                <div className="mt-0.5">{customer.taxId}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("portal.profile.contactInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              address: customer.address ?? "",
              city: customer.city ?? "",
              country: customer.country ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t("portal.profile.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
