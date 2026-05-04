"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Truck, MoreHorizontal, Settings as SettingsIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { navGroups } from "./nav-config";
import type { Role } from "@/lib/enums";

export type SidebarCounts = {
  shipments?: number;
  invoices?: number;
};

export function Sidebar({
  role,
  collapsed,
  counts,
  user,
}: {
  role?: Role;
  collapsed?: boolean;
  counts?: SidebarCounts;
  user?: { name?: string | null; email?: string | null; role?: Role; branch?: string | null };
}) {
  const pathname = usePathname();
  const t = useTranslations();

  const isActive = (href: string) => {
    if (!pathname) return false;
    const stripped = pathname.replace(/^\/(en|ka|ru)/, "") || "/";
    return stripped === href || stripped.startsWith(href + "/");
  };

  const badgeFor = (href: string): { value: number; tone: "primary" | "danger" } | null => {
    if (href === "/shipments" && counts?.shipments) {
      return { value: counts.shipments, tone: "primary" };
    }
    if (href === "/invoices" && counts?.invoices) {
      return { value: counts.invoices, tone: "danger" };
    }
    return null;
  };

  const settingsItem = navGroups
    .flatMap((g) => g.items)
    .find((i) => i.href === "/settings" && (!i.roles || !role || i.roles.includes(role)));

  return (
    <aside
      className={cn(
        "relative hidden h-[100dvh] shrink-0 flex-col border-r border-app surface lg:flex",
        collapsed ? "w-[72px]" : "w-[232px]",
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-app px-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-none">
              BSC Logistics
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-dim">
              bsclog.app
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        {navGroups.map((group, gi) => {
          const items = group.items.filter(
            (i) => i.href !== "/settings" && (!i.roles || !role || i.roles.includes(role)),
          );
          if (!items.length) return null;
          return (
            <div key={gi}>
              {!collapsed && group.labelKey && (
                <div className="nav-group-label">{t(group.labelKey)}</div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const badge = badgeFor(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={cn("nav-item", active && "active")}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate">{t(item.labelKey)}</span>
                          {badge && (
                            <span
                              className={cn(
                                "num pill ml-auto",
                                badge.tone === "danger" && "pill-danger",
                                badge.tone === "primary" && "pill-primary",
                              )}
                              style={{ padding: "1px 6px" }}
                            >
                              {badge.value}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: settings + account card */}
      <div className="border-t border-app p-2">
        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={cn("nav-item", isActive(settingsItem.href) && "active")}
            title={collapsed ? t(settingsItem.labelKey) : undefined}
          >
            <SettingsIcon className="h-[15px] w-[15px]" />
            {!collapsed && <span>{t(settingsItem.labelKey)}</span>}
          </Link>
        )}
        {!collapsed && user && (
          <div className="surface-2 mt-2 flex items-center gap-2 rounded-lg px-2 py-2">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold"
              style={{
                background: "hsl(var(--primary) / 0.12)",
                color: "hsl(var(--primary))",
              }}
            >
              {initials(user.name) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">
                {user.name ?? user.email ?? "User"}
              </div>
              <div className="truncate text-[10px] text-dim">
                {[user.role, user.branch].filter(Boolean).join(" · ") || "Member"}
              </div>
            </div>
            <button className="text-dim hover:text-app" aria-label="Account menu">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
