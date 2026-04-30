export const PRESETS = [
  "7d",
  "30d",
  "mtd",
  "qtd",
  "ytd",
  "all",
  "custom",
] as const;
export type RangePreset = (typeof PRESETS)[number];

export interface ResolvedRange {
  preset: RangePreset;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  /** Length in days, useful for picking bucket granularity. */
  spanDays: number;
  /** Bucket granularity to use for chart aggregations. */
  bucket: "day" | "week" | "month";
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Resolves URL search params into a concrete from/to window plus an
 * equal-length previous window for KPI deltas.
 */
export function resolveRange(sp: {
  range?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): ResolvedRange {
  const presetRaw = (sp.range ?? "30d") as string;
  const preset: RangePreset = (PRESETS as readonly string[]).includes(presetRaw)
    ? (presetRaw as RangePreset)
    : "30d";

  const now = new Date();
  let from: Date;
  let to: Date = endOfDay(now);

  switch (preset) {
    case "7d":
      from = startOfDay(addDays(now, -6));
      break;
    case "30d":
      from = startOfDay(addDays(now, -29));
      break;
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
      from = new Date(2000, 0, 1);
      break;
    case "custom": {
      from = sp.dateFrom
        ? startOfDay(new Date(sp.dateFrom))
        : startOfDay(addDays(now, -29));
      to = sp.dateTo ? endOfDay(new Date(sp.dateTo)) : endOfDay(now);
      break;
    }
  }

  const spanMs = Math.max(0, to.getTime() - from.getTime());
  const spanDays = Math.max(1, Math.round(spanMs / DAY_MS));

  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const bucket: "day" | "week" | "month" =
    spanDays <= 31 ? "day" : spanDays <= 120 ? "week" : "month";

  return { preset, from, to, prevFrom, prevTo, spanDays, bucket };
}

/** Builds an array of ISO bucket keys covering [from..to] for the given unit. */
export function bucketKeys(
  from: Date,
  to: Date,
  bucket: "day" | "week" | "month",
): string[] {
  const out: string[] = [];
  if (bucket === "month") {
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to) {
      out.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }
  if (bucket === "week") {
    const cur = startOfWeek(from);
    while (cur <= to) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    }
    return out;
  }
  // day
  const cur = startOfDay(from);
  while (cur <= to) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function bucketKeyOf(d: Date, bucket: "day" | "week" | "month"): string {
  if (bucket === "month") return d.toISOString().slice(0, 7);
  if (bucket === "week") return startOfWeek(d).toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Monday-based start of week. */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export function shortLabelFor(
  bucket: "day" | "week" | "month",
  key: string,
): string {
  if (bucket === "month") return key.slice(5);
  if (bucket === "week") return key.slice(5);
  return key.slice(5);
}
