import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signUpTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.signUpSubtitle")}</p>
      </div>
      <RegisterForm />
      <p className="text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
