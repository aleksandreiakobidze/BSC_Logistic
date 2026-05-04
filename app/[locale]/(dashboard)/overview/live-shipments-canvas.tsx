import * as React from "react";

export type ShipmentNode = {
  id: string;
  number: string;
  status: string;
};

/**
 * Stylised mini-map placeholder. We don't render an actual geographic map here —
 * just a set of route nodes whose count and color reflect real shipment status
 * counts coming from the database. Routes are drawn deterministically from each
 * shipment id so the picture is stable between renders.
 */
export function LiveShipmentsCanvas({
  shipments,
}: {
  shipments: ShipmentNode[];
}) {
  if (shipments.length === 0) {
    return (
      <div
        className="canvas-grid relative grid place-items-center"
        style={{ height: 260, background: "hsl(var(--surface-2))" }}
      >
        <div className="text-soft text-[12.5px]">
          No shipments in transit right now.
        </div>
      </div>
    );
  }

  const colorFor = (status: string) =>
    status === "DELIVERED"
      ? "hsl(var(--success))"
      : status === "IN_TRANSIT"
      ? "hsl(var(--primary))"
      : status === "PICKED_UP" || status === "ASSIGNED"
      ? "hsl(var(--warning))"
      : "hsl(var(--text-dim))";

  const labels = ["Tbilisi", "Batumi", "Baku", "Yerevan", "Trabzon", "Sochi", "Poti"];

  // Deterministic pseudo-random from id
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  const W = 600;
  const H = 260;
  const nodes = shipments.slice(0, 8).map((s, i) => {
    const h = hash(s.id);
    const x = 60 + ((h >> 0) % (W - 120));
    const y = 40 + ((h >> 8) % (H - 80));
    const labelEvery = i % 3 === 0 ? labels[i % labels.length] : null;
    return { ...s, x, y, color: colorFor(s.status), label: labelEvery };
  });

  // Pair nodes into routes
  const routes: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; color: string }> = [];
  for (let i = 0; i < nodes.length - 1; i += 2) {
    routes.push({ a: nodes[i], b: nodes[i + 1], color: nodes[i].color });
  }

  const counts = shipments.reduce(
    (acc, s) => {
      const key = s.status === "IN_TRANSIT" ? "transit" : s.status === "PICKED_UP" || s.status === "ASSIGNED" ? "pending" : s.status === "DELIVERED" ? "delivered" : "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div
      className="canvas-grid relative"
      style={{ height: H, background: "hsl(var(--surface-2))" }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {routes.map((r, i) => {
          const cx = (r.a.x + r.b.x) / 2;
          const cy = Math.min(r.a.y, r.b.y) - 30;
          return (
            <path
              key={i}
              d={`M ${r.a.x} ${r.a.y} Q ${cx} ${cy} ${r.b.x} ${r.b.y}`}
              stroke={r.color}
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="3 3"
              opacity="0.45"
            />
          );
        })}
        {nodes.map((n, i) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="8" fill={n.color} opacity="0.18" />
            <circle cx={n.x} cy={n.y} r="3.5" fill={n.color} />
            {n.label && (
              <text
                x={n.x + 8}
                y={n.y + 4}
                fontSize="10"
                fill="hsl(var(--text-muted))"
                className="font-mono"
              >
                {n.label}
              </text>
            )}
            {!n.label && i === 0 && (
              <text
                x={n.x + 8}
                y={n.y + 4}
                fontSize="10"
                fill="hsl(var(--text-muted))"
                className="font-mono"
              >
                {n.number}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {counts.transit ? (
          <span
            className="pill"
            style={{ background: "hsl(var(--background))" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--primary))" }}
            />
            In transit · {counts.transit}
          </span>
        ) : null}
        {counts.pending ? (
          <span
            className="pill"
            style={{ background: "hsl(var(--background))" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--warning))" }}
            />
            Pending · {counts.pending}
          </span>
        ) : null}
        {counts.delivered ? (
          <span
            className="pill"
            style={{ background: "hsl(var(--background))" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--success))" }}
            />
            Delivered · {counts.delivered}
          </span>
        ) : null}
      </div>
    </div>
  );
}
