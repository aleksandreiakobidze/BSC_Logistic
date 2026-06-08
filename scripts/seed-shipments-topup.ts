/**
 * One-shot demo top-up: ensures every existing customer in the demo org
 * has at least 5 shipments. Adds the missing ones; never deletes or
 * exceeds the cap. Safe to re-run.
 *
 *   npm run db:seed:topup
 *
 * Each new shipment gets an order, two stops with lat/lng (so the map
 * has markers), and (for IN_TRANSIT / PICKED_UP statuses) a mid-route
 * LOCATION ShipmentEvent so the live truck pin renders too.
 */
import { PrismaClient } from "@prisma/client";
import {
  OrderStatus,
  ShipmentStatus,
  StopKind,
  EventType,
} from "../lib/enums";
import { generateTrackingCode } from "../lib/utils";

const prisma = new PrismaClient();

const TARGET_PER_CUSTOMER = 5;
const ORG_SLUG = "bsc-demo";

// [fromCity, toCity, fromLng, fromLat, toLng, toLat, km]
const ROUTE_PAIRS: readonly [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
][] = [
  ["Tbilisi", "Batumi", 44.83, 41.72, 41.64, 41.62, 380],
  ["Tbilisi", "Kutaisi", 44.83, 41.72, 42.7, 42.27, 240],
  ["Tbilisi", "Poti", 44.83, 41.72, 41.67, 42.14, 310],
  ["Batumi", "Tbilisi", 41.64, 41.62, 44.83, 41.72, 380],
  ["Tbilisi", "Yerevan", 44.83, 41.72, 44.51, 40.18, 280],
  ["Kutaisi", "Tbilisi", 42.7, 42.27, 44.83, 41.72, 240],
  ["Tbilisi", "Rustavi", 44.83, 41.72, 45.0, 41.55, 30],
  ["Batumi", "Yerevan", 41.64, 41.62, 44.51, 40.18, 600],
];

// Bias toward IN_TRANSIT / PICKED_UP so the map shows live trucks.
const STATUS_MIX: readonly ShipmentStatus[] = [
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PLANNED,
];

const CARGO_TYPES = ["General", "Reefer", "Hazmat", "Electronics", "Food"];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function uniqueSeq(prefix: string) {
  const d = new Date();
  const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(100000 + Math.random() * 899999);
  return `${prefix}-${yymm}-${rand}`;
}

function orderStatusFor(s: ShipmentStatus): OrderStatus {
  switch (s) {
    case ShipmentStatus.PLANNED:
      return OrderStatus.CONFIRMED;
    case ShipmentStatus.CANCELLED:
      return OrderStatus.CANCELLED;
    case ShipmentStatus.DELIVERED:
      return OrderStatus.COMPLETED;
    default:
      return OrderStatus.IN_PROGRESS;
  }
}

