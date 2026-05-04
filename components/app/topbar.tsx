"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, LogOut, User, Bell, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileMenuButton } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { initials } from "@/lib/utils";
import type { Role } from "@/lib/enums";

export function Topbar({
  user,
  hasNotifications,
  breadcrumb,
}: {
  user: { name?: string | null; email?: string | null; role?: Role };
  hasNotifications?: boolean;
  breadcrumb?: { label: string; current?: string };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-app surface">
      <div className="flex h-full items-center gap-3 px-4 lg:px-5">
        <MobileMenuButton role={user.role} />

        {breadcrumb && (
          <div className="hidden items-center gap-1.5 text-[12px] md:flex">
            <span className="text-dim">{breadcrumb.label}</span>
            {breadcrumb.current && (
              <>
                <ChevronRight className="h-3 w-3 text-dim" />
                <span className="text-app">{breadcrumb.current}</span>
              </>
            )}
          </div>
        )}

        <div className="mx-auto hidden w-full max-w-md md:block">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="surface-2 flex w-full items-center gap-2 rounded-lg border border-app px-3 py-1.5 text-[12.5px] text-soft transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="truncate">{t("common.search")}</span>
            <kbd className="ml-auto rounded border border-soft px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>

        <Button
          variant="ghost"
          size="iconSm"
          className="md:hidden"
          aria-label="Search"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost relative h-9 w-9 justify-center !p-0"
            aria-label="Notifications"
          >
            <Bell className="h-[15px] w-[15px]" />
            {hasNotifications && (
              <span
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
                style={{ background: "hsl(var(--danger))" }}
              />
            )}
          </button>
          <LocaleSwitcher />
          <ThemeToggle />
          <div
            className="mx-1 h-6 w-px"
            style={{ background: "hsl(var(--border))" }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  background: "hsl(var(--primary) / 0.12)",
                  color: "hsl(var(--primary))",
                }}
              >
                {initials(user.name) || "?"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="h-4 w-4" /> {t("settings.profile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut({ redirect: false });
                  router.push("/login");
                }}
              >
                <LogOut className="h-4 w-4" /> {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user.role} />
    </header>
  );
}
