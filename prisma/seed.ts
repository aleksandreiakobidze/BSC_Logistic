import { PrismaClient } from "@prisma/client";
import {
  Role,
  VehicleStatus,
  VehicleType,
  ShipmentStatus,
  OrderStatus,
  InvoiceStatus,
  DriverStatus,
  StopKind,
  MaintenanceKind,
  MovementKind,
  PaymentMethod,
  DocKind,
  EventType,
} from "../lib/enums";
import bcrypt from "bcryptjs";
import { generateTrackingCode } from "../lib/utils";

function seq(prefix: string, i: number) {
  const d = new Date();
  const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${yymm}-${String(1000 + i).padStart(4, "0")}`;
}

const prisma = new PrismaClient();

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

async function main() {
  console.log("Seeding database...");

  const existing = await prisma.organization.findUnique({ where: { slug: "bsc-demo" } });
  if (existing) {
    console.log("Already seeded. To reset run:  npx prisma migrate reset  (or delete prisma/dev.db then re-seed)");
    return;
  }

  // ---------------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------------
  const org = await prisma.organization.create({
    data: { name: "BSC Demo Logistics", slug: "bsc-demo", baseCurrency: "USD" },
  });

  // ---------------------------------------------------------------------------
  // Branches (10)
  // ---------------------------------------------------------------------------
  const branchSeed = [
    { name: "HQ Tbilisi", city: "Tbilisi", country: "GE", address: "12 Rustaveli Ave", phone: "+995 322 11 11 11" },
    { name: "Batumi Terminal", city: "Batumi", country: "GE", address: "9 Port Ave", phone: "+995 422 22 22 22" },
    { name: "Kutaisi Hub", city: "Kutaisi", country: "GE", address: "44 Industrial Rd", phone: "+995 431 33 33 33" },
    { name: "Poti Sea Port", city: "Poti", country: "GE", address: "Dock 3, Quay Rd", phone: "+995 493 44 44 44" },
    { name: "Rustavi DC", city: "Rustavi", country: "GE", address: "Metallurg St 7", phone: "+995 341 55 55 55" },
    { name: "Gori Warehouse", city: "Gori", country: "GE", address: "Stalin Ave 21", phone: "+995 370 66 66 66" },
    { name: "Zugdidi Depot", city: "Zugdidi", country: "GE", address: "Agmashenebeli St 8", phone: "+995 415 77 77 77" },
    { name: "Telavi Station", city: "Telavi", country: "GE", address: "Erekle II Sq 4", phone: "+995 350 88 88 88" },
    { name: "Akhaltsikhe Yard", city: "Akhaltsikhe", country: "GE", address: "Rabati Rd 12", phone: "+995 365 99 99 99" },
    { name: "Yerevan Office", city: "Yerevan", country: "AM", address: "Mashtots Ave 30", phone: "+374 10 12 34 56" },
  ];
  const branches = await Promise.all(
    branchSeed.map((b) => prisma.branch.create({ data: { orgId: org.id, ...b } })),
  );
  const hq = branches[0];

  // ---------------------------------------------------------------------------
  // Users (15 total: staff + drivers + customer portal users)
  // ---------------------------------------------------------------------------
  const adminPw = await bcrypt.hash("admin12345", 10);
  const staffPw = await bcrypt.hash("pass12345", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@bsc.local",
      name: "Admin User",
      passwordHash: adminPw,
      role: Role.ADMIN,
      orgId: org.id,
      branchId: hq.id,
      phone: "+995 599 00 00 01",
      emailVerified: new Date(),
    },
  });

  const dispatcherSeed = [
    { email: "dispatcher@bsc.local", name: "Nino Kiknadze", phone: "+995 599 00 00 02" },
    { email: "lasha.dispatch@bsc.local", name: "Lasha Iosava", phone: "+995 599 00 00 03" },
    { email: "tamari.dispatch@bsc.local", name: "Tamari Lomidze", phone: "+995 599 00 00 04" },
  ];
  const dispatchers = await Promise.all(
    dispatcherSeed.map((u, i) =>
      prisma.user.create({
        data: {
          ...u,
          passwordHash: staffPw,
          role: Role.DISPATCHER,
          orgId: org.id,
          branchId: branches[i % branches.length].id,
          emailVerified: new Date(),
        },
      }),
    ),
  );

  const accountantSeed = [
    { email: "accountant@bsc.local", name: "Ivan Beridze", phone: "+995 599 00 00 05" },
    { email: "maia.acct@bsc.local", name: "Maia Tsiklauri", phone: "+995 599 00 00 06" },
  ];
  const accountants = await Promise.all(
    accountantSeed.map((u) =>
      prisma.user.create({
        data: {
          ...u,
          passwordHash: staffPw,
          role: Role.ACCOUNTANT,
          orgId: org.id,
          branchId: hq.id,
          emailVerified: new Date(),
        },
      }),
    ),
  );

  // ---------------------------------------------------------------------------
  // Customers (12)
  // ---------------------------------------------------------------------------
  const customerSeed = [
    { name: "Acme Manufacturing", code: "ACME", email: "ops@acme.example", city: "Tbilisi", credit: 50000 },
    { name: "Caucasus Foods", code: "CCF", email: "logistics@cfoods.example", city: "Batumi", credit: 35000 },
    { name: "Kavkas Oil", code: "KVO", email: "shipping@kavkas.example", city: "Poti", credit: 80000 },
    { name: "Silk Road Traders", code: "SRT", email: "dispatch@silkroad.example", city: "Tbilisi", credit: 25000 },
    { name: "Tbilisi Retail Group", code: "TRG", email: "supply@trg.example", city: "Tbilisi", credit: 40000 },
    { name: "Black Sea Exports", code: "BSX", email: "ops@bse.example", city: "Poti", credit: 60000 },
    { name: "Kakheti Wines", code: "KWN", email: "ship@kwines.example", city: "Telavi", credit: 30000 },
    { name: "Mtskheta Ceramics", code: "MCR", email: "hello@ceramics.example", city: "Mtskheta", credit: 15000 },
    { name: "Yerevan Imports LLC", code: "YVN", email: "logistics@yvn.example", city: "Yerevan", credit: 45000 },
    { name: "Batumi Seafood", code: "BSF", email: "shipping@bseafood.example", city: "Batumi", credit: 20000 },
    { name: "Rustavi Steel", code: "RST", email: "dispatch@rsteel.example", city: "Rustavi", credit: 70000 },
    { name: "Georgian Pharma", code: "GPH", email: "supply@gpharma.example", city: "Tbilisi", credit: 35000 },
  ];
  const customers = await Promise.all(
    customerSeed.map((c, i) =>
      prisma.customer.create({
        data: {
          orgId: org.id,
          name: c.name,
          code: c.code,
          email: c.email,
          phone: `+995 555 ${10 + i} ${20 + i} ${30 + i}`,
          taxId: `GE${100000000 + i * 123}`,
          address: `${10 + i * 4} Main St`,
          city: c.city,
          country: c.city === "Yerevan" ? "AM" : "GE",
          creditLimit: c.credit,
          balance: Math.round(Math.random() * c.credit * 0.3),
          notes: i % 3 === 0 ? "Priority customer — VIP SLA" : null,
        },
      }),
    ),
  );

  // Contacts — 2 per customer (24 total)
  for (const c of customers) {
    await prisma.contact.createMany({
      data: [
        { orgId: org.id, customerId: c.id, name: "Ops Manager", position: "Operations", email: `ops-${c.code}@example.com`, phone: "+995 555 20 20 20" },
        { orgId: org.id, customerId: c.id, name: "Accounts Payable", position: "Finance", email: `ap-${c.code}@example.com`, phone: "+995 555 30 30 30" },
      ],
    });
  }

  // Portal users (3)
  const customerUsers = await Promise.all(
    [
      { email: "customer@bsc.local", name: "Acme Portal", customerId: customers[0].id },
      { email: "portal.ccf@bsc.local", name: "CCF Portal", customerId: customers[1].id },
      { email: "portal.kvo@bsc.local", name: "Kavkas Portal", customerId: customers[2].id },
    ].map((u) =>
      prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash: staffPw,
          role: Role.CUSTOMER,
          customerId: u.customerId,
          emailVerified: new Date(),
        },
      }),
    ),
  );

  // ---------------------------------------------------------------------------
  // Drivers (12) + driver-portal User accounts for first 10
  // ---------------------------------------------------------------------------
  const driverSeed = [
    { first: "Giorgi", last: "Beridze", license: "GE-DL-000001", pay: 0.35 },
    { first: "Sandro", last: "Chkheidze", license: "GE-DL-000002", pay: 0.32 },
    { first: "Nika", last: "Kapanadze", license: "GE-DL-000003", pay: 0.40 },
    { first: "Davit", last: "Gogoladze", license: "GE-DL-000004", pay: 0.30 },
    { first: "Levan", last: "Tskhadadze", license: "GE-DL-000005", pay: 0.38 },
    { first: "Irakli", last: "Mamulashvili", license: "GE-DL-000006", pay: 0.33 },
    { first: "Zurab", last: "Kvaratskhelia", license: "GE-DL-000007", pay: 0.42 },
    { first: "Mikheil", last: "Jibuti", license: "GE-DL-000008", pay: 0.31 },
    { first: "Beka", last: "Shonia", license: "GE-DL-000009", pay: 0.36 },
    { first: "Luka", last: "Nishnianidze", license: "GE-DL-000010", pay: 0.34 },
    { first: "Shota", last: "Papava", license: "GE-DL-000011", pay: 0.37 },
    { first: "Paata", last: "Dolidze", license: "GE-DL-000012", pay: 0.39 },
  ];

  const drivers: { id: string; orgId: string; firstName: string; lastName: string; userId: string | null }[] = [];
  for (let i = 0; i < driverSeed.length; i++) {
    const d = driverSeed[i];
    const email = i === 0 ? "driver@bsc.local" : `driver${i + 1}@bsc.local`;
    const driverUser = i < 10 ? await prisma.user.create({
      data: {
        email,
        name: `${d.first} ${d.last}`,
        passwordHash: staffPw,
        role: Role.DRIVER,
        orgId: org.id,
        phone: `+995 599 10 ${String(i).padStart(2, "0")} ${String(i * 3 + 10).padStart(2, "0")}`,
        emailVerified: new Date(),
      },
    }) : null;

    const status = i === 11 ? DriverStatus.OFF_DUTY : i === 10 ? DriverStatus.SUSPENDED : i < 4 ? DriverStatus.ON_DUTY : DriverStatus.AVAILABLE;

    const driver = await prisma.driver.create({
      data: {
        orgId: org.id,
        userId: driverUser?.id ?? null,
        firstName: d.first,
        lastName: d.last,
        email: driverUser?.email ?? `${d.first.toLowerCase()}.${d.last.toLowerCase()}@bsc.local`,
        phone: `+995 599 20 ${String(i).padStart(2, "0")} ${String(i * 3 + 20).padStart(2, "0")}`,
        licenseNo: d.license,
        licenseExpiry: daysFromNow(365 + i * 30),
        dateOfBirth: new Date(1978 + (i % 18), i % 12, (i % 27) + 1),
        address: `${10 + i * 3} Driver St, ${pick(branches, i).city}`,
        status,
        payRatePerKm: d.pay,
        payRateFlat: i % 3 === 0 ? 50 : 0,
        hireDate: daysAgo(180 + i * 20),
        notes: i === 0 ? "Senior driver, eligible for international routes" : null,
      },
    });
    drivers.push({ id: driver.id, orgId: driver.orgId, firstName: driver.firstName, lastName: driver.lastName, userId: driver.userId });
  }

  // ---------------------------------------------------------------------------
  // Vehicles (12) + Trailers (10)
  // ---------------------------------------------------------------------------
  const vehicleSeed = [
    { plate: "AA-001-BB", type: VehicleType.TRUCK, make: "Volvo", model: "FH16", kg: 20000, m3: 90 },
    { plate: "AA-002-BB", type: VehicleType.TRUCK, make: "Scania", model: "R500", kg: 18000, m3: 85 },
    { plate: "AA-003-BB", type: VehicleType.VAN, make: "Mercedes", model: "Sprinter", kg: 3500, m3: 18 },
    { plate: "AA-004-BB", type: VehicleType.REEFER, make: "MAN", model: "TGX Reefer", kg: 15000, m3: 80 },
    { plate: "AA-005-BB", type: VehicleType.TRUCK, make: "DAF", model: "XF 530", kg: 22000, m3: 95 },
    { plate: "AA-006-BB", type: VehicleType.VAN, make: "Ford", model: "Transit", kg: 3000, m3: 15 },
    { plate: "AA-007-BB", type: VehicleType.TRAILER, make: "Schmitz", model: "SKO 24", kg: 24000, m3: 90 },
    { plate: "AA-008-BB", type: VehicleType.TANKER, make: "Iveco", model: "Stralis", kg: 25000, m3: 40 },
    { plate: "AA-009-BB", type: VehicleType.TRUCK, make: "Renault", model: "T High", kg: 19000, m3: 88 },
    { plate: "AA-010-BB", type: VehicleType.VAN, make: "Peugeot", model: "Boxer", kg: 3200, m3: 17 },
    { plate: "AA-011-BB", type: VehicleType.REEFER, make: "Volvo", model: "FM Reefer", kg: 14000, m3: 78 },
    { plate: "AA-012-BB", type: VehicleType.CAR, make: "Toyota", model: "Hilux", kg: 1000, m3: 4 },
  ];
  const vehicles = await Promise.all(
    vehicleSeed.map((v, i) =>
      prisma.vehicle.create({
        data: {
          orgId: org.id,
          branchId: pick(branches, i).id,
          plate: v.plate,
          vin: `VIN${String(i + 1).padStart(3, "0")}${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          type: v.type,
          status: i === 3 || i === 10 ? VehicleStatus.MAINTENANCE : i === 11 ? VehicleStatus.INACTIVE : VehicleStatus.ACTIVE,
          make: v.make,
          model: v.model,
          year: 2020 + (i % 5),
          capacityKg: v.kg,
          capacityM3: v.m3,
          odometerKm: 60000 + i * 17500,
          fuelType: v.type === VehicleType.TANKER ? "Diesel (ADR)" : "Diesel",
          notes: i === 3 ? "In workshop for engine service" : null,
        },
      }),
    ),
  );

  const trailers = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.trailer.create({
        data: {
          orgId: org.id,
          plate: `TR-${String(1001 + i)}-GE`,
          type: pick(["Curtain-side", "Box", "Flatbed", "Reefer", "Tanker"], i),
          capacityKg: 20000 + (i % 4) * 2000,
        },
      }),
    ),
  );

  // ---------------------------------------------------------------------------
  // Maintenance (12)
  // ---------------------------------------------------------------------------
  const maintKinds = [
    MaintenanceKind.SCHEDULED,
    MaintenanceKind.REPAIR,
    MaintenanceKind.INSPECTION,
    MaintenanceKind.TIRES,
    MaintenanceKind.OIL,
    MaintenanceKind.OTHER,
  ];
  for (let i = 0; i < 12; i++) {
    await prisma.maintenance.create({
      data: {
        vehicleId: pick(vehicles, i).id,
        kind: pick(maintKinds, i),
        description: [
          "Engine oil & filter change",
          "Brake pads replacement",
          "Annual technical inspection",
          "Tire rotation + alignment",
          "Transmission fluid change",
          "Air filter replacement",
          "Suspension repair",
          "Battery replacement",
          "Coolant top-up",
          "Headlamp replacement",
          "Clutch repair",
          "Exhaust system check",
        ][i],
        cost: 150 + i * 75 + randInt(0, 200),
        odometerKm: 80000 + i * 12000,
        dueDate: i < 6 ? daysFromNow(7 + i * 10) : null,
        completedAt: i >= 6 ? daysAgo(i * 5) : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Fuel records (15)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < 15; i++) {
    const veh = pick(vehicles, i);
    const drv = pick(drivers, i);
    const liters = 180 + randInt(40, 260);
    await prisma.fuelRecord.create({
      data: {
        vehicleId: veh.id,
        driverId: drv.id,
        liters,
        cost: Math.round(liters * 1.25 * 100) / 100,
        odometerKm: 90000 + i * 8500,
        station: pick(["Rompetrol", "Socar", "Wissol", "Gulf", "Lukoil"], i),
        fueledAt: daysAgo(i * 2 + 1),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Warehouses (10) + Bins + StockItems + StockMovements
  // ---------------------------------------------------------------------------
  const warehouseSeed = [
    { name: "Tbilisi Central Warehouse", city: "Tbilisi", country: "GE" },
    { name: "Batumi Port Warehouse", city: "Batumi", country: "GE" },
    { name: "Kutaisi Distribution Center", city: "Kutaisi", country: "GE" },
    { name: "Poti Seafood Cold Store", city: "Poti", country: "GE" },
    { name: "Rustavi Industrial Hub", city: "Rustavi", country: "GE" },
    { name: "Gori Regional Depot", city: "Gori", country: "GE" },
    { name: "Telavi Wine Cellar", city: "Telavi", country: "GE" },
    { name: "Zugdidi Transit Shed", city: "Zugdidi", country: "GE" },
    { name: "Akhaltsikhe Bonded Store", city: "Akhaltsikhe", country: "GE" },
    { name: "Yerevan Cross-dock", city: "Yerevan", country: "AM" },
  ];
  const warehouses = await Promise.all(
    warehouseSeed.map((w) =>
      prisma.warehouse.create({
        data: { orgId: org.id, ...w, address: `${randInt(1, 99)} Warehouse Rd` },
      }),
    ),
  );

  for (const w of warehouses) {
    await prisma.bin.createMany({
      data: [
        { warehouseId: w.id, code: "A-01", description: "Aisle A, bay 1" },
        { warehouseId: w.id, code: "A-02" },
        { warehouseId: w.id, code: "B-01" },
      ],
    });
  }

  const itemSeed = [
    { sku: "SKU-1001", name: "Pallet Oak Planks", unit: "pallet", kg: 850 },
    { sku: "SKU-1002", name: "Electronics Carton", unit: "carton", kg: 18 },
    { sku: "SKU-1003", name: "Cold Chain Pharma Box", unit: "box", kg: 12 },
    { sku: "SKU-1004", name: "Wine Case 12x750ml", unit: "case", kg: 14 },
    { sku: "SKU-1005", name: "Automotive Spare Parts", unit: "crate", kg: 75 },
    { sku: "SKU-1006", name: "Textile Roll", unit: "roll", kg: 45 },
    { sku: "SKU-1007", name: "Dry Foods Sack", unit: "sack", kg: 25 },
    { sku: "SKU-1008", name: "Bottled Water Pack", unit: "pack", kg: 9 },
    { sku: "SKU-1009", name: "Ceramic Tile Box", unit: "box", kg: 30 },
    { sku: "SKU-1010", name: "Steel Rebar Bundle", unit: "bundle", kg: 500 },
    { sku: "SKU-1011", name: "Frozen Seafood Carton", unit: "carton", kg: 22 },
    { sku: "SKU-1012", name: "Packaging Materials Roll", unit: "roll", kg: 16 },
  ];
  const items = await Promise.all(
    itemSeed.map((it) =>
      prisma.stockItem.create({
        data: { orgId: org.id, sku: it.sku, name: it.name, unit: it.unit, weightKg: it.kg },
      }),
    ),
  );

  for (let i = 0; i < 20; i++) {
    const w = pick(warehouses, i);
    const it = pick(items, i);
    const kind = pick([MovementKind.INBOUND, MovementKind.INBOUND, MovementKind.OUTBOUND, MovementKind.ADJUSTMENT], i);
    await prisma.stockMovement.create({
      data: {
        warehouseId: w.id,
        itemId: it.id,
        kind,
        quantity: randInt(5, 120),
        reference: seq("MOV", i),
        at: daysAgo(i),
        notes: kind === MovementKind.ADJUSTMENT ? "Cycle count correction" : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Orders (16) + Shipments (16) + Stops + Events
  // ---------------------------------------------------------------------------
  const routePairs = [
    ["Tbilisi", "Batumi", 44.83, 41.72, 41.64, 41.62, 380],
    ["Tbilisi", "Kutaisi", 44.83, 41.72, 42.70, 42.27, 240],
    ["Tbilisi", "Poti", 44.83, 41.72, 41.67, 42.14, 310],
    ["Batumi", "Tbilisi", 41.64, 41.62, 44.83, 41.72, 380],
    ["Tbilisi", "Yerevan", 44.83, 41.72, 44.51, 40.18, 280],
    ["Rustavi", "Poti", 45.00, 41.55, 41.67, 42.14, 390],
    ["Tbilisi", "Gori", 44.83, 41.72, 44.11, 41.98, 85],
    ["Tbilisi", "Telavi", 44.83, 41.72, 45.47, 41.92, 160],
    ["Tbilisi", "Zugdidi", 44.83, 41.72, 41.87, 42.51, 330],
    ["Kutaisi", "Batumi", 42.70, 42.27, 41.64, 41.62, 145],
    ["Tbilisi", "Akhaltsikhe", 44.83, 41.72, 43.00, 41.64, 215],
    ["Poti", "Rustavi", 41.67, 42.14, 45.00, 41.55, 390],
    ["Tbilisi", "Mtskheta", 44.83, 41.72, 44.72, 41.85, 25],
    ["Yerevan", "Tbilisi", 44.51, 40.18, 44.83, 41.72, 280],
    ["Batumi", "Poti", 41.64, 41.62, 41.67, 42.14, 70],
    ["Tbilisi", "Kutaisi", 44.83, 41.72, 42.70, 42.27, 240],
  ];

  const shipmentStatuses: ShipmentStatus[] = [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.PLANNED,
    ShipmentStatus.PLANNED,
    ShipmentStatus.PLANNED,
    ShipmentStatus.FAILED,
    ShipmentStatus.CANCELLED,
  ];

  const createdOrders: { id: string; price: number; customerId: string; number: string; status: OrderStatus }[] = [];
  const createdShipments: { id: string; orgId: string; orderId: string; status: ShipmentStatus; driverId: string | null; vehicleId: string | null; cargoWeightKg: number | null; cargoVolumeM3: number | null; plannedDistanceKm: number | null }[] = [];

  for (let i = 0; i < 16; i++) {
    const customer = pick(customers, i);
    const status = shipmentStatuses[i];

    const orderStatus =
      status === ShipmentStatus.CANCELLED
        ? OrderStatus.CANCELLED
        : status === ShipmentStatus.DELIVERED
          ? OrderStatus.COMPLETED
          : status === ShipmentStatus.PLANNED
            ? OrderStatus.CONFIRMED
            : OrderStatus.IN_PROGRESS;

    const price = 800 + i * 275 + randInt(0, 300);

    const order = await prisma.order.create({
      data: {
        orgId: org.id,
        customerId: customer.id,
        number: seq("ORD", i),
        status: orderStatus,
        price,
        currency: "USD",
        reference: `PO-${2000 + i}`,
        requestedAt: daysAgo(randInt(1, 30)),
        notes: i % 5 === 0 ? "Fragile — handle with care" : null,
      },
    });
    createdOrders.push({ id: order.id, price, customerId: customer.id, number: order.number, status: orderStatus });

    const drv = status === ShipmentStatus.PLANNED ? null : pick(drivers, i);
    const veh = status === ShipmentStatus.PLANNED ? null : pick(vehicles, i);

    const route = routePairs[i];
    const [fromCity, toCity, fromLng, fromLat, toLng, toLat, km] = route;

    const shipment = await prisma.shipment.create({
      data: {
        orgId: org.id,
        number: seq("SHP", i),
        trackingCode: generateTrackingCode(),
        status,
        driverId: drv?.id ?? null,
        vehicleId: veh?.id ?? null,
        cargoType: pick(["General", "Reefer", "Hazmat", "Electronics", "Food"], i),
        cargoWeightKg: 500 + i * 325,
        cargoVolumeM3: 5 + (i % 10),
        temperature: i % 4 === 0 ? "-18°C to -22°C" : null,
        plannedDistanceKm: km as number,
        actualDistanceKm: status === ShipmentStatus.DELIVERED ? (km as number) + randInt(-15, 20) : null,
        plannedStart: daysAgo(randInt(1, 5)),
        plannedEnd: daysFromNow(randInt(0, 2)),
        startedAt:
          status === ShipmentStatus.DELIVERED ||
          status === ShipmentStatus.IN_TRANSIT ||
          status === ShipmentStatus.PICKED_UP ||
          status === ShipmentStatus.FAILED
            ? daysAgo(randInt(1, 3))
            : null,
        completedAt: status === ShipmentStatus.DELIVERED ? daysAgo(randInt(0, 1)) : status === ShipmentStatus.FAILED ? daysAgo(1) : null,
        notes: i % 6 === 0 ? "VIP customer — call 30 min before arrival" : null,
        orderLinks: { create: { orderId: order.id, sortOrder: 0 } },
      },
    });
    createdShipments.push({
      id: shipment.id,
      orgId: shipment.orgId,
      orderId: order.id,
      status,
      driverId: shipment.driverId,
      vehicleId: shipment.vehicleId,
      cargoWeightKg: shipment.cargoWeightKg,
      cargoVolumeM3: shipment.cargoVolumeM3,
      plannedDistanceKm: shipment.plannedDistanceKm,
    });

    await prisma.stop.createMany({
      data: [
        {
          shipmentId: shipment.id,
          sequence: 1,
          kind: StopKind.PICKUP,
          name: `${customer.name} warehouse`,
          address: `Pickup Dock ${1 + (i % 9)}`,
          city: fromCity as string,
          country: "GE",
          lat: fromLat as number,
          lng: fromLng as number,
          windowStart: daysAgo(1),
          windowEnd: daysFromNow(0),
          contact: "Warehouse Lead",
          phone: "+995 555 11 11 11",
        },
        {
          shipmentId: shipment.id,
          sequence: 2,
          kind: StopKind.DROPOFF,
          name: "Customer DC",
          address: `${10 + i} Delivery Rd`,
          city: toCity as string,
          country: toCity === "Yerevan" ? "AM" : "GE",
          lat: toLat as number,
          lng: toLng as number,
          windowStart: daysFromNow(0),
          windowEnd: daysFromNow(1),
          contact: "Receiving Clerk",
          phone: "+995 555 22 22 22",
        },
      ],
    });

    await prisma.shipmentEvent.create({
      data: { shipmentId: shipment.id, type: EventType.CREATED, note: "Shipment created" },
    });
    if (status !== ShipmentStatus.PLANNED) {
      await prisma.shipmentEvent.create({
        data: { shipmentId: shipment.id, type: EventType.ASSIGNED, note: `Assigned ${drv?.firstName ?? ""}` },
      });
    }
    if (
      status === ShipmentStatus.PICKED_UP ||
      status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.DELIVERED ||
      status === ShipmentStatus.FAILED
    ) {
      await prisma.shipmentEvent.create({
        data: { shipmentId: shipment.id, type: EventType.STATUS_CHANGE, note: "PICKED_UP", lat: fromLat as number, lng: fromLng as number },
      });
    }
    if (status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.DELIVERED) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          type: EventType.LOCATION,
          lat: ((fromLat as number) + (toLat as number)) / 2,
          lng: ((fromLng as number) + (toLng as number)) / 2,
          note: "Halfway check-in",
        },
      });
    }
    if (status === ShipmentStatus.DELIVERED) {
      await prisma.shipmentEvent.create({
        data: { shipmentId: shipment.id, type: EventType.STATUS_CHANGE, note: "DELIVERED", lat: toLat as number, lng: toLng as number },
      });
      await prisma.shipmentEvent.create({
        data: { shipmentId: shipment.id, type: EventType.POD_UPLOADED, note: "POD captured at drop-off" },
      });
    }
    if (status === ShipmentStatus.FAILED) {
      await prisma.shipmentEvent.create({
        data: { shipmentId: shipment.id, type: EventType.EXCEPTION, note: "Recipient refused delivery" },
      });
    }
  }

  // PODs for delivered shipments (10+)
  const deliveredShipments = createdShipments.filter((s) => s.status === ShipmentStatus.DELIVERED);
  for (let i = 0; i < Math.max(10, deliveredShipments.length); i++) {
    const s = pick(createdShipments.filter((x) => x.status === ShipmentStatus.DELIVERED || x.status === ShipmentStatus.IN_TRANSIT), i);
    await prisma.pOD.create({
      data: {
        shipmentId: s.id,
        fileKey: `pods/${s.id}/sample-${i}.jpg`,
        signedBy: pick(["Nino G.", "Giorgi M.", "Tamari K.", "Lasha P.", "Irma L."], i),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Invoices (12) + Lines + Payments (10)
  // ---------------------------------------------------------------------------
  const completedOrders = createdOrders.filter((o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.IN_PROGRESS);
  for (let i = 0; i < 12; i++) {
    const order = completedOrders[i % completedOrders.length];
    const subtotal = order.price;
    const taxRate = 18;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const status = i < 6
      ? InvoiceStatus.PAID
      : i < 8
        ? InvoiceStatus.SENT
        : i < 10
          ? InvoiceStatus.OVERDUE
          : i === 10
            ? InvoiceStatus.DRAFT
            : InvoiceStatus.CANCELLED;
    const inv = await prisma.invoice.create({
      data: {
        orgId: org.id,
        customerId: order.customerId,
        orderId: order.id,
        number: seq("INV", i),
        status,
        subtotal,
        taxRate,
        taxAmount,
        total,
        paid: status === InvoiceStatus.PAID ? total : status === InvoiceStatus.SENT && i === 7 ? total / 2 : 0,
        issueDate: daysAgo(30 + i * 5),
        dueDate: status === InvoiceStatus.OVERDUE ? daysAgo(5 + i) : daysFromNow(15 - i),
        currency: "USD",
        notes: i === 10 ? "Awaiting customer confirmation" : null,
      },
    });
    await prisma.invoiceLine.createMany({
      data: [
        {
          invoiceId: inv.id,
          description: `Transport services — ${order.number}`,
          quantity: 1,
          unitPrice: subtotal * 0.8,
          total: subtotal * 0.8,
        },
        {
          invoiceId: inv.id,
          description: "Fuel surcharge",
          quantity: 1,
          unitPrice: Math.round(subtotal * 0.2 * 100) / 100,
          total: Math.round(subtotal * 0.2 * 100) / 100,
        },
      ],
    });
    if (status === InvoiceStatus.PAID) {
      await prisma.payment.create({
        data: {
          orgId: org.id,
          kind: "RECEIVABLE",
          invoiceId: inv.id,
          customerId: inv.customerId,
          amount: total,
          currency: inv.currency,
          method: pick([PaymentMethod.BANK, PaymentMethod.CARD, PaymentMethod.CASH], i),
          reference: `PMT-${10000 + i}`,
          paidAt: daysAgo(randInt(1, 20)),
        },
      });
    }
    if (status === InvoiceStatus.SENT && i === 7) {
      await prisma.payment.create({
        data: {
          orgId: org.id,
          kind: "RECEIVABLE",
          invoiceId: inv.id,
          customerId: inv.customerId,
          amount: total / 2,
          currency: inv.currency,
          method: PaymentMethod.BANK,
          reference: `PMT-PART-${i}`,
          paidAt: daysAgo(5),
        },
      });
      // Mark this invoice as PARTIAL
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: "PARTIAL", paid: total / 2 },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Expenses (12)
  // ---------------------------------------------------------------------------
  const expenseSeed = [
    { cat: "Fuel", desc: "Diesel top-up", amount: 1800, vendor: "Rompetrol" },
    { cat: "Tolls", desc: "Monthly toll bill", amount: 320, vendor: "Georgia Roads" },
    { cat: "Maintenance", desc: "Spare parts — brakes", amount: 750, vendor: "AutoFix" },
    { cat: "Office", desc: "Stationery & printer ink", amount: 180, vendor: "OfficeMax" },
    { cat: "Insurance", desc: "Fleet quarterly premium", amount: 4200, vendor: "GSS Insurance" },
    { cat: "Legal", desc: "Customs broker fee", amount: 560, vendor: "TransLegal" },
    { cat: "Fuel", desc: "Reefer diesel top-up", amount: 940, vendor: "Socar" },
    { cat: "Software", desc: "Route optimisation SaaS", amount: 299, vendor: "RouteIQ" },
    { cat: "Meals", desc: "Driver per diems — February", amount: 1240, vendor: "Various" },
    { cat: "Maintenance", desc: "Tire replacement x6", amount: 2400, vendor: "Michelin GE" },
    { cat: "Utilities", desc: "Warehouse electricity", amount: 680, vendor: "Telasi" },
    { cat: "Training", desc: "Dangerous-goods course", amount: 950, vendor: "ADR Academy" },
  ];
  for (let i = 0; i < expenseSeed.length; i++) {
    const e = expenseSeed[i];
    await prisma.expense.create({
      data: {
        orgId: org.id,
        category: e.cat,
        description: e.desc,
        amount: e.amount,
        currency: "USD",
        vendor: e.vendor,
        incurredAt: daysAgo(i * 3 + 1),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Settlements (12)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < drivers.length; i++) {
    const driver = drivers[i];
    const totalKm = 1500 + i * 250;
    const gross = totalKm * (0.3 + (i % 5) * 0.02);
    const deductions = Math.round(gross * 0.08 * 100) / 100;
    const net = Math.round((gross - deductions) * 100) / 100;
    const paidAt = i < 8 ? daysAgo(10) : null;
    const settlement = await prisma.settlement.create({
      data: {
        orgId: org.id,
        driverId: driver.id,
        periodFrom: daysAgo(45),
        periodTo: daysAgo(15),
        totalKm,
        gross,
        deductions,
        net,
        currency: "USD",
        paidAt,
      },
    });
    if (paidAt) {
      await prisma.payment.create({
        data: {
          orgId: org.id,
          kind: "SETTLEMENT_PAYOUT",
          settlementId: settlement.id,
          driverId: driver.id,
          amount: net,
          currency: "USD",
          method: pick([PaymentMethod.BANK, PaymentMethod.CASH], i),
          reference: `PAYOUT-${1000 + i}`,
          paidAt,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Documents (12)
  // ---------------------------------------------------------------------------
  const docKinds = [DocKind.WAYBILL, DocKind.CMR, DocKind.BOL, DocKind.INVOICE, DocKind.INSURANCE, DocKind.TECH_INSPECTION, DocKind.LICENSE, DocKind.POD, DocKind.OTHER];
  for (let i = 0; i < 12; i++) {
    const kind = pick(docKinds, i);
    const shipment = pick(createdShipments, i);
    await prisma.document.create({
      data: {
        orgId: org.id,
        ownerType: "Shipment",
        ownerId: shipment.id,
        kind,
        name: `${kind.toString().toLowerCase()}-${i + 1}.pdf`,
        fileKey: `docs/${shipment.id}/${kind}-${i + 1}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: randInt(80000, 900000),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Notifications (12)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < 12; i++) {
    const channel = pick(["email", "sms", "push"], i);
    const status = i < 9 ? "sent" : i === 9 ? "queued" : "failed";
    await prisma.notification.create({
      data: {
        userId: i % 2 === 0 ? admin.id : dispatchers[i % dispatchers.length].id,
        email: channel === "email" ? "admin@bsc.local" : null,
        phone: channel === "sms" ? "+995 599 00 00 01" : null,
        channel,
        subject: channel === "email" ? `Shipment update #${i + 1}` : null,
        body: `Status update from BSC Logistics (${i + 1})`,
        status,
        sentAt: status === "sent" ? daysAgo(i) : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Invitations (10)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < 10; i++) {
    await prisma.invitation.create({
      data: {
        email: `newhire${i + 1}@bsc.local`,
        role: pick([Role.DISPATCHER, Role.DRIVER, Role.ACCOUNTANT], i),
        orgId: org.id,
        invitedById: admin.id,
        token: `inv-${i}-${Math.random().toString(36).slice(2, 14)}`,
        acceptedAt: i < 3 ? daysAgo(i + 1) : null,
        expiresAt: daysFromNow(7 + i),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Audit log (12)
  // ---------------------------------------------------------------------------
  const actions = [
    "org.create", "user.login", "user.create", "customer.create", "vehicle.create",
    "driver.create", "order.create", "shipment.create", "shipment.assign", "invoice.create",
    "invoice.pay", "expense.create",
  ];
  for (let i = 0; i < actions.length; i++) {
    await prisma.auditLog.create({
      data: {
        orgId: org.id,
        userId: i % 2 === 0 ? admin.id : dispatchers[0].id,
        action: actions[i],
        entity: actions[i].split(".")[0],
        entityId: `seed-${i}`,
        meta: JSON.stringify({ seed: true, index: i }),
        ip: "127.0.0.1",
        createdAt: daysAgo(i),
      },
    });
  }

  console.log(`
Seed complete.

Counts:
  Organizations: 1
  Branches:      ${branches.length}
  Users:         ${1 + dispatchers.length + accountants.length + drivers.filter((d) => d.userId).length + customerUsers.length}  (incl. portal + drivers)
  Customers:     ${customers.length}
  Drivers:       ${drivers.length}
  Vehicles:      ${vehicles.length}
  Trailers:      ${trailers.length}
  Warehouses:    ${warehouses.length}
  Stock items:   ${items.length}
  Orders:        ${createdOrders.length}
  Shipments:     ${createdShipments.length}

Login accounts:
  admin@bsc.local        / admin12345
  dispatcher@bsc.local   / pass12345      (also: lasha.dispatch, tamari.dispatch)
  accountant@bsc.local   / pass12345      (also: maia.acct)
  driver@bsc.local       / pass12345      (drivers 2-10: driverN@bsc.local)
  customer@bsc.local     / pass12345      (also: portal.ccf, portal.kvo)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
