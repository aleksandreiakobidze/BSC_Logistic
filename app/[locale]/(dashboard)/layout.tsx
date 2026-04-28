import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileBottomNav } from "@/components/app/mobile-nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (session.user.role === "DRIVER") redirect(`/${locale}/driver`);
  if (session.user.role === "CUSTOMER") redirect(`/${locale}/portal`);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
        />
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="container max-w-[1400px] py-6 lg:py-8">{children}</div>
        </main>
        <MobileBottomNav role={session.user.role} />
      </div>
    </div>
  );
}
