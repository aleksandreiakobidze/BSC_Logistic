"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Send,
  User2,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { postQuotationMessage } from "@/app/[locale]/(dashboard)/quotations/actions";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorRole: "ADMIN" | "CUSTOMER" | "SYSTEM";
  authorName: string | null;
  lineId: string | null;
};

/**
 * Whole-quote chat panel rendered in the right sidebar of both the customer
 * portal and admin quotation pages. Posts go to `postQuotationMessage` with
 * `lineId === null`. The list scrolls newest-bottom; the composer is pinned
 * at the bottom of the card.
 */
export function QuotationChatPanel({
  quotationId,
  messages,
  viewerRole,
  locale,
  unreadCount = 0,
}: {
  quotationId: string;
  messages: ChatMessage[];
  viewerRole: "ADMIN" | "CUSTOMER";
  locale: string;
  unreadCount?: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  // Auto-scroll to newest on mount and after refresh.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function onSend() {
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error(
        tx(
          "quotations.portal.messageBodyRequired",
          "Type a message before sending.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await postQuotationMessage({ quotationId, body: trimmed });
      setBody("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tx("quotations.portal.chatPostError", "Failed to send message."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[520px] flex-col">
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            {tx("quotations.portal.chatTitle", "Conversation")}
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              {unreadCount}{" "}
              {tx("quotations.portal.chatUnread", "unread")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/10 p-2"
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {tx(
                "quotations.portal.chatEmpty",
                "No messages yet. Start the conversation below.",
              )}
            </p>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} message={m} viewerRole={viewerRole} locale={locale} />
            ))
          )}
        </div>
        <div className="flex shrink-0 items-end gap-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={tx(
              "quotations.portal.chatPlaceholder",
              "Write a message…",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void onSend();
              }
            }}
            className="min-h-[44px] flex-1 resize-none text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            disabled={busy || body.trim().length === 0}
            className="gap-1"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {tx("quotations.portal.chatSend", "Send")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({
  message,
  viewerRole,
  locale,
}: {
  message: ChatMessage;
  viewerRole: "ADMIN" | "CUSTOMER";
  locale: string;
}) {
  const isOwn = message.authorRole === viewerRole;
  const Icon =
    message.authorRole === "ADMIN"
      ? Building2
      : message.authorRole === "CUSTOMER"
        ? User2
        : MessageCircle;
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(message.createdAt));
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${
          isOwn
            ? "bg-primary/10 border-primary/30"
            : "bg-background border-border"
        }`}
      >
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="font-medium text-foreground">
            {message.authorName ?? message.authorRole}
          </span>
          <span>·</span>
          <span>{time}</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm">
          {message.body}
        </div>
      </div>
    </div>
  );
}
