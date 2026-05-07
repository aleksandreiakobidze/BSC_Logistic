import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildWorkbook, xlsxResponse, csvResponse, type SheetRow } from "@/lib/excel";

const ALLOWED = [
  "shipments",
  "orders",
  "invoices",
  "expenses",
  "drivers",
  "vehicles",
  "customers",
  "contacts",
  "leads",
  "payments",
  "settlements",
] as const;
type Entity = (typeof ALLOWED)[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const orgId = session.user.orgId;

  const { entity } = await params;
  if (!ALLOWED.includes(entity as Entity)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fmt = request.nextUrl.searchParams.get("fmt") ?? "xlsx";

  const rows = await fetchRows(entity as Entity, orgId);

  if (fmt === "csv") return csvResponse(rows, entity);
  const wb = buildWorkbook([{ name: entity, rows }]);
  return xlsxResponse(wb, entity);
}

async function fetchRows(entity: Entity, orgId: string): Promise<SheetRow[]> {
  switch (entity) {
    case "shipments": {
      const data = await prisma.shipment.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        include: {
          orderLinks: {
            orderBy: { sortOrder: "asc" },
            include: { order: { select: { number: true, customer: { select: { name: true } } } } },
          },
          driver: true,
          vehicle: true,
          stops: { orderBy: { sequence: "asc" } },
        },
      });
      return data.map((s) => ({
        Number: s.number,
        TrackingCode: s.trackingCode,
        Customer: Array.from(
          new Set(s.orderLinks.map((l) => l.order.customer.name)),
        ).join(", "),
        Orders: s.orderLinks.map((l) => l.order.number).join(", "),
        Status: s.status,
        Driver: s.driver
          ? `${s.driver.firstName} ${s.driver.lastName}`
          : "",
        Vehicle: s.vehicle?.plate ?? "",
        Pickup: s.stops[0]?.address ?? "",
        Dropoff: s.stops[s.stops.length - 1]?.address ?? "",
        CargoType: s.cargoType ?? "",
        CargoWeightKg: s.cargoWeightKg ?? "",
        PlannedDistanceKm: s.plannedDistanceKm ?? "",
        ActualDistanceKm: s.actualDistanceKm ?? "",
        PlannedStart: s.plannedStart?.toISOString().slice(0, 10) ?? "",
        PlannedEnd: s.plannedEnd?.toISOString().slice(0, 10) ?? "",
        StartedAt: s.startedAt?.toISOString().slice(0, 10) ?? "",
        CompletedAt: s.completedAt?.toISOString().slice(0, 10) ?? "",
        CreatedAt: s.createdAt.toISOString().slice(0, 10),
      }));
    }

    case "orders": {
      const data = await prisma.order.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          _count: { select: { shipmentLinks: true } },
        },
      });
      return data.map((o) => ({
        Number: o.number,
        Customer: o.customer.name,
        Status: o.status,
        Reference: o.reference ?? "",
        Shipments: o._count.shipmentLinks,
        Price: Number(o.price),
        Currency: o.currency,
        RequestedAt: o.requestedAt?.toISOString().slice(0, 10) ?? "",
        CreatedAt: o.createdAt.toISOString().slice(0, 10),
      }));
    }

    case "invoices": {
      const data = await prisma.invoice.findMany({
        where: { orgId },
        orderBy: { issueDate: "desc" },
        include: { customer: true },
      });
      return data.map((inv) => ({
        Number: inv.number,
        Customer: inv.customer.name,
        Status: inv.status,
        IssueDate: inv.issueDate.toISOString().slice(0, 10),
        DueDate: inv.dueDate.toISOString().slice(0, 10),
        Subtotal: Number(inv.subtotal),
        TaxRate: Number(inv.taxRate),
        TaxAmount: Number(inv.taxAmount),
        Total: Number(inv.total),
        Paid: Number(inv.paid),
        Balance: Number(inv.total) - Number(inv.paid),
        Currency: inv.currency,
      }));
    }

    case "expenses": {
      const data = await prisma.expense.findMany({
        where: { orgId },
        orderBy: { incurredAt: "desc" },
      });
      return data.map((e) => ({
        Date: e.incurredAt.toISOString().slice(0, 10),
        Category: e.category,
        Description: e.description,
        Vendor: e.vendor ?? "",
        Amount: Number(e.amount),
        Currency: e.currency,
      }));
    }

    case "drivers": {
      const data = await prisma.driver.findMany({
        where: { orgId },
        orderBy: { lastName: "asc" },
        include: { _count: { select: { shipments: true } } },
      });
      return data.map((d) => ({
        FirstName: d.firstName,
        LastName: d.lastName,
        Email: d.email ?? "",
        Phone: d.phone ?? "",
        LicenseNo: d.licenseNo,
        LicenseExpiry: d.licenseExpiry?.toISOString().slice(0, 10) ?? "",
        Status: d.status,
        Shipments: d._count.shipments,
        PayRatePerKm: Number(d.payRatePerKm),
        PayRateFlat: Number(d.payRateFlat),
        HireDate: d.hireDate?.toISOString().slice(0, 10) ?? "",
      }));
    }

    case "vehicles": {
      const data = await prisma.vehicle.findMany({
        where: { orgId },
        orderBy: { plate: "asc" },
        include: { branch: { select: { name: true } } },
      });
      return data.map((v) => ({
        Plate: v.plate,
        VIN: v.vin ?? "",
        Type: v.type,
        Make: v.make ?? "",
        Model: v.model ?? "",
        Year: v.year ?? "",
        Status: v.status,
        CapacityKg: v.capacityKg ?? "",
        CapacityM3: v.capacityM3 ?? "",
        OdometerKm: v.odometerKm,
        FuelType: v.fuelType ?? "",
        Branch: v.branch?.name ?? "",
      }));
    }

    case "customers": {
      const data = await prisma.customer.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { orders: true, invoices: true, contacts: true } },
        },
      });
      return data.map((c) => ({
        Code: c.code ?? "",
        Name: c.name,
        Email: c.email ?? "",
        Phone: c.phone ?? "",
        TaxId: c.taxId ?? "",
        Address: c.address ?? "",
        City: c.city ?? "",
        Country: c.country ?? "",
        CreditLimit: Number(c.creditLimit),
        Balance: Number(c.balance),
        Orders: c._count.orders,
        Invoices: c._count.invoices,
        Contacts: c._count.contacts,
        CreatedAt: c.createdAt.toISOString().slice(0, 10),
      }));
    }

    case "contacts": {
      const data = await prisma.contact.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        include: { customer: { select: { name: true } } },
      });
      return data.map((c) => ({
        Code: c.code,
        Name: c.name,
        Status: c.status,
        RelationshipType: c.relationshipType,
        Company: c.company ?? "",
        Customer: c.customer?.name ?? "",
        TaxID: c.taxId ?? "",
        JobTitle: c.jobTitle ?? "",
        Industry: c.industry ?? "",
        Email: c.email ?? "",
        Phone: c.phone ?? "",
        CreatedAt: c.createdAt.toISOString().slice(0, 10),
      }));
    }

    case "leads": {
      const data = await prisma.lead.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: { select: { name: true } },
          customer: { select: { name: true } },
          _count: { select: { activities: true } },
        },
      });
      return data.map((l) => ({
        Name: l.name,
        Company: l.company ?? "",
        Email: l.email ?? "",
        Phone: l.phone ?? "",
        Status: l.status,
        Source: l.source ?? "",
        AssignedTo: l.assignedTo?.name ?? "",
        EstimatedValue: Number(l.estimatedValue),
        Currency: l.currency,
        NextFollowUp: l.nextFollowUp?.toISOString().slice(0, 10) ?? "",
        ConvertedCustomer: l.customer?.name ?? "",
        ConvertedAt: l.convertedAt?.toISOString().slice(0, 10) ?? "",
        Activities: l._count.activities,
        Notes: l.notes ?? "",
        CreatedAt: l.createdAt.toISOString().slice(0, 10),
      }));
    }

    case "payments": {
      const data = await prisma.payment.findMany({
        where: { orgId },
        orderBy: { paidAt: "desc" },
        include: {
          invoice: { select: { number: true } },
          customer: { select: { name: true } },
          settlement: { select: { id: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      });
      return data.map((p) => ({
        PaidAt: p.paidAt.toISOString().slice(0, 10),
        Kind: p.kind,
        Amount: Number(p.amount),
        Currency: p.currency,
        Method: p.method,
        Reference: p.reference ?? "",
        Invoice: p.invoice?.number ?? "",
        Customer: p.customer?.name ?? "",
        Settlement: p.settlement?.id ?? "",
        Driver: p.driver
          ? `${p.driver.firstName} ${p.driver.lastName}`
          : "",
        Note: p.note ?? "",
      }));
    }

    case "settlements": {
      const data = await prisma.settlement.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        include: { driver: true },
      });
      return data.map((s) => ({
        Driver: `${s.driver.firstName} ${s.driver.lastName}`,
        PeriodFrom: s.periodFrom.toISOString().slice(0, 10),
        PeriodTo: s.periodTo.toISOString().slice(0, 10),
        TotalKm: s.totalKm,
        Gross: Number(s.gross),
        Deductions: Number(s.deductions),
        Net: Number(s.net),
        Currency: s.currency,
        Status: s.paidAt ? "PAID" : "UNPAID",
        PaidAt: s.paidAt?.toISOString().slice(0, 10) ?? "",
        CreatedAt: s.createdAt.toISOString().slice(0, 10),
      }));
    }
  }
}
