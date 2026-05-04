"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  QuotationVersionsView,
  type QuotationVersion,
} from "@/components/app/quotation-versions-view";

/**
 * Header-mounted "History" affordance. Re-houses the existing
 * `QuotationVersionsView` inside a right-side `Sheet` so the version diff is
 * one click away without sitting in the main scroll. Renders nothing when the
 * quotation has no revisions yet, so callers don't have to gate it themselves.
 */
export function QuotationHistoryButton({
  versions,
  locale,
}: {
  versions: QuotationVersion[];
  locale: string;
}) {
  const t = useTranslations();
  const tx = (key: string, fb: string) => (t.has(key) ? t(key) : fb);

  if (versions.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          {tx("quotations.history.openButton", "View history")}
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {versions.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>
            {tx("quotations.history.title", "Version history")}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <QuotationVersionsView versions={versions} locale={locale} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
