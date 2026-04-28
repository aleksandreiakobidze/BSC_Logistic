"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { navGroups, bottomNav } from "./nav-config";
import type { Role } from "@/lib/enums";

export function MobileBottomNav({ role }: { role?: Role }) {
  const pathname = usePathname();
  const t = useTranslations();
  const isActive = (href: string) => {
    if (!pathname) return false;
    const stripped = pathname.replace(/^\/(en|ka|ru)/, "") || "/";
    return stripped === href || stripped.startsWith(href + "/");
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {bottomNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export function MobileMenuButton({ role }: { role?: Role }) {
  const pathname = usePathname();
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (!pathname) return false;
    const stripped = pathname.replace(/^\/(en|ka|ru)/, "") || "/";
    return stripped === href || stripped.startsWith(href + "/");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="iconSm" className="lg:hidden" aria-label="Menu">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-16 flex-row items-center gap-2 border-b px-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-4 w-4" />
          </div>
          <SheetTitle>BSC Logistics</SheetTitle>
        </SheetHeader>
        <nav className="scrollbar-thin max-h-[calc(100dvh-4rem)] overflow-y-auto px-2 py-3">
          {navGroups.map((group, gi) => {
            const items = group.items.filter((i) => !i.roles || !role || i.roles.includes(role));
            if (!items.length) return null;
            return (
              <div key={gi} className="mb-4">
                {group.labelKey && (
                  <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t(group.labelKey)}
                  </div>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {t(item.labelKey)}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
