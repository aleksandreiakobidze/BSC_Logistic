/**
 * Trip-level expense allocation helpers.
 *
 * Trip expenses can be split across the orders that share the trip via
 * ExpenseAllocation rows. The split method determines weights:
 *   - MANUAL    -> caller provides explicit per-order amounts
 *   - WEIGHT    -> proportional to each order's total cargoWeightKg on the trip
 *   - VOLUME    -> proportional to cargoVolumeM3
 *   - DISTANCE  -> proportional to plannedDistanceKm of the trip's shipments
 *   - REVENUE   -> proportional to Order.price
 *   - EQUAL     -> equal split across orders
 */

export const ALLOCATION_METHODS = [
  "MANUAL",
  "WEIGHT",
  "VOLUME",
  "DISTANCE",
  "REVENUE",
  "EQUAL",
] as const;

export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

export interface OrderForAllocation {
  orderId: string;
  weightKg?: number | null;
  volumeM3?: number | null;
  distanceKm?: number | null;
  revenue?: number | null;
}

export interface ComputedAllocation {
  orderId: string;
  amount: number;
}

/**
 * Compute per-order allocation amounts. Total amount distributed equals
 * `totalAmount` (rounded to 2 decimals; rounding diff applied to last entry).
 */
export function computeAllocation(
  totalAmount: number,
  method: AllocationMethod,
  orders: OrderForAllocation[],
  manualMap?: Record<string, number>,
): ComputedAllocation[] {
  if (orders.length === 0) return [];

  if (method === "MANUAL") {
    return orders.map((o) => ({
      orderId: o.orderId,
      amount: round2(manualMap?.[o.orderId] ?? 0),
    }));
  }

  if (method === "EQUAL") {
    const share = totalAmount / orders.length;
    const rows = orders.map((o) => ({ orderId: o.orderId, amount: round2(share) }));
    return reconcile(totalAmount, rows);
  }

  // Weighted methods
  const weights = orders.map((o) => weightFor(o, method));
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    // fallback to equal when no signal
    return computeAllocation(totalAmount, "EQUAL", orders);
  }

  const rows = orders.map((o, i) => ({
    orderId: o.orderId,
    amount: round2((weights[i] / sum) * totalAmount),
  }));
  return reconcile(totalAmount, rows);
}

function weightFor(o: OrderForAllocation, method: AllocationMethod): number {
  switch (method) {
    case "WEIGHT":
      return Math.max(0, Number(o.weightKg ?? 0));
    case "VOLUME":
      return Math.max(0, Number(o.volumeM3 ?? 0));
    case "DISTANCE":
      return Math.max(0, Number(o.distanceKm ?? 0));
    case "REVENUE":
      return Math.max(0, Number(o.revenue ?? 0));
    default:
      return 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function reconcile(target: number, rows: ComputedAllocation[]): ComputedAllocation[] {
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const diff = round2(target - sum);
  if (Math.abs(diff) < 0.005 || rows.length === 0) return rows;
  // Apply rounding diff to last row.
  const last = rows[rows.length - 1];
  rows[rows.length - 1] = { ...last, amount: round2(last.amount + diff) };
  return rows;
}
