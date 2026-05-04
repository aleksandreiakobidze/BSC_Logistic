"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Send,
  User2,
  Building2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { postQuotationMessage } from "@/app/[locale]/(dashboard)/quotations/actions";
import type { ChatMessage } from "@/components/app/quotation-chat-panel";
import { useQuotationRealtime } from "@/components/app/quotation-realtime";

/**
 * Per-line comment thread. Renders a small "Comment" toggle next to the line;
 * tapping it expands a compact thread + composer. Messages are kept in local
 * state and topped up by the surrounding `QuotationRealtimeProvider` so a
 * counterparty's reply appears without a manual refresh.
 *
 * Used inline by both the customer-portal editor and the admin lines editor,
 * so the same component handles both viewer roles.
 */
export function QuotationLineThread({
  quotationId,
  lineId,
  messages: initialMessages,
  viewerRole,
  locale,
  legacyCustomerNote,
}: {
  quotationId: string;
  lineId: string;
  messages: ChatMessage[];
  viewerRole: "ADMIN" | "CUSTOMER";
  locale: string;
  /**
   * Optional pre-existing customer note from the legacy `QuotationLine.customerNote`
   * column. Rendered as the first system-style entry so historical notes don't
   * disappear when migrating to the new thread.
   */
  legacyCustomerNote?: string | null;
}) {
  const t = useTranslations();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [open, setOpen] = React.useState(initialMessages.length > 0);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  // Keep in sync with the latest server snapshot, while preserving any
  // locally-appended (yet-to-be-rehydrated) messages.
  React.useEffect(() => {
    setMessages((prev) => {
      const seen = new Set(initialMessages.map((m) => m.id));
      const extras = prev.filter((m) => !seen.has(m.id));
      if (extras.length === 0) return initialMessages;
      return [...initialMessages, ...extras].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    });
    if (initialMessages.length > 0) {
      setOpen((prevOpen) => prevOpen || true);
    }
  }, [initialMessages]);

  useQuotationRealtime((event) => {
    if (event.type !== "message") return;
    if (event.message.quotationId !== quotationId) return;
    if (event.message.lineId !== lineId) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === event.message.id)) return prev;
      return [
        ...prev,
        {
          id: event.message.id,
          body: event.message.body,
          createdAt: event.message.createdAt,
          authorRole: event.message.authorRole,
          authorName: event.message.authorName,
          lineId: event.message.lineId,
        },
      ];
    });
    // Pop the thread open so the recipient actually notices the reply.
    if (event.message.authorRole !== viewerRole) {
      setOpen(true);
    }
  });

  async function onSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const result = await postQuotationMessage({
        quotationId,
        lineId,
        body: trimmed,
      });
      const sent = result.message;
      // Optimistic append; SSE echo will be deduped by id.
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [
          ...prev,
          {
            id: sent.id,
            body: sent.body,
            createdAt: sent.createdAt,
            authorRole: sent.authorRole,
            authorName: sent.authorName,
            lineId: sent.lineId,
          },
        ];
      });
      setBody("");
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

  const totalCount =
    messages.length + (legacyCustomerNote && legacyCustomerNote.trim() ? 1 : 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquare className="h-3 w-3" />
        {totalCount > 0 ? (
          <>
            {totalCount}{" "}
            {tx("quotations.portal.lineThreadCount", "comments")}
          </>
        ) : (
          tx("quotations.portal.lineThreadAdd", "Add a comment")
        )}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border bg-muted/20 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {tx("quotations.portal.lineThreadTitle", "Comments on this line")}
          {totalCount > 0 && (
            <span className="font-mono">({totalCount})</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label={tx("common.collapse", "Collapse")}
        >
          <ChevronDown className="h-3 w-3 rotate-180" />
        </button>
      </div>
      <div className="space-y-1.5">
        {legacyCustomerNote && legacyCustomerNote.trim() && (
          <ThreadItem
            authorRole="CUSTOMER"
            authorName={tx("quotations.portal.sourceCustomer", "Customer")}
            body={legacyCustomerNote}
            createdAt={null}
            viewerRole={viewerRole}
            locale={locale}
            italic
          />
        )}
        {messages.map((m) => (
          <ThreadItem
            key={m.id}
            authorRole={m.authorRole}
            authorName={m.authorName}
            body={m.body}
            createdAt={m.createdAt}
            viewerRole={viewerRole}
            locale={locale}
          />
        ))}
        {messages.length === 0 && !legacyCustomerNote && (
          <p className="text-[11px] text-muted-foreground">
            {tx(
              "quotations.portal.lineThreadEmpty",
              "No comments yet on this line.",
            )}
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={tx(
            "quotations.portal.lineThreadPlaceholder",
            "Reply on this line…",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={onSend}
          disabled={busy || body.trim().length === 0}
          className="h-8 gap-1 px-2"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ThreadItem({
  authorRole,
  authorName,
  body,
  createdAt,
  viewerRole,
  locale,
  italic,
}: {
  authorRole: "ADMIN" | "CUSTOMER" | "SYSTEM";
  authorName: string | null;
  body: string;
  createdAt: string | null;
  viewerRole: "ADMIN" | "CUSTOMER";
  locale: string;
  italic?: boolean;
}) {
  const isOwn = authorRole === viewerRole;
  const Icon =
    authorRole === "ADMIN"
      ? Building2
      : authorRole === "CUSTOMER"
        ? User2
        : MessageSquare;
  const time = createdAt
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      }).format(new Date(createdAt))
    : null;
  return (
    <div
      className={`flex gap-1.5 rounded-md border px-2 py-1 text-xs ${
        isOwn
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background"
      }`}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {authorName ?? authorRole}
          </span>
          {time && (
            <>
              <span>·</span>
              <span>{time}</span>
            </>
          )}
        </div>
        <div
          className={`whitespace-pre-wrap break-words ${italic ? "italic" : ""}`}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
