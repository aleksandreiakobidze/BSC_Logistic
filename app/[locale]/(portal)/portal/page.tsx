import { setRequestLocale, getTranslations } from "next-intl/server";
import { TrackForm } from "./track-form";
import { Package } from "lucide-react";

export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Package className="h-7 w-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("portal.trackTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your tracking number below to see where your shipment is right now.
      </p>
      <div className="mt-6">
        <TrackForm />
      </div>
    </div>
  );
}
