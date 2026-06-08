"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ShipmentEventPayload } from "@/lib/shipment-events";

/**
 * Opens one EventSource per shipment id (capped at MAX_STREAMS to avoid
 * fanning out too many sockets) and triggers a single debounced
 * `router.refresh()` whenever any of them publishes an event. Used on the
 * customer portal landing page to keep the multi-shipment map in sync
 * with status changes / live truck pings.
 */

const REFRESH_DEBOUNCE_MS = 400;
const MAX_STREAMS = 25;

export function CustomerPortalLiveProvider({
  shipmentIds,
  children,
}: {
  shipmentIds: string[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Stable join key so the effect doesn't re-mount when React re-renders
  // with the same array contents but a new reference.
  const idsKey = React.useMemo(
    () => shipmentIds.slice(0, MAX_STREAMS).sort().join(","),
    [shipmentIds],
  );

  React.useEffect(() => {
    if (typeof window === "undefined" || !idsKey) return;

    const ids = idsKey.split(",").filter(Boolean);
    const sources: EventSource[] = [];

    const triggerRefresh = (_event: ShipmentEventPayload) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    for (const id of ids) {
      const es = new EventSource(`/api/shipments/${id}/stream`);
      es.onmessage = (msg) => {
        if (!msg.data) return;
        try {
          const parsed = JSON.parse(msg.data) as ShipmentEventPayload;
          triggerRefresh(parsed);
        } catch {
          // Ignore malformed payloads; stream auto-reconnects.
        }
      };
      es.onerror = () => {
        // Browser reconnects automatically.
      };
      sources.push(es);
    }

    return () => {
      for (const es of sources) es.close();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [idsKey, router]);

  return <>{children}</>;
}
