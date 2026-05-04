"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, ShieldAlert, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Notice rendered when an authenticated NON-customer (e.g. an admin) opens
 * a customer portal link — typically by clicking the "Review quotation"
 * button in the email while still signed into the dashboard.
 *
 * We deliberately do NOT sign the admin out: the recommended UX (per the
 * plan) is for them to open the link in an incognito window so they keep
 * their dashboard session intact. We surface the URL with a one-click copy
 * button to make that easy, plus a shortcut to the admin-side detail page
 * for the same quotation.
 */
export function WrongAccountNotice({
  url,
  signedInAs,
  role,
  adminHref,
  texts,
}: {
  url: string;
  signedInAs: string;
  role: string;
  adminHref?: string;
  texts: {
    title: string;
    body: string;
    urlLabel: string;
    copy: string;
    copied: string;
    adminLink: string;
  };
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(texts.copied);
    } catch {
      toast.error("Couldn't copy — copy the URL manually.");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <ShieldAlert className="h-5 w-5" />
            {texts.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{texts.body}</p>
          <div className="rounded-md border bg-background px-3 py-2 text-xs">
            <span className="text-muted-foreground">Signed in as: </span>
            <span className="font-mono">{signedInAs}</span>
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {role}
            </span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{texts.urlLabel}</label>
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">{texts.copy}</span>
              </Button>
            </div>
          </div>
          {adminHref && (
            <Button asChild variant="outline" className="w-full justify-center gap-2">
              <Link href={adminHref}>
                <ExternalLink className="h-4 w-4" />
                {texts.adminLink}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
