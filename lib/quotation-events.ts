import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for live quotation updates. Server actions publish here
 * after committing their writes; the SSE route at
 * `/api/quotations/[id]/stream` subscribes per connected viewer and forwards
 * filtered events as `text/event-stream` payloads.
 *
 * Singleton lives on `globalThis` so HMR / Next.js dev reloads don't leak
 * subscribers or fragment the bus into multiple instances.
 *
 * If/when this app moves to multiple Node processes, replace the inner
 * `EventEmitter` with a Redis pub/sub client (or similar) so events fan out
 * across instances. Public API stays the same.
 */

export type ChatRole = "ADMIN" | "CUSTOMER" | "SYSTEM";
export type ViewerRole = "ADMIN" | "CUSTOMER";

export type QuotationMessageDTO = {
  id: string;
  quotationId: string;
  lineId: string | null;
  authorRole: ChatRole;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export type QuotationEvent =
  | {
      type: "message";
      message: QuotationMessageDTO;
      /** Roles that should receive this event. Used by the SSE route to filter. */
      recipientRoles: ViewerRole[];
    }
  | {
      type: "stateChange";
      reason:
        | "lineUpdated"
        | "lineAdded"
        | "lineRemoved"
        | "proposal"
        | "counter"
        | "sent"
        | "accepted"
        | "converted"
        | "rejected"
        | "cancelled"
        | "expired";
      recipientRoles: ViewerRole[];
    };

type Listener = (event: QuotationEvent) => void;

const GLOBAL_KEY = "__bsc_quotation_event_bus__" as const;

type Bus = {
  emitter: EventEmitter;
};

function getBus(): Bus {
  const g = globalThis as unknown as Record<string, unknown>;
  let bus = g[GLOBAL_KEY] as Bus | undefined;
  if (!bus) {
    const emitter = new EventEmitter();
    // Each open SSE connection adds one listener; cap is intentionally generous.
    emitter.setMaxListeners(0);
    bus = { emitter };
    g[GLOBAL_KEY] = bus;
  }
  return bus;
}

function channelFor(quotationId: string): string {
  return `q:${quotationId}`;
}

/** Publish an event to all subscribers listening on `quotationId`. */
export function publishQuotationEvent(
  quotationId: string,
  event: QuotationEvent,
): void {
  getBus().emitter.emit(channelFor(quotationId), event);
}

/**
 * Subscribe to events for a single quotation. Returns an unsubscribe function;
 * always call it when the connection closes to avoid leaking listeners.
 */
export function subscribeToQuotation(
  quotationId: string,
  handler: Listener,
): () => void {
  const channel = channelFor(quotationId);
  const emitter = getBus().emitter;
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}
