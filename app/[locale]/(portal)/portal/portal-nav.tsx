"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  Truck,
  Receipt,
  FileSignature,
  BarChart3,
  UserCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { key: "dashboard", href: "/portal/my", icon: LayoutDashboard },
  { key: "orders", href: "/portal/orders", icon: Package },
  { key: "shipments", href: "/portal/shipments", icon: Truck },
  { key: "invoices", href: "/portal/invoices", icon: Receipt },
  { key: "quotations", href: "/portal/quotations", icon: FileSignature },
  { key: "reports", href: "/portal/reports", icon: BarChart3 },
] as const;

export function PortalNav({
  locale,
  userName,
}: {
  locale: string;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const t = useTranslations("portal");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    const full = `/${locale}${href}`;
    return pathname === full || pathname.startsWith(full + "/");
  };

  return (
    <>
      <nav className="border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-11 items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Desktop nav */}
          <div className="hidden items-center gap-0.5 md:flex">
            {navItems.map(({ key, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={key}
                  href={`/${locale}${href}`}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`nav.${key}`)}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User menu (desktop) */}
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href={`/${locale}/portal/profile`}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                isActive("/portal/profile")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UserCircle className="h-3.5 w-3.5" />
              {userName || t("nav.profile")}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("nav.signOut")}
            </button>
          </div>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-b bg-background p-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map(({ key, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={key}
                  href={`/${locale}${href}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(`nav.${key}`)}
                </Link>
              );
            })}
            <hr className="my-1" />
            <Link
              href={`/${locale}/portal/profile`}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <UserCircle className="h-4 w-4" />
              {t("nav.profile")}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
