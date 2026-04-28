import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signInTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href={`/${locale}/register`} className="font-medium text-primary hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
