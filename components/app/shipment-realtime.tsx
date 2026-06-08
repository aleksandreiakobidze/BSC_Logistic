"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ShipmentEventPayload } from "@/lib/shipment-events";

/**
 * Mounts an `EventSource` against `/api/shipments/{id}/stream` and calls
 * `router.refresh()` (debounced) whenever the server publishes a new event.
 *
 * The customer portal shipment-detail page wraps its server-rendered
 * subtree with this provider so status badges, timeline rows, and
 * external-tracking checkpoints stay live without manual polling.
 */

const REFRESH_DEBOUNCE_MS = 250;

export function ShipmentRealtimeProvider({
  shipmentId,
  children,
}: {
  shipmentId: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const url = `/api/shipments/${shipmentId}/stream`;
    const es = new EventSource(url);

    const onEvent = (_event: ShipmentEventPayload) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    es.onmessage = (msg) => {
      if (!msg.data) return;
      try {
        const parsed = JSON.parse(msg.data) as ShipmentEventPayload;
        onEvent(parsed);
      } catch (err) {
        console.warn("Failed to parse shipment event", err);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing actionable to render here.
    };

    return () => {
      es.close();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [shipmentId, router]);

  return <>{children}</>;
}
