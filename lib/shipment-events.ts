import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";

/**
 * Pub/sub for live shipment updates. Server actions (and the AfterShip
 * webhook) publish here after committing their writes; the SSE route at
 * `/api/shipments/[id]/stream` subscribes per connected viewer and forwards
 * events as `text/event-stream` payloads.
 *
 * Mirror of `lib/quotation-events.ts` - falls back to a local EventEmitter
 * when REDIS_URL is unset.
 */

export type ShipmentEventPayload =
  | { type: "CREATED" }
  | { type: "ASSIGNED" }
  | { type: "STATUS_CHANGE"; status: string }
  | { type: "ORDER_ADDED" }
  | { type: "ORDER_REMOVED" }
  | { type: "LOCATION_UPDATE"; lat?: number; lng?: number }
  | { type: "EXTERNAL_TRACKING"; note?: string }
  | { type: "POD_UPLOADED" };

type Listener = (event: ShipmentEventPayload) => void;

const GLOBAL_KEY = "__bsc_shipment_event_bus__" as const;

type Bus = {
  emitter: EventEmitter;
  publisher: Redis | null;
  subscriber: Redis | null;
  subscribedChannels: Set<string>;
};

function channelFor(shipmentId: string): string {
  return `s:${shipmentId}`;
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis").default as typeof import("ioredis").default;
    const opts = {
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
      lazyConnect: false,
    };
    try {
      publisher = new IORedis(url, opts);
      subscriber = publisher.duplicate();
      subscriber.on("message", (channel, payload) => {
        try {
          const event = JSON.parse(payload) as ShipmentEventPayload;
          emitter.emit(channel, event);
        } catch (err) {
          console.error("[shipment-events] bad payload", err);
        }
      });
      subscriber.on("error", (err) => {
        console.error("[shipment-events] subscriber error", err);
      });
      publisher.on("error", (err) => {
        console.error("[shipment-events] publisher error", err);
      });
    } catch (err) {
      console.error(
        "[shipment-events] failed to init Redis pub/sub, falling back to in-process bus",
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

export function publishShipmentEvent(
  shipmentId: string,
  event: ShipmentEventPayload,
): void {
  const bus = getBus();
  const channel = channelFor(shipmentId);
  if (bus.publisher) {
    bus.publisher.publish(channel, JSON.stringify(event)).catch((err) => {
      console.error("[shipment-events] publish failed", err);
    });
  } else {
    bus.emitter.emit(channel, event);
  }
}

export function subscribeToShipment(
  shipmentId: string,
  handler: Listener,
): () => void {
  const channel = channelFor(shipmentId);
  const bus = getBus();
  const { emitter, subscriber, subscribedChannels } = bus;

  if (subscriber && !subscribedChannels.has(channel)) {
    subscribedChannels.add(channel);
    subscriber.subscribe(channel).catch((err) => {
      subscribedChannels.delete(channel);
      console.error("[shipment-events] subscribe failed", err);
    });
  }

  emitter.on(channel, handler);

  return () => {
    emitter.off(channel, handler);
    if (subscriber && emitter.listenerCount(channel) === 0) {
      subscribedChannels.delete(channel);
      subscriber.unsubscribe(channel).catch((err) => {
        console.error("[shipment-events] unsubscribe failed", err);
      });
    }
  };
}
