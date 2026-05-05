import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";

/**
 * Pub/sub for live quotation updates. Server actions publish here after
 * committing their writes; the SSE route at `/api/quotations/[id]/stream`
 * subscribes per connected viewer and forwards filtered events as
 * `text/event-stream` payloads.
 *
 * Transport selection at runtime:
 * - When `REDIS_URL` is set, events fan out across all replicas via Redis
 *   Pub/Sub (one shared publisher + one shared duplicated subscriber per
 *   process). Within a process, the subscriber re-emits onto a local
 *   EventEmitter so N concurrent SSE connections share a single Redis
 *   subscription per channel.
 * - When `REDIS_URL` is empty (typical dev), it falls back to a single
 *   in-process EventEmitter — no external dependency required.
 *
 * Singleton state lives on `globalThis` so HMR / Next.js dev reloads don't
 * leak listeners or fragment the bus into multiple instances.
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
  publisher: Redis | null;
  subscriber: Redis | null;
  /** Channels for which we've already issued a `SUBSCRIBE` to Redis. */
  subscribedChannels: Set<string>;
};

function channelFor(quotationId: string): string {
  return `q:${quotationId}`;
}

function getBus(): Bus {
  const g = globalThis as unknown as Record<string, unknown>;
  let bus = g[GLOBAL_KEY] as Bus | undefined;
  if (bus) return bus;

  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  let publisher: Redis | null = null;
  let subscriber: Redis | null = null;
  const subscribedChannels = new Set<string>();
  const url = process.env.REDIS_URL;

  if (url && url.trim().length > 0) {
    // Lazy require so dev environments without `ioredis` (or without
    // REDIS_URL) don't pay the import cost.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis").default as typeof import("ioredis").default;
    const opts = {
      // Don't crash the process on transient failures; SSE will degrade to
      // local-process-only fan-out until the connection comes back.
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
      lazyConnect: false,
    };
    try {
      publisher = new IORedis(url, opts);
      subscriber = publisher.duplicate();
      subscriber.on("message", (channel, payload) => {
        try {
          const event = JSON.parse(payload) as QuotationEvent;
          // Fan out to local listeners via the in-process emitter.
          emitter.emit(channel, event);
        } catch (err) {
          console.error("[quotation-events] bad payload", err);
        }
      });
      subscriber.on("error", (err) => {
        console.error("[quotation-events] subscriber error", err);
      });
      publisher.on("error", (err) => {
        console.error("[quotation-events] publisher error", err);
      });
    } catch (err) {
      console.error(
        "[quotation-events] failed to init Redis pub/sub, falling back to in-process bus",
        err,
      );
      publisher = null;
      subscriber = null;
    }
  }

  bus = { emitter, publisher, subscriber, subscribedChannels };
  g[GLOBAL_KEY] = bus;
  return bus;
}

/** Publish an event to all subscribers listening on `quotationId`. */
export function publishQuotationEvent(
  quotationId: string,
  event: QuotationEvent,
): void {
  const bus = getBus();
  const channel = channelFor(quotationId);
  if (bus.publisher) {
    // Cross-replica fan-out. Each replica's subscriber will receive the
    // payload and re-emit locally via `emitter`.
    bus.publisher.publish(channel, JSON.stringify(event)).catch((err) => {
      console.error("[quotation-events] publish failed", err);
    });
  } else {
    bus.emitter.emit(channel, event);
  }
}

/**
 * Subscribe to events for a single quotation. Returns an unsubscribe function;
 * always call it when the connection closes to avoid leaking listeners.
 *
 * Multiple subscribers in the same process share one underlying Redis
 * SUBSCRIBE. We only `UNSUBSCRIBE` from Redis when the last local listener
 * for a channel goes away.
 */
export function subscribeToQuotation(
  quotationId: string,
  handler: Listener,
): () => void {
  const channel = channelFor(quotationId);
  const bus = getBus();
  const { emitter, subscriber, subscribedChannels } = bus;

  if (subscriber && !subscribedChannels.has(channel)) {
    subscribedChannels.add(channel);
    subscriber.subscribe(channel).catch((err) => {
      subscribedChannels.delete(channel);
      console.error("[quotation-events] subscribe failed", err);
    });
  }

  emitter.on(channel, handler);

  return () => {
    emitter.off(channel, handler);
    if (subscriber && emitter.listenerCount(channel) === 0) {
      subscribedChannels.delete(channel);
      subscriber.unsubscribe(channel).catch((err) => {
        console.error("[quotation-events] unsubscribe failed", err);
      });
    }
  };
}
