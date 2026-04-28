import { setRequestLocale, getTranslations } from "next-intl/server";
import { QuoteForm } from "./quote-form";

export default async function QuoteRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("portal.requestQuote")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us about your shipment and our dispatch team will get back to you.
      </p>
      <div className="mt-6">
        <QuoteForm />
      </div>
    </div>
  );
}
