import Link from "next/link";
import { Truck } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { auth } from "@/lib/auth";
import { PortalNav } from "./portal/portal-nav";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const isCustomer =
    session?.user?.role === "CUSTOMER" && !!session.user.customerId;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href={isCustomer ? `/${locale}/portal/my` : `/${locale}`}
            className="flex items-center gap-2 font-semibold"
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </div>
            BSC Logistics
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {isCustomer && (
        <PortalNav locale={locale} userName={session.user.name} />
      )}

      <main className={isCustomer ? "container py-6" : "container py-10"}>
        {children}
      </main>
    </div>
  );
}
