"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-config";
import type { Role } from "@/lib/enums";

export function Sidebar({ role, collapsed }: { role?: Role; collapsed?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations();

  const isActive = (href: string) => {
    if (!pathname) return false;
    const stripped = pathname.replace(/^\/(en|ka|ru)/, "") || "/";
    return stripped === href || stripped.startsWith(href + "/");
  };

  return (
    <aside
      className={cn(
        "relative hidden h-[100dvh] shrink-0 border-r bg-background transition-all lg:block",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Truck className="h-4 w-4" />
        </div>
        {!collapsed && <span className="truncate">BSC Logistics</span>}
      </div>

      <nav className="scrollbar-thin h-[calc(100dvh-4rem)] overflow-y-auto px-2 py-3">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((i) => !i.roles || !role || i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={gi} className="mb-4">
              {!collapsed && group.labelKey && (
                <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(group.labelKey)}
                </div>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
