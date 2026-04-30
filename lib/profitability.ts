/**
 * Profitability helpers.
 *
 * Revenue source:
 *   - Order: Order.price (in Order.currency)
 *   - Customer / range: sum of Invoice.total within the range
 *   - Trip: sum of trip.shipments[].order.price (per-order revenue allocated by 1/orderShipmentsCount)
 *   - Vehicle / Driver / range: sum of trip.totalDistanceKm-driven revenue OR sum of order revenue from
 *     trips where the vehicle/driver was assigned (per-trip share by 1/orders).
 *
 * Cost sources:
 *   - Direct expense.orderId / .tripId / .shipmentId / .driverId / .vehicleId
 *   - For trip-level expenses, ExpenseAllocation rows contribute order-level cost.
 *
 * All amounts are returned as plain numbers (cast from Prisma Decimal).
 */
import { prisma } from "@/lib/db";

export interface PnL {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

function pnl(revenue: number, cost: number): PnL {
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { revenue, cost, margin, marginPct };
}

const num = (d: unknown): number => Number(d ?? 0);

export async function getOrderProfitability(orderId: string): Promise<PnL> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      price: true,
      expenses: { select: { amount: true } },
      expenseAllocations: { select: { amount: true } },
    },
  });
  if (!order) return pnl(0, 0);
  const revenue = num(order.price);
  const direct = order.expenses.reduce((a, e) => a + num(e.amount), 0);
  const allocated = order.expenseAllocations.reduce((a, e) => a + num(e.amount), 0);
  return pnl(revenue, direct + allocated);
}

export async function getTripProfitability(tripId: string): Promise<PnL> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      shipments: { select: { order: { select: { id: true, price: true } } } },
      expenses: { select: { amount: true } },
    },
  });
  if (!trip) return pnl(0, 0);
  // Revenue = sum of distinct orders' prices on this trip.
  const seen = new Set<string>();
  let revenue = 0;
  for (const s of trip.shipments) {
    if (!seen.has(s.order.id)) {
      seen.add(s.order.id);
      revenue += num(s.order.price);
    }
  }
  const cost = trip.expenses.reduce((a, e) => a + num(e.amount), 0);
  return pnl(revenue, cost);
}

export async function getCustomerProfitability(
  customerId: string,
  range?: { from?: Date; to?: Date },
): Promise<PnL> {
  const where = {
    customerId,
    ...(range?.from || range?.to
      ? {
          createdAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      price: true,
      expenses: { select: { amount: true } },
      expenseAllocations: { select: { amount: true } },
    },
  });
  let revenue = 0;
  let cost = 0;
  for (const o of orders) {
    revenue += num(o.price);
    cost += o.expenses.reduce((a, e) => a + num(e.amount), 0);
    cost += o.expenseAllocations.reduce((a, e) => a + num(e.amount), 0);
  }
  return pnl(revenue, cost);
}

export async function getVehicleProfitability(
  vehicleId: string,
  range?: { from?: Date; to?: Date },
): Promise<PnL> {
  const trips = await prisma.trip.findMany({
    where: {
      vehicleId,
      ...(range?.from || range?.to
        ? {
            createdAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    select: {
      shipments: { select: { order: { select: { id: true, price: true } } } },
      expenses: { select: { amount: true } },
    },
  });
  let revenue = 0;
  let cost = 0;
  for (const t of trips) {
    const seen = new Set<string>();
    for (const s of t.shipments) {
      if (!seen.has(s.order.id)) {
        seen.add(s.order.id);
        revenue += num(s.order.price);
      }
    }
    cost += t.expenses.reduce((a, e) => a + num(e.amount), 0);
  }
  // Add direct vehicle expenses
  const directExpenses = await prisma.expense.findMany({
    where: {
      vehicleId,
      tripId: null,
      ...(range?.from || range?.to
        ? {
            incurredAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    select: { amount: true },
  });
  cost += directExpenses.reduce((a, e) => a + num(e.amount), 0);
  return pnl(revenue, cost);
}

export async function getDriverProfitability(
  driverId: string,
  range?: { from?: Date; to?: Date },
): Promise<PnL> {
  const trips = await prisma.trip.findMany({
    where: {
      driverId,
      ...(range?.from || range?.to
        ? {
            createdAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    select: {
      shipments: { select: { order: { select: { id: true, price: true } } } },
      expenses: { select: { amount: true } },
    },
  });
  let revenue = 0;
  let cost = 0;
  for (const t of trips) {
    const seen = new Set<string>();
    for (const s of t.shipments) {
      if (!seen.has(s.order.id)) {
        seen.add(s.order.id);
        revenue += num(s.order.price);
      }
    }
    cost += t.expenses.reduce((a, e) => a + num(e.amount), 0);
  }
  const directExpenses = await prisma.expense.findMany({
    where: {
      driverId,
      tripId: null,
      ...(range?.from || range?.to
        ? {
            incurredAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    select: { amount: true },
  });
  cost += directExpenses.reduce((a, e) => a + num(e.amount), 0);
  return pnl(revenue, cost);
}
