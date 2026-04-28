import Link from "next/link";
import { Truck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <aside className="relative hidden overflow-hidden border-r bg-muted/30 lg:block">
        <div className="absolute inset-0 gradient-mesh" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </div>
            BSC Logistics
          </Link>
          <div className="max-w-sm">
            <div className="text-2xl font-semibold tracking-tight">
              Smart logistics, simpler operations.
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Multi-tenant platform for fleets, dispatch, shipments, accounting and the full
              customer experience — all in one modern workspace.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