async function main() {
  console.log(`Seed top-up: targeting ${TARGET_PER_CUSTOMER} shipments / customer in org "${ORG_SLUG}"`);

  const org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    include: {
      customers: { orderBy: { name: "asc" } },
      drivers: { take: 25 },
      vehicles: { take: 25 },
    },
  });

  if (!org) {
    console.error(`Org "${ORG_SLUG}" not found. Run \`npm run db:seed\` first.`);
    process.exit(1);
  }

  if (org.customers.length === 0) {
    console.error("Org has no customers. Nothing to do.");
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  let routeIdx = 0;
  let statusIdx = 0;

  for (const customer of org.customers) {
    const existing = await prisma.shipment.count({
      where: {
        orgId: org.id,
        orderLinks: { some: { order: { customerId: customer.id } } },
      },
    });

    if (existing >= TARGET_PER_CUSTOMER) {
      console.log(
        `  ${customer.name}: already has ${existing} shipments — skipping`,
      );
      skipped += 1;
      continue;
    }

    const need = TARGET_PER_CUSTOMER - existing;
    console.log(`  ${customer.name}: ${existing} -> ${TARGET_PER_CUSTOMER} (creating ${need})`);

    for (let n = 0; n < need; n++) {
      const status = pick(STATUS_MIX, statusIdx++);
      const route = pick(ROUTE_PAIRS, routeIdx++);
      const [fromCity, toCity, fromLng, fromLat, toLng, toLat, km] = route;
      const drv =
        status === ShipmentStatus.PLANNED || org.drivers.length === 0
          ? null
          : pick(org.drivers, statusIdx);
      const veh =
        status === ShipmentStatus.PLANNED || org.vehicles.length === 0
          ? null
          : pick(org.vehicles, statusIdx);

      const price = 800 + randInt(0, 4000);

      const order = await prisma.order.create({
        data: {
          orgId: org.id,
          customerId: customer.id,
          number: uniqueSeq("ORD"),
          status: orderStatusFor(status),
          price,
          currency: "USD",
          reference: `PO-DEMO-${randInt(1000, 9999)}`,
          requestedAt: daysAgo(randInt(1, 14)),
        },
      });

      const shipment = await prisma.shipment.create({
        data: {
          orgId: org.id,
          number: uniqueSeq("SHP"),
          trackingCode: generateTrackingCode(),
          status,
          driverId: drv?.id ?? null,
          vehicleId: veh?.id ?? null,
          cargoType: pick(CARGO_TYPES, statusIdx),
          cargoWeightKg: 500 + randInt(0, 4000),
          cargoVolumeM3: 5 + randInt(0, 25),
          plannedDistanceKm: km,
          plannedStart: daysAgo(randInt(0, 4)),
          plannedEnd: daysFromNow(randInt(0, 3)),
          startedAt:
            status === ShipmentStatus.PICKED_UP ||
            status === ShipmentStatus.IN_TRANSIT
              ? daysAgo(randInt(0, 2))
              : null,
          orderLinks: { create: { orderId: order.id, sortOrder: 0 } },
          stops: {
            create: [
              {
                sequence: 1,
                kind: StopKind.PICKUP,
                name: `${customer.name} warehouse`,
                address: `Pickup Dock ${randInt(1, 12)}`,
                city: fromCity,
                country: fromCity === "Yerevan" ? "AM" : "GE",
                lat: fromLat,
                lng: fromLng,
                windowStart: daysAgo(1),
                windowEnd: daysFromNow(0),
              },
              {
                sequence: 2,
                kind: StopKind.DROPOFF,
                name: "Customer DC",
                address: `${randInt(10, 90)} Delivery Rd`,
                city: toCity,
                country: toCity === "Yerevan" ? "AM" : "GE",
                lat: toLat,
                lng: toLng,
                windowStart: daysFromNow(0),
                windowEnd: daysFromNow(1),
              },
            ],
          },
        },
      });

      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.CREATED,
          note: "Shipment created (demo top-up)",
        },
      });

      if (status !== ShipmentStatus.PLANNED) {
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            type: EventType.ASSIGNED,
            note: drv ? `Assigned ${drv.firstName ?? ""}`.trim() : "Assigned",
          },
        });
      }

      if (
        status === ShipmentStatus.PICKED_UP ||
        status === ShipmentStatus.IN_TRANSIT
      ) {
        // Pick-up event at origin
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            type: EventType.STATUS_CHANGE,
            note: "PICKED_UP",
            lat: fromLat,
            lng: fromLng,
          },
        });
        // Mid-route LOCATION so the truck pin renders. We jitter the
        // midpoint by a tiny amount so trucks don't perfectly stack on
        // the same lat/lng for shipments sharing a route pair.
        const tFraction = 0.3 + Math.random() * 0.5;
        const jitter = (Math.random() - 0.5) * 0.06;
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            type: EventType.LOCATION,
            lat: fromLat + (toLat - fromLat) * tFraction + jitter,
            lng: fromLng + (toLng - fromLng) * tFraction + jitter,
            note: "Midway check-in",
          },
        });
      }

      created += 1;
    }
  }

  console.log(`\nTop-up complete: created ${created} shipments, skipped ${skipped} customers (already at cap).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
