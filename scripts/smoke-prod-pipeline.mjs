/* Direct-to-DB smoke test of the sales pipeline against prod.db.
 * Replicates what the UI does end-to-end:
 *   1. Create a Lead (NEW)
 *   2. Create a draft Quotation tied to a customer + lead
 *   3. Add lines, recompute totals
 *   4. send -> accept -> convert to Order
 *   5. Confirm the Order, run the side-effects that flip
 *      Customer.status = ACTIVE and Lead.status = WON
 *   6. Cleanup
 */

import { PrismaClient, Prisma } from "@prisma/client";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "file:C:/Users/s.iakobidze/Documents/BSC_Logistic/prisma/prod.db";

const prisma = new PrismaClient({ log: ["error"] });

const D = Prisma.Decimal;
const decToStr = (d) => (d == null ? "null" : new D(d).toString());

let createdIds = { leadId: null, quotationId: null, orderId: null };

async function getContext() {
  const org = await prisma.organization.findFirstOrThrow({
    select: { id: true, name: true },
  });
  const admin = await prisma.user.findFirstOrThrow({
    where: { email: "admin@bsc.local" },
    select: { id: true, name: true, email: true, role: true },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });
  return { org, admin, customer };
}

async function nextQuotationNumber(orgId) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const last = await prisma.quotation.findFirst({
    where: { orgId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function recomputeQuotationTotals(tx, quotationId) {
  const q = await tx.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    select: {
      taxRate: true,
      discount: true,
      lines: { select: { quantity: true, unitPrice: true } },
    },
  });
  const sub = q.lines.reduce(
    (acc, l) => acc.plus(new D(l.quantity).times(new D(l.unitPrice))),
    new D(0),
  );
  const tax = sub.times(new D(q.taxRate)).div(100);
  const total = sub.plus(tax).minus(new D(q.discount));
  await tx.quotation.update({
    where: { id: quotationId },
    data: { subtotal: sub, taxAmount: tax, total },
  });
}

async function applyOrderConfirmationSideEffects(orderId) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orgId: true,
      customerId: true,
      sourceQuotationId: true,
    },
  });

  // Customer ACTIVE
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: order.customerId },
    select: { id: true, status: true, firstActivatedAt: true },
  });
  if (customer.status !== "ACTIVE") {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        status: "ACTIVE",
        firstActivatedAt: customer.firstActivatedAt ?? new Date(),
      },
    });
  }

  // Lead WON via the quotation backlink
  if (order.sourceQuotationId) {
    const q = await prisma.quotation.findUnique({
      where: { id: order.sourceQuotationId },
      select: { leadId: true },
    });
    if (q?.leadId) {
      await prisma.lead.update({
        where: { id: q.leadId },
        data: { status: "WON" },
      });
    }
  }
}

