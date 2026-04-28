import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Truck } from "lucide-react";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { DriverSignOutButton } from "./sign-out";
import { SwRegister } from "./sw-register";

export default async function DriverLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect(`/${locale}/overview`);

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm">Driver</span>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <DriverSignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-[env(safe-area-inset-bottom)]">{children}</main>
      <SwRegister />
    </div>
  );
}
