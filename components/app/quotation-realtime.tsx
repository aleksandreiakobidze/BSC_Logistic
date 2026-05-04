"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { QuotationEvent, ViewerRole } from "@/lib/quotation-events";

/**
 * Single shared `EventSource` per quotation page. Both the chat panel and
 * any number of per-line threads `useQuotationRealtime` to attach handlers
 * without each opening its own connection (which would otherwise hit the
 * browser's per-origin limit and waste server memory).
 *
 * `stateChange` events are also turned into a debounced `router.refresh()`
 * call here so server-rendered sections (lines table, status badge, totals,
 * version history) re-pull from the server once when a burst of changes
 * arrives.
 */

export type QuotationRealtimeEventHandler = (event: QuotationEvent) => void;

type ContextValue = {
  quotationId: string;
  viewerRole: ViewerRole;
  subscribe: (handler: QuotationRealtimeEventHandler) => () => void;
};

const QuotationRealtimeContext = React.createContext<ContextValue | null>(null);

const STATE_REFRESH_DEBOUNCE_MS = 250;

export function QuotationRealtimeProvider({
  quotationId,
  viewerRole,
  children,
}: {
  quotationId: string;
  viewerRole: ViewerRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const handlersRef = React.useRef(new Set<QuotationRealtimeEventHandler>());
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const subscribe = React.useCallback(
    (handler: QuotationRealtimeEventHandler) => {
      handlersRef.current.add(handler);
      return () => {
        handlersRef.current.delete(handler);
      };
    },
    [],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const url = `/api/quotations/${quotationId}/stream`;
    const es = new EventSource(url);

    const dispatch = (event: QuotationEvent) => {
      for (const handler of handlersRef.current) {
        try {
          handler(event);
        } catch (err) {
          console.error("Quotation realtime handler error", err);
        }
      }

      if (event.type === "stateChange") {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          router.refresh();
        }, STATE_REFRESH_DEBOUNCE_MS);
      }
    };

    es.onmessage = (msg) => {
      if (!msg.data) return;
      try {
        const parsed = JSON.parse(msg.data) as QuotationEvent;
        dispatch(parsed);
      } catch (err) {
        console.warn("Failed to parse quotation event", err);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; just leave it alone.
      // If the server closes (auth changed, quote deleted) we'll see repeated
      // errors but there's nothing actionable to render.
    };

    return () => {
      es.close();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [quotationId, router]);

  const value = React.useMemo<ContextValue>(
    () => ({ quotationId, viewerRole, subscribe }),
    [quotationId, viewerRole, subscribe],
  );

  return (
    <QuotationRealtimeContext.Provider value={value}>
      {children}
    </QuotationRealtimeContext.Provider>
  );
}

/**
 * Subscribe to realtime events for the surrounding quotation. Safe to use
 * outside a provider — the returned `subscribe` becomes a no-op so SSR or
 * tests don't crash. `enabled = false` skips registration entirely.
 */
export function useQuotationRealtime(
  handler: QuotationRealtimeEventHandler,
  options: { enabled?: boolean } = {},
) {
  const ctx = React.useContext(QuotationRealtimeContext);
  const enabled = options.enabled ?? true;
  // Always-fresh handler ref so consumers don't have to memoize.
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (!ctx || !enabled) return;
    const wrapper: QuotationRealtimeEventHandler = (event) => {
      handlerRef.current(event);
    };
    return ctx.subscribe(wrapper);
  }, [ctx, enabled]);
}

export function useQuotationRealtimeContext() {
  return React.useContext(QuotationRealtimeContext);
}
