"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["all", "received", "paidOut", "drivers"] as const;
type Tab = (typeof TABS)[number];

export function PaymentTabs({ current }: { current: Tab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={current} onValueChange={onChange}>
      <TabsList>
        {TABS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(`payments.tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
