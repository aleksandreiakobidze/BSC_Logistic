"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { QuotationActivityKind } from "@/lib/enums";
import { addQuotationActivity } from "./actions";

export interface ActivityRow {
  id: string;
  kind: string;
  note: string | null;
  at: string;
  authorName: string | null;
}

interface InquiryActivityProps {
  quotationId: string;
  activities: ActivityRow[];
  locale: string;
  canPost: boolean;
}

export function InquiryActivity({
  quotationId,
  activities,
  locale,
  canPost,
}: InquiryActivityProps) {
  const t = useTranslations();
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    try {
      await addQuotationActivity({
        quotationId,
        kind: QuotationActivityKind.NOTE,
        note: note.trim(),
      });
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.activity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPost && (
          <form onSubmit={onSubmit} className="space-y-2">
            <Textarea
              placeholder={t("quotations.inquiry.activityPlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={loading || !note.trim()}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                )}
                {t("quotations.inquiry.newActivity")}
              </Button>
            </div>
          </form>
        )}

        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("quotations.inquiry.activityEmpty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {t(`quotations.inquiry.activityKinds.${a.kind}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {a.authorName ? `${a.authorName} · ` : ""}
                      {fmt.format(new Date(a.at))}
                    </span>
                  </div>
                  {a.note && (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
