"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-config";
import type { Role } from "@/lib/enums";

export function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role?: Role;
}) {
  const router = useRouter();
  const t = useTranslations();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-4 backdrop-blur-sm pt-[15vh]">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <Command
        className={cn(
          "relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl",
        )}
        label="Global command menu"
      >
        <Command.Input
          autoFocus
          placeholder={t("common.search")}
          className="h-12 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
          <Command.Empty className="p-6 text-center text-sm text-muted-foreground">
            {t("common.empty")}
          </Command.Empty>
          {navGroups.map((group, gi) => {
            const items = group.items.filter((i) => !i.roles || !role || i.roles.includes(role));
            if (!items.length) return null;
            return (
              <Command.Group
                key={gi}
                heading={group.labelKey ? t(group.labelKey) : undefined}
                className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${t(item.labelKey)} ${item.href}`}
                    onSelect={() => {
                      onOpenChange(false);
                      router.push(item.href);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {t(item.labelKey)}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
