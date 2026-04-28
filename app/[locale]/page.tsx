import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import {
  Truck,
  Map,
  Route,
  Users,
  Package,
  FileText,
  BarChart3,
  Smartphone,
  Globe,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const features = [
    { icon: Truck, title: t("nav.fleet"), desc: "Vehicles, trailers, maintenance & fuel." },
    { icon: Users, title: t("nav.drivers"), desc: "Driver profiles, licenses, payroll." },
    { icon: Package, title: t("nav.shipments"), desc: "End-to-end shipment lifecycle." },
    { icon: Route, title: t("nav.dispatch"), desc: "Drag-and-drop dispatch board." },
    { icon: Map, title: t("nav.tracking"), desc: "Live Mapbox tracking & geofencing." },
    { icon: FileText, title: t("nav.invoices"), desc: "Invoices, PDFs & payments." },
    { icon: BarChart3, title: t("nav.reports"), desc: "KPIs, utilization & revenue." },
    { icon: Smartphone, title: t("nav.driver"), desc: "Mobile PWA with POD upload." },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 -z-10 gradient-mesh" aria-hidden />

      <header className="sticky top-0 z-20 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </div>
            {t("app.name")}
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <Link href={`/${locale}/portal`} className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav.portal")}
            </Link>
          </nav>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href={`/${locale}/login`}>
                {t("auth.login")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="mx-auto max-w-3xl py-20 text-center sm:py-28">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Multi-tenant · Multilingual · Mobile-first
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            {t("app.name")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            {t("app.tagline")} — manage fleets, dispatch, shipments, invoices and the customer
            experience from one modern platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={`/${locale}/login`}>
                {t("auth.login")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/portal`}>{t("nav.portal")}</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flat-card p-5 transition-all hover:-translate-y-0.5">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="font-medium">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} BSC Logistics</div>
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/portal`}>{t("nav.portal")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
