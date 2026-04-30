import * as React from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  fill?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny dependency-free SVG sparkline. Pads to width × height; flat data
 * yields a centered horizontal line.
 */
export function Sparkline({
  data,
  color = "currentColor",
  fill,
  width = 120,
  height = 32,
  className,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden="true"
      />
    );
  }

  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const lineD = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const areaD = `${lineD} L${(pad + (data.length - 1) * stepX).toFixed(
    2,
  )},${(height - pad).toFixed(2)} L${pad.toFixed(2)},${(height - pad).toFixed(
    2,
  )} Z`;

  const last = points[points.length - 1];

  const fillStroke = fill ?? color;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={fillStroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkAreaGradient)" />
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  );
}
