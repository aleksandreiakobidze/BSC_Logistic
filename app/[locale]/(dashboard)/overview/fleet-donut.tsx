import * as React from "react";

type Slice = { label: string; count: number; color: string };

export function FleetDonut({
  total,
  slices,
}: {
  total: number;
  slices: Slice[];
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={r}
          stroke="hsl(var(--surface-2))"
          strokeWidth="10"
          fill="none"
        />
        {slices.map((s, i) => {
          if (total <= 0) return null;
          const len = (s.count / total) * c;
          const dash = `${len} ${c - len}`;
          const dashOff = -off;
          off += len;
          return (
            <circle
              key={i}
              cx="48"
              cy="48"
              r={r}
              stroke={s.color}
              strokeWidth="10"
              fill="none"
              strokeDasharray={dash}
              strokeDashoffset={dashOff}
              transform="rotate(-90 48 48)"
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="big-num text-[20px] leading-none">{total}</div>
          <div className="text-dim mt-0.5 text-[10px] uppercase tracking-wider">
            Vehicles
          </div>
        </div>
      </div>
    </div>
  );
}
