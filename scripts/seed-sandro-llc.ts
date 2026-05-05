import { PrismaClient } from "@prisma/client";
import {
  OrderStatus,
  ShipmentStatus,
  InvoiceStatus,
  StopKind,
  EventType,
  QuotationStatus,
} from "../lib/enums";
import { generateTrackingCode } from "../lib/utils";

const prisma = new PrismaClient();

function seq(prefix: string, i: number) {
  const d = new Date();
  const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yymm}-${String(rand).padStart(4, "0")}-${i}`;
}

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

const ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.QUOTE,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PROGRESS,
  OrderStatus.IN_PROGRESS,
  OrderStatus.IN_PROGRESS,
  OrderStatus.COMPLETED,
  OrderStatus.COMPLETED,
  OrderStatus.COMPLETED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.PLANNED,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
];

const ROUTES = [
  { from: "Tbilisi", fromLat: 41.7151, fromLng: 44.8271, to: "Batumi", toLat: 41.6168, toLng: 41.6367, country: "GE", km: 380 },
  { from: "Tbilisi", fromLat: 41.7151, fromLng: 44.8271, to: "Kutaisi", toLat: 42.2679, toLng: 42.7180, country: "GE", km: 230 },
  { from: "Tbilisi", fromLat: 41.7151, fromLng: 44.8271, to: "Yerevan", toLat: 40.1872, toLng: 44.5152, country: "AM", km: 280 },
  { from: "Batumi", fromLat: 41.6168, fromLng: 41.6367, to: "Tbilisi", toLat: 41.7151, toLng: 44.8271, country: "GE", km: 380 },
  { from: "Tbilisi", fromLat: 41.7151, fromLng: 44.8271, to: "Rustavi", toLat: 41.5491, toLng: 44.9939, country: "GE", km: 30 },
];

const CARGO_TYPES = ["General", "Reefer", "Hazmat", "Electronics", "Food", "Construction"];

const PRODUCTS = [
  { desc: "International freight forwarding service", unit: 1, price: 1500 },
  { desc: "Customs clearance handling", unit: 1, price: 350 },
  { desc: "Warehousing — 1 month, 100 m²", unit: 1, price: 800 },
  { desc: "Last-mile delivery — Tbilisi metro", unit: 5, price: 120 },
  { desc: "Cross-border transport — Tbilisi → Batumi", unit: 1, price: 1200 },
  { desc: "Refrigerated transport — temperature controlled", unit: 1, price: 1800 },
  { desc: "Express courier — same day", unit: 3, price: 90 },
  { desc: "Container drayage — port pickup", unit: 1, price: 650 },
];

async function main() {
  console.log("Looking for SANDRO LLC customer...");

  const customer = await prisma.customer.findFirst({
    where: { name: { contains: "SANDRO" } },
  });

  if (!customer) {
    console.error(
      "SANDRO LLC customer not found. Please create the customer first via the admin UI.",
    );
    process.exit(1);
  }

  console.log(`Found: ${customer.name} (id: ${customer.id}, orgId: ${customer.orgId})`);

  const orgId = customer.orgId;
  const customerId = customer.id;

  const drivers = await prisma.driver.findMany({
    where: { orgId },
    take: 10,
  });
  const vehicles = await prisma.vehicle.findMany({
    where: { orgId },
    take: 10,
  });

  if (drivers.length === 0 || vehicles.length === 0) {
    console.warn(
      "No drivers or vehicles found for this org — shipments will be created without driver/vehicle assignment.",
    );
  }

  // ---------------------------------------------------------------------------
  // 10 Orders + 10 Shipments (1 shipment per order)
  // ---------------------------------------------------------------------------
  console.log("Creating 10 orders + 10 shipments...");
  const createdOrders: { id: string; price: number; status: string }[] = [];

  for (let i = 0; i < 10; i++) {
    const orderStatus = ORDER_STATUSES[i];
    const shipmentStatus = SHIPMENT_STATUSES[i];
    const route = pick(ROUTES, i);
    const products = [
      pick(PRODUCTS, i),
      pick(PRODUCTS, i + 1),
    ];
    const subtotal = products.reduce((s, p) => s + p.unit * p.price, 0);
    const price = subtotal;

    const order = await prisma.order.create({
      data: {
        orgId,
        customerId,
        number: seq("ORD", i),
        status: orderStatus,
        price,
        currency: "USD",
        reference: `PO-SANDRO-${2000 + i}`,
        requestedAt: daysAgo(randInt(5, 40)),
        confirmedAt:
          orderStatus !== OrderStatus.QUOTE && orderStatus !== OrderStatus.CANCELLED
            ? daysAgo(randInt(1, 30))
            : null,
        notes: i % 3 === 0 ? "Priority customer — handle with care" : null,
        lines: {
          create: products.map((p, idx) => ({
            description: p.desc,
            quantity: p.unit,
            unitPrice: p.price,
            total: p.unit * p.price,
            sortOrder: idx,
          })),
        },
      },
    });
    createdOrders.push({ id: order.id, price, status: orderStatus });

    const drv = drivers.length && shipmentStatus !== ShipmentStatus.PLANNED ? pick(drivers, i) : null;
    const veh = vehicles.length && shipmentStatus !== ShipmentStatus.PLANNED ? pick(vehicles, i) : null;

    const shipment = await prisma.shipment.create({
      data: {
        orgId,
        number: seq("SHP", i),
        trackingCode: generateTrackingCode(),
        status: shipmentStatus,
        orderLinks: { create: { orderId: order.id, sortOrder: 0 } },
        driverId: drv?.id ?? null,
        vehicleId: veh?.id ?? null,
        cargoType: pick(CARGO_TYPES, i),
        cargoWeightKg: 500 + i * 325,
        cargoVolumeM3: 5 + (i % 10),
        temperature: i % 4 === 0 ? "-18°C to -22°C" : null,
        plannedDistanceKm: route.km,
        actualDistanceKm:
          shipmentStatus === ShipmentStatus.DELIVERED
            ? route.km + randInt(-15, 20)
            : null,
        plannedStart: daysAgo(randInt(1, 5)),
        plannedEnd: daysFromNow(randInt(0, 3)),
        startedAt:
          shipmentStatus === ShipmentStatus.DELIVERED ||
          shipmentStatus === ShipmentStatus.IN_TRANSIT ||
          shipmentStatus === ShipmentStatus.PICKED_UP
            ? daysAgo(randInt(1, 3))
            : null,
        completedAt:
          shipmentStatus === ShipmentStatus.DELIVERED ? daysAgo(randInt(0, 1)) : null,
        notes: i % 5 === 0 ? "Call recipient 30 min before arrival" : null,
        stops: {
          create: [
            {
              sequence: 1,
              kind: StopKind.PICKUP,
              name: `${customer.name} warehouse`,
              address: `Pickup Dock ${1 + (i % 9)}, ${route.from}`,
              city: route.from,
              country: "GE",
              lat: route.fromLat,
              lng: route.fromLng,
              windowStart: daysAgo(1),
              windowEnd: daysFromNow(0),
              contact: "Warehouse Lead",
              phone: "+995 555 11 11 11",
            },
            {
              sequence: 2,
              kind: StopKind.DROPOFF,
              name: "Customer DC",
              address: `${10 + i} Delivery Rd, ${route.to}`,
              city: route.to,
              country: route.country,
              lat: route.toLat,
              lng: route.toLng,
              windowStart: daysFromNow(0),
              windowEnd: daysFromNow(2),
              contact: "Receiving Clerk",
              phone: "+995 555 22 22 22",
            },
          ],
        },
      },
    });

    await prisma.shipmentEvent.create({
      data: { shipmentId: shipment.id, type: EventType.CREATED, note: "Shipment created" },
    });
    if (shipmentStatus !== ShipmentStatus.PLANNED) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.ASSIGNED,
          note: drv ? `Assigned ${drv.firstName}` : "Assigned",
        },
      });
    }
    if (
      shipmentStatus === ShipmentStatus.PICKED_UP ||
      shipmentStatus === ShipmentStatus.IN_TRANSIT ||
      shipmentStatus === ShipmentStatus.DELIVERED
    ) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.STATUS_CHANGE,
          note: "PICKED_UP",
          lat: route.fromLat,
          lng: route.fromLng,
        },
      });
    }
    if (
      shipmentStatus === ShipmentStatus.IN_TRANSIT ||
      shipmentStatus === ShipmentStatus.DELIVERED
    ) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.LOCATION,
          lat: (route.fromLat + route.toLat) / 2,
          lng: (route.fromLng + route.toLng) / 2,
          note: "In transit — halfway",
        },
      });
    }
    if (shipmentStatus === ShipmentStatus.DELIVERED) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.STATUS_CHANGE,
          note: "DELIVERED",
          lat: route.toLat,
          lng: route.toLng,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5 Invoices (linked to completed/in-progress orders)
  // ---------------------------------------------------------------------------
  console.log("Creating 5 invoices...");
  const billableOrders = createdOrders.filter(
    (o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.IN_PROGRESS,
  );
  const invoiceStatuses: InvoiceStatus[] = [
    InvoiceStatus.PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIAL,
    InvoiceStatus.OVERDUE,
  ];

  for (let i = 0; i < 5; i++) {
    const order = billableOrders[i % billableOrders.length];
    if (!order) break;
    const subtotal = order.price;
    const taxRate = 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const status = invoiceStatuses[i];
    const paid =
      status === InvoiceStatus.PAID
        ? total
        : status === InvoiceStatus.PARTIAL
          ? Math.round(total * 0.4 * 100) / 100
          : 0;

    await prisma.invoice.create({
      data: {
        orgId,
        customerId,
        orderId: order.id,
        number: seq("INV", i),
        status,
        subtotal,
        taxRate,
        taxAmount,
        total,
        paid,
        issueDate: daysAgo(20 + i * 5),
        dueDate:
          status === InvoiceStatus.OVERDUE
            ? daysAgo(5 + i)
            : daysFromNow(15 - i * 3),
        currency: "USD",
        notes:
          i === 0
            ? "Thanks for your business!"
            : i === 4
              ? "Payment overdue — please remit promptly"
              : null,
        lines: {
          create: [
            {
              description: pick(PRODUCTS, i).desc,
              quantity: 1,
              unitPrice: subtotal,
              total: subtotal,
            },
          ],
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 5 Quotations
  // ---------------------------------------------------------------------------
  console.log("Creating 5 quotations...");
  const quotationStatuses: QuotationStatus[] = [
    QuotationStatus.DRAFT,
    QuotationStatus.SENT,
    QuotationStatus.SENT,
    QuotationStatus.ACCEPTED,
    QuotationStatus.COUNTERED,
  ];

  for (let i = 0; i < 5; i++) {
    const status = quotationStatuses[i];
    const products = [
      pick(PRODUCTS, i),
      pick(PRODUCTS, i + 2),
      pick(PRODUCTS, i + 4),
    ];
    const subtotal = products.reduce((s, p) => s + p.unit * p.price, 0);
    const taxRate = 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    await prisma.quotation.create({
      data: {
        orgId,
        customerId,
        number: seq("QUO", i),
        status,
        currency: "USD",
        subtotal,
        taxRate,
        taxAmount,
        total,
        validUntil: daysFromNow(30),
        sentAt:
          status !== QuotationStatus.DRAFT ? daysAgo(randInt(2, 14)) : null,
        acceptedAt: status === QuotationStatus.ACCEPTED ? daysAgo(1) : null,
        notes: i === 0 ? "Initial quote — open for negotiation" : null,
        lines: {
          create: products.map((p, idx) => ({
            description: p.desc,
            quantity: p.unit,
            unitPrice: p.price,
            total: p.unit * p.price,
            sortOrder: idx,
          })),
        },
      },
    });
  }

  console.log("\n✅ Done!");
  console.log("  · 10 orders");
  console.log("  · 10 shipments (each with 2 stops + status events)");
  console.log("  · 5 invoices");
  console.log("  · 5 quotations");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
