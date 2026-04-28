"use client";

import * as React from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Truck, Flag } from "lucide-react";
import { useTheme } from "next-themes";

type Marker = {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "live";
  label: string;
  shipmentNumber: string;
};

export function TrackingMap({ markers, mapboxToken }: { markers: Marker[]; mapboxToken: string }) {
  const { resolvedTheme } = useTheme();
  const style =
    resolvedTheme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

  const [selected, setSelected] = React.useState<Marker | null>(null);

  const center = React.useMemo(() => {
    if (!markers.length) return { longitude: 44.8271, latitude: 41.7151 };
    const avg = markers.reduce(
      (a, m) => ({ lng: a.lng + m.lng, lat: a.lat + m.lat }),
      { lng: 0, lat: 0 },
    );
    return { longitude: avg.lng / markers.length, latitude: avg.lat / markers.length };
  }, [markers]);

  if (!mapboxToken) {
    return (
      <div className="grid h-[60vh] place-items-center rounded-2xl border border-dashed p-8 text-center">
        <div>
          <div className="text-lg font-medium">Mapbox token missing</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your .env to enable live tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[70vh] overflow-hidden rounded-2xl border">
      <Map
        mapboxAccessToken={mapboxToken}
        initialViewState={{ ...center, zoom: 6 }}
        mapStyle={style}
        style={{ width: "100%", height: "100%" }}
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
              setSelected(m);
            }}
          >
            <PinIcon kind={m.kind} />
          </Marker>
        ))}
        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton={false}
            className="!p-0"
          >
            <div className="p-1 text-xs">
              <div className="font-semibold">{selected.shipmentNumber}</div>
              <div className="text-muted-foreground">{selected.label}</div>
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
      <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg">
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
