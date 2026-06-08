"use client";

import * as React from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface LocationValue {
  name: string;
  lat: number | null;
  lng: number | null;
}

interface LocationAutocompleteProps {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /**
   * "port" filters the Mapbox suggestion stream toward POIs (sea/air ports,
   * terminals) and place names, while "address" prefers street addresses,
   * cities, and districts. Both fall back gracefully when the requested
   * types yield no results.
   */
  kind: "port" | "address";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  place_type?: string[];
}

const TYPES_BY_KIND: Record<LocationAutocompleteProps["kind"], string> = {
  port: "poi,place,locality",
  address: "address,place,locality,neighborhood",
};

export function LocationAutocomplete({
  value,
  onChange,
  kind,
  placeholder,
  disabled,
  className,
  name,
}: LocationAutocompleteProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [draft, setDraft] = React.useState(value.name);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<MapboxFeature[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedRef = React.useRef<string>(value.name);

  React.useEffect(() => {
    setDraft(value.name);
    lastSelectedRef.current = value.name;
  }, [value.name]);

  React.useEffect(() => {
    if (!token) return;
    if (!open) return;
    const q = draft.trim();
    if (q.length < 2 || q === lastSelectedRef.current) {
      setItems([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${encodeURIComponent(token)}` +
          `&autocomplete=true&limit=6&types=${TYPES_BY_KIND[kind]}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Mapbox ${res.status}`);
        const json = (await res.json()) as { features?: MapboxFeature[] };
        if (!cancelled) {
          setItems(json.features ?? []);
          setActiveIndex(-1);
        }
      } catch (err) {
        console.error("[LocationAutocomplete] geocode failed", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, open, kind, token]);

  React.useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function commitFreeText(text: string) {
    const trimmed = text.trim();
    if (trimmed === value.name) return;
    lastSelectedRef.current = trimmed;
    onChange({ name: trimmed, lat: null, lng: null });
  }

  function selectFeature(feature: MapboxFeature) {
    const name = feature.place_name;
    setDraft(name);
    lastSelectedRef.current = name;
    setOpen(false);
    setItems([]);
    onChange({
      name,
      lat: feature.center[1],
      lng: feature.center[0],
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) {
      if (e.key === "Enter") {
        commitFreeText(draft);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const f = items[idx];
      if (f) selectFeature(f);
      else commitFreeText(draft);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // No-token fallback: behave as a plain input that just stores the typed text.
  if (!token) {
    return (
      <Input
        name={name}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commitFreeText(draft)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          name={name}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Allow click-on-suggestion (via mousedown) to fire before blur clears.
            window.setTimeout(() => {
              commitFreeText(draft);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md">
          {items.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent input blur from firing first.
                e.preventDefault();
              }}
              onClick={() => selectFeature(f)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium leading-tight">{f.text}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {f.place_name}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
