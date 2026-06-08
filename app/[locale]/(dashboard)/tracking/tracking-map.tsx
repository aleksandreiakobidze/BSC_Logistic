"use client";

import * as React from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Flag, MapPin, Package, Truck, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";

type Marker = {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "live";
  /**
   * Generic label used as a secondary line on the popup. For a pickup/dropoff
   * pin it usually carries the customer name; for a live (truck) pin it
   * usually carries the driver name. Kept for backward compatibility.
   */
  label: string;
  shipmentNumber: string;
  shipmentId?: string;
  status?: string;
  route?: string;
  driverName?: string;
  customerName?: string;
};

export function TrackingMap({
  markers,
  mapboxToken,
  className,
  initialZoom,
  detailHrefBase,
}: {
  markers: Marker[];
  mapboxToken: string;
  className?: string;
  initialZoom?: number;
  /**
   * Path prefix used to build the popup's "Open shipment" link, e.g.
   * `"/en/shipments"` or `"/en/portal/shipments"`. The shipment id is
   * appended at navigation time. Pass a string (not a function) so this
   * prop is serialisable across the server/client boundary.
   */
  detailHrefBase?: string;
}) {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations();
  const style =
    resolvedTheme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

  const [selected, setSelected] = React.useState<Marker | null>(null);
  // Used to debounce hover-out so a quick hop from marker to popup doesn't
  // close it immediately.
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const center = React.useMemo(() => {
    if (!markers.length) return { longitude: 44.8271, latitude: 41.7151 };
    const avg = markers.reduce(
      (a, m) => ({ lng: a.lng + m.lng, lat: a.lat + m.lat }),
      { lng: 0, lat: 0 },
    );
    return {
      longitude: avg.lng / markers.length,
      latitude: avg.lat / markers.length,
    };
  }, [markers]);

  function previewMarker(m: Marker) {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setSelected(m);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSelected(null), 250);
  }

  if (!mapboxToken) {
    return (
      <div className="grid h-[60vh] place-items-center rounded-2xl border border-dashed p-8 text-center">
        <div>
          <div className="text-lg font-medium">Mapbox token missing</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Set{" "}
            <code className="rounded bg-muted px-1">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            in your .env to enable live tracking.
          </p>
        </div>
      </div>
    );
  }

  const wrapperClass =
    className ?? "h-[70vh] overflow-hidden rounded-2xl border";

  const detailHref =
    selected && selected.shipmentId && detailHrefBase
      ? `${detailHrefBase.replace(/\/$/, "")}/${selected.shipmentId}`
      : null;

  return (
    <div className={wrapperClass}>
      <Map
        mapboxAccessToken={mapboxToken}
        initialViewState={{ ...center, zoom: initialZoom ?? 6 }}
        mapStyle={style}
        style={{ width: "100%", height: "100%" }}
        onClick={() => {
          // Click on empty map area dismisses the popup.
          setSelected(null);
        }}
      >
        <NavigationControl position="top-right" />
        {markers.map((m) => (
          <Marker
            key={m.id}
            longitude={m.lng}
            latitude={m.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              previewMarker(m);
            }}
          >
            <div
              onMouseEnter={() => previewMarker(m)}
              onMouseLeave={scheduleClose}
              className="cursor-pointer"
            >
              <PinIcon kind={m.kind} />
            </div>
          </Marker>
        ))}
        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton={false}
            offset={14}
            maxWidth="320px"
            className="!p-0 [&_.mapboxgl-popup-content]:!rounded-xl [&_.mapboxgl-popup-content]:!p-0 [&_.mapboxgl-popup-content]:!bg-popover [&_.mapboxgl-popup-content]:!text-popover-foreground [&_.mapboxgl-popup-content]:!shadow-lg [&_.mapboxgl-popup-content]:!ring-1 [&_.mapboxgl-popup-content]:!ring-border [&_.mapboxgl-popup-tip]:!border-t-popover"
          >
            <div
              onMouseEnter={() => previewMarker(selected)}
              onMouseLeave={scheduleClose}
              className="w-72 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-sm font-semibold">
                  {selected.shipmentNumber}
                </div>
                {selected.status && (
                  <StatusBadge kind="shipment" status={selected.status} />
                )}
              </div>

              {selected.route && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selected.route}</span>
                </div>
              )}

              {selected.customerName && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selected.customerName}</span>
                </div>
              )}

              {selected.driverName && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selected.driverName}</span>
                </div>
              )}

              {!selected.route &&
                !selected.customerName &&
                !selected.driverName &&
                selected.label && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {selected.label}
                  </div>
                )}

              {detailHref && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full gap-1.5"
                  onClick={() => router.push(detailHref)}
                >
                  {t("shipments.openShipment")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

function PinIcon({ kind }: { kind: Marker["kind"] }) {
  if (kind === "live")
    return (
      <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30">
        <Truck className="h-4 w-4" />
      </div>
    );
  if (kind === "pickup")
    return (
      <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-success text-white shadow-md">
        <MapPin className="h-3.5 w-3.5" />
      </div>
    );
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-warning text-white shadow-md">
      <Flag className="h-3.5 w-3.5" />
    </div>
  );
}
