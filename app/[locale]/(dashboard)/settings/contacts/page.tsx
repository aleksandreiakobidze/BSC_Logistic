import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { listContactLookups } from "../../contacts/actions";
import { ContactLookupManager } from "./contact-lookup-manager";

export default async function SettingsContactsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  await requireOrg();

  const [industries, jobTitles] = await Promise.all([
    listContactLookups("INDUSTRY"),
    listContactLookups("JOB_TITLE"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.has("settings.contactLookups") ? t("settings.contactLookups") : "Contact Lookups"}
        description={t.has("settings.contactLookupsDesc") ? t("settings.contactLookupsDesc") : "Manage dropdown options for Industry and Job Title fields."}
      />
      <ContactLookupManager
        industries={industries}
        jobTitles={jobTitles}
      />
    </div>
  );
}