async function run() {
  const { org, admin, customer } = await getContext();
  console.log(
    `[smoke] org=${org.name} admin=${admin.email} customer=${customer.name} (status=${customer.status})`,
  );

  // Reset customer to PROSPECT so we can prove ACTIVE flip
  await prisma.customer.update({
    where: { id: customer.id },
    data: { status: "PROSPECT" },
  });

  // 1. Create lead
  const lead = await prisma.lead.create({
    data: {
      orgId: org.id,
      name: "Smoke pipeline lead",
      status: "NEW",
      assignedToId: admin.id,
      customerId: customer.id,
      source: "smoke-script",
    },
  });
  createdIds.leadId = lead.id;
  console.log(`[smoke] created lead ${lead.id} status=${lead.status}`);

  // 2. Create draft quote
  const number = await nextQuotationNumber(org.id);
  const quote = await prisma.quotation.create({
    data: {
      orgId: org.id,
      number,
      status: "DRAFT",
      customerId: customer.id,
      leadId: lead.id,
      ownerId: admin.id,
      currency: "USD",
      taxRate: 18,
      discount: 0,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });
  createdIds.quotationId = quote.id;
  console.log(`[smoke] created quote ${quote.number} (${quote.id}) status=${quote.status}`);

  // 3. Add lines + recompute
  await prisma.$transaction(async (tx) => {
    await tx.quotationLine.createMany({
      data: [
        { quotationId: quote.id, description: "Tbilisi → Batumi LCL", quantity: 2, unitPrice: 450 },
        { quotationId: quote.id, description: "Customs clearance", quantity: 1, unitPrice: 120 },
      ],
    });
    await recomputeQuotationTotals(tx, quote.id);
  });
  const after = await prisma.quotation.findUniqueOrThrow({
    where: { id: quote.id },
    select: { subtotal: true, taxAmount: true, total: true },
  });
  console.log(
    `[smoke] lines totals -> sub=${decToStr(after.subtotal)} tax=${decToStr(after.taxAmount)} total=${decToStr(after.total)}`,
  );

  // 4a. send
  await prisma.quotation.update({
    where: { id: quote.id },
    data: { status: "SENT", sentAt: new Date() },
  });
  console.log("[smoke] quotation sent");

  // 4b. accept
  await prisma.quotation.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  console.log("[smoke] quotation accepted");

  // 4c. convert -> order
  const order = await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.findUniqueOrThrow({
      where: { id: quote.id },
      include: { lines: true },
    });
    const counter = await tx.order.count({ where: { orgId: org.id } });
    const orderNumber = `ORD-${String(counter + 1).padStart(5, "0")}`;
    const o = await tx.order.create({
      data: {
        orgId: org.id,
        number: orderNumber,
        status: "DRAFT",
        customerId: q.customerId,
        leadId: q.leadId,
        sourceQuotationId: q.id,
        currency: q.currency,
        price: q.total,
        lines: {
          create: q.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: new D(l.quantity).times(new D(l.unitPrice)),
            sortOrder: l.sortOrder,
          })),
        },
      },
    });
    await tx.quotation.update({
      where: { id: q.id },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });
    return o;
  });
  createdIds.orderId = order.id;
  console.log(`[smoke] converted to order ${order.number} (${order.id})`);

  // 5. confirm + run side effects
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  await applyOrderConfirmationSideEffects(order.id);
  console.log("[smoke] order confirmed + side effects applied");

  const finalCustomer = await prisma.customer.findUniqueOrThrow({
    where: { id: customer.id },
    select: { status: true, firstActivatedAt: true },
  });
  const finalLead = await prisma.lead.findUniqueOrThrow({
    where: { id: lead.id },
    select: { status: true },
  });
  const finalQuote = await prisma.quotation.findUniqueOrThrow({
    where: { id: quote.id },
    select: { status: true },
  });
  const finalOrder = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { status: true, lines: { select: { id: true } } },
  });

  const checks = [
    ["Customer.status == ACTIVE", finalCustomer.status === "ACTIVE"],
    ["Customer.firstActivatedAt set", finalCustomer.firstActivatedAt != null],
    ["Lead.status == WON", finalLead.status === "WON"],
    ["Quotation.status == CONVERTED", finalQuote.status === "CONVERTED"],
    ["Order.status == CONFIRMED", finalOrder.status === "CONFIRMED"],
    ["Order has 2 line items", finalOrder.lines.length === 2],
  ];

  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"} ${label}`);
    if (!pass) ok = false;
  }

  if (!ok) {
    process.exitCode = 1;
    console.error("[smoke] some assertions failed");
  } else {
    console.log("[smoke] ALL ASSERTIONS PASSED");
  }
}

async function cleanup() {
  if (createdIds.orderId) {
    await prisma.orderLine
      .deleteMany({ where: { orderId: createdIds.orderId } })
      .catch(() => {});
    await prisma.order
      .delete({ where: { id: createdIds.orderId } })
      .catch(() => {});
  }
  if (createdIds.quotationId) {
    await prisma.quotationLine
      .deleteMany({ where: { quotationId: createdIds.quotationId } })
      .catch(() => {});
    await prisma.quotation
      .delete({ where: { id: createdIds.quotationId } })
      .catch(() => {});
  }
  if (createdIds.leadId) {
    await prisma.lead.delete({ where: { id: createdIds.leadId } }).catch(() => {});
  }
}

try {
  await run();
} catch (err) {
  console.error("[smoke] crash:", err);
  process.exitCode = 1;
} finally {
  await cleanup();
  await prisma.$disconnect();
}
