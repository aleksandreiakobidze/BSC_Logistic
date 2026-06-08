"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { staffRoles } from "@/lib/rbac";
import {
  Incoterms,
  LeadPriority,
  QuotationActivityKind,
  QuotationStatus,
  QuotationTeam,
  SupplierOfferStatus,
} from "@/lib/enums";
import {
  checkQuotationTransition,
  type QuotationStatusValue,
} from "@/lib/quotation-status";
import { recomputeQuotationTotals, snapshotQuotation } from "@/lib/quotations";
import { sendEmail } from "@/lib/mail";
import { publishQuotationEvent } from "@/lib/quotation-events";
import {
  diffFields,
  recordQuotationFieldChanges,
} from "@/lib/quotation-activity-diff";

// ─── RFQ Header ─────────────────────────────────────────────────────────────

const rfqHeaderSchema = z.object({
  salesManagerId: z.string().nullable().optional(),
  requestedTeams: z.array(z.string()).optional(),
  priority: z
    .enum(Object.values(LeadPriority) as [string, ...string[]])
    .optional(),
  mode: z.string().nullable().optional(),
  incoterms: z
    .enum(Object.values(Incoterms) as [string, ...string[]])
    .nullable()
    .optional(),
  originPort: z.string().nullable().optional(),
  originPortLat: z.coerce.number().nullable().optional(),
  originPortLng: z.coerce.number().nullable().optional(),
  originAddress: z.string().nullable().optional(),
  originAddressLat: z.coerce.number().nullable().optional(),
  originAddressLng: z.coerce.number().nullable().optional(),
  destinationPort: z.string().nullable().optional(),
  destinationPortLat: z.coerce.number().nullable().optional(),
  destinationPortLng: z.coerce.number().nullable().optional(),
  destinationAddress: z.string().nullable().optional(),
  destinationAddressLat: z.coerce.number().nullable().optional(),
  destinationAddressLng: z.coerce.number().nullable().optional(),
  cargoDescription: z.string().nullable().optional(),
  shipmentDetails: z.string().nullable().optional(),
  cargoValue: z.coerce.number().nullable().optional(),
  cargoValueCurrency: z.string().nullable().optional(),
  cargoReadyDate: z.coerce.date().nullable().optional(),
  specialRequirements: z.string().nullable().optional(),
});

export type UpdateRfqHeaderInput = z.input<typeof rfqHeaderSchema>;

const VALID_TEAMS = new Set<string>(Object.values(QuotationTeam));

function normaliseTeams(input?: string[] | null): string | null {
  if (!input || input.length === 0) return null;
  const seen = new Set<string>();
  for (const raw of input) {
    const t = String(raw).trim().toUpperCase();
    if (VALID_TEAMS.has(t)) seen.add(t);
  }
  return seen.size === 0 ? null : Array.from(seen).join(",");
}

const RFQ_HEADER_FIELDS = [
  "salesManagerId",
  "requestedTeams",
  "priority",
  "mode",
  "incoterms",
  "originPort",
  "originPortLat",
  "originPortLng",
  "originAddress",
  "originAddressLat",
  "originAddressLng",
  "destinationPort",
  "destinationPortLat",
  "destinationPortLng",
  "destinationAddress",
  "destinationAddressLat",
  "destinationAddressLng",
  "cargoDescription",
  "shipmentDetails",
  "cargoValue",
  "cargoValueCurrency",
  "cargoReadyDate",
  "specialRequirements",
] as const;

export async function updateRfqHeader(
  quotationId: string,
  input: UpdateRfqHeaderInput,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = rfqHeaderSchema.parse(input);

  const existing = await prisma.quotation.findFirstOrThrow({
    where: { id: quotationId, orgId },
    select: {
      id: true,
      status: true,
      salesManagerId: true,
      requestedTeams: true,
      priority: true,
      mode: true,
      incoterms: true,
      originPort: true,
      originPortLat: true,
      originPortLng: true,
      originAddress: true,
      originAddressLat: true,
      originAddressLng: true,
      destinationPort: true,
      destinationPortLat: true,
      destinationPortLng: true,
      destinationAddress: true,
      destinationAddressLat: true,
      destinationAddressLng: true,
      cargoDescription: true,
      shipmentDetails: true,
      cargoValue: true,
      cargoValueCurrency: true,
      cargoReadyDate: true,
      specialRequirements: true,
    },
  });

  if (
    existing.status !== QuotationStatus.PRICING &&
    existing.status !== QuotationStatus.DRAFT &&
    existing.status !== QuotationStatus.COUNTERED
  ) {
    throw new Error("RFQ header is locked at this status");
  }

  const nextRequestedTeams =
    data.requestedTeams === undefined
      ? undefined
      : normaliseTeams(data.requestedTeams);

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        salesManagerId:
          data.salesManagerId === undefined
            ? undefined
            : data.salesManagerId || null,
        requestedTeams: nextRequestedTeams,
        priority: data.priority,
        mode: data.mode === undefined ? undefined : data.mode || null,
        incoterms:
          data.incoterms === undefined ? undefined : data.incoterms || null,
        originPort:
          data.originPort === undefined ? undefined : data.originPort || null,
        originPortLat:
          data.originPortLat === undefined ? undefined : data.originPortLat,
        originPortLng:
          data.originPortLng === undefined ? undefined : data.originPortLng,
        originAddress:
          data.originAddress === undefined
            ? undefined
            : data.originAddress || null,
        originAddressLat:
          data.originAddressLat === undefined
            ? undefined
            : data.originAddressLat,
        originAddressLng:
          data.originAddressLng === undefined
            ? undefined
            : data.originAddressLng,
        destinationPort:
          data.destinationPort === undefined
            ? undefined
            : data.destinationPort || null,
        destinationPortLat:
          data.destinationPortLat === undefined
            ? undefined
            : data.destinationPortLat,
        destinationPortLng:
          data.destinationPortLng === undefined
            ? undefined
            : data.destinationPortLng,
        destinationAddress:
          data.destinationAddress === undefined
            ? undefined
            : data.destinationAddress || null,
        destinationAddressLat:
          data.destinationAddressLat === undefined
            ? undefined
            : data.destinationAddressLat,
        destinationAddressLng:
          data.destinationAddressLng === undefined
            ? undefined
            : data.destinationAddressLng,
        cargoDescription:
          data.cargoDescription === undefined
            ? undefined
            : data.cargoDescription || null,
        shipmentDetails:
          data.shipmentDetails === undefined
            ? undefined
            : data.shipmentDetails || null,
        cargoValue: data.cargoValue === undefined ? undefined : data.cargoValue,
        cargoValueCurrency:
          data.cargoValueCurrency === undefined
            ? undefined
            : data.cargoValueCurrency || null,
        cargoReadyDate:
          data.cargoReadyDate === undefined ? undefined : data.cargoReadyDate,
        specialRequirements:
          data.specialRequirements === undefined
            ? undefined
            : data.specialRequirements || null,
      },
    });

    const after: Record<string, unknown> = {
      salesManagerId:
        data.salesManagerId === undefined
          ? undefined
          : data.salesManagerId || null,
      requestedTeams: nextRequestedTeams,
      priority: data.priority,
      mode: data.mode === undefined ? undefined : data.mode || null,
      incoterms:
        data.incoterms === undefined ? undefined : data.incoterms || null,
      originPort:
        data.originPort === undefined ? undefined : data.originPort || null,
      originPortLat:
        data.originPortLat === undefined ? undefined : data.originPortLat,
      originPortLng:
        data.originPortLng === undefined ? undefined : data.originPortLng,
      originAddress:
        data.originAddress === undefined
          ? undefined
          : data.originAddress || null,
      originAddressLat:
        data.originAddressLat === undefined
          ? undefined
          : data.originAddressLat,
      originAddressLng:
        data.originAddressLng === undefined
          ? undefined
          : data.originAddressLng,
      destinationPort:
        data.destinationPort === undefined
          ? undefined
          : data.destinationPort || null,
      destinationPortLat:
        data.destinationPortLat === undefined
          ? undefined
          : data.destinationPortLat,
      destinationPortLng:
        data.destinationPortLng === undefined
          ? undefined
          : data.destinationPortLng,
      destinationAddress:
        data.destinationAddress === undefined
          ? undefined
          : data.destinationAddress || null,
      destinationAddressLat:
        data.destinationAddressLat === undefined
          ? undefined
          : data.destinationAddressLat,
      destinationAddressLng:
        data.destinationAddressLng === undefined
          ? undefined
          : data.destinationAddressLng,
      cargoDescription:
        data.cargoDescription === undefined
          ? undefined
          : data.cargoDescription || null,
      shipmentDetails:
        data.shipmentDetails === undefined
          ? undefined
          : data.shipmentDetails || null,
      cargoValue: data.cargoValue === undefined ? undefined : data.cargoValue,
      cargoValueCurrency:
        data.cargoValueCurrency === undefined
          ? undefined
          : data.cargoValueCurrency || null,
      cargoReadyDate:
        data.cargoReadyDate === undefined ? undefined : data.cargoReadyDate,
      specialRequirements:
        data.specialRequirements === undefined
          ? undefined
          : data.specialRequirements || null,
    };

    const changes = diffFields(
      existing as Record<string, unknown>,
      after,
      RFQ_HEADER_FIELDS as unknown as string[],
      { commaListFields: ["requestedTeams"] },
    );

    await recordQuotationFieldChanges(tx, {
      quotationId,
      userId: session.user.id,
      entity: "RFQ",
      changes,
    });
  });

  await audit({
    action: "quotation.rfq.update",
    entity: "Quotation",
    entityId: quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true };
}

// ─── Supplier Offers ─────────────────────────────────────────────────────────

const supplierOfferSchema = z.object({
  supplierId: z.string().min(1),
  team: z.enum(Object.values(QuotationTeam) as [string, ...string[]]),
  managerUserId: z.string().nullable().optional(),
  totalCost: z.coerce.number().nonnegative().default(0),
  currency: z.string().default("USD"),
  transitTimeDays: z.coerce.number().int().nonnegative().nullable().optional(),
  incoterms: z
    .enum(Object.values(Incoterms) as [string, ...string[]])
    .nullable()
    .optional(),
  validUntil: z.coerce.date().nullable().optional(),
  terms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type AddSupplierOfferInput = z.input<typeof supplierOfferSchema> & {
  quotationId: string;
};

export async function addSupplierOffer(input: AddSupplierOfferInput) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = supplierOfferSchema.parse(input);

  const [quote, supplier] = await Promise.all([
    prisma.quotation.findFirstOrThrow({
      where: { id: input.quotationId, orgId },
      select: { id: true, status: true },
    }),
    prisma.supplier.findFirstOrThrow({
      where: { id: data.supplierId, orgId },
      select: { id: true, name: true, currency: true },
    }),
  ]);

  ensureCanEditOffers(quote.status);

  const offer = await prisma.supplierOffer.create({
    data: {
      quotationId: quote.id,
      supplierId: supplier.id,
      team: data.team,
      managerUserId:
        data.managerUserId && data.managerUserId !== "none"
          ? data.managerUserId
          : null,
      status: SupplierOfferStatus.RECEIVED,
      totalCost: data.totalCost,
      currency: data.currency || supplier.currency || "USD",
      transitTimeDays: data.transitTimeDays ?? null,
      incoterms: data.incoterms ?? null,
      validUntil: data.validUntil ?? null,
      terms: data.terms ?? null,
      notes: data.notes ?? null,
      receivedAt: new Date(),
    },
  });

  await prisma.quotationActivity.create({
    data: {
      quotationId: quote.id,
      userId: session.user.id,
      kind: QuotationActivityKind.SUPPLIER_OFFER,
      note: `Added offer from ${supplier.name} for ${data.team}`,
      meta: JSON.stringify({ offerId: offer.id, supplierId: supplier.id }),
    },
  });

  await audit({
    action: "quotation.supplierOffer.create",
    entity: "SupplierOffer",
    entityId: offer.id,
    orgId,
    userId: session.user.id,
    meta: { quotationId: quote.id, supplierId: supplier.id, team: data.team },
  });

  revalidatePath(`/quotations/${quote.id}`);
  publishQuotationEvent(quote.id, {
    type: "stateChange",
    reason: "lineUpdated",
    recipientRoles: ["ADMIN"],
  });
  return { ok: true, id: offer.id };
}

const updateOfferSchema = supplierOfferSchema.partial();

const SUPPLIER_OFFER_FIELDS = [
  "supplierId",
  "team",
  "managerUserId",
  "totalCost",
  "currency",
  "transitTimeDays",
  "incoterms",
  "validUntil",
  "terms",
  "notes",
] as const;

export async function updateSupplierOffer(
  offerId: string,
  input: z.input<typeof updateOfferSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = updateOfferSchema.parse(input);

  const offer = await loadOffer(offerId, orgId);
  ensureCanEditOffers(offer.quotation.status);

  const nextManagerUserId =
    data.managerUserId === undefined
      ? undefined
      : data.managerUserId && data.managerUserId !== "none"
        ? data.managerUserId
        : null;

  await prisma.$transaction(async (tx) => {
    await tx.supplierOffer.update({
      where: { id: offerId },
      data: {
        supplierId: data.supplierId,
        team: data.team,
        managerUserId: nextManagerUserId,
        totalCost: data.totalCost,
        currency: data.currency,
        transitTimeDays:
          data.transitTimeDays === undefined ? undefined : data.transitTimeDays,
        incoterms: data.incoterms === undefined ? undefined : data.incoterms,
        validUntil: data.validUntil === undefined ? undefined : data.validUntil,
        terms: data.terms === undefined ? undefined : data.terms,
        notes: data.notes === undefined ? undefined : data.notes,
      },
    });

    const after: Record<string, unknown> = {
      supplierId: data.supplierId,
      team: data.team,
      managerUserId: nextManagerUserId,
      totalCost: data.totalCost,
      currency: data.currency,
      transitTimeDays:
        data.transitTimeDays === undefined ? undefined : data.transitTimeDays,
      incoterms: data.incoterms === undefined ? undefined : data.incoterms,
      validUntil: data.validUntil === undefined ? undefined : data.validUntil,
      terms: data.terms === undefined ? undefined : data.terms,
      notes: data.notes === undefined ? undefined : data.notes,
    };

    const changes = diffFields(
      offer as unknown as Record<string, unknown>,
      after,
      SUPPLIER_OFFER_FIELDS as unknown as string[],
    );

    await recordQuotationFieldChanges(tx, {
      quotationId: offer.quotationId,
      userId: session.user.id,
      entity: `Supplier offer (${offer.supplier.name} / ${offer.team})`,
      entityId: offerId,
      changes,
    });
  });

  await audit({
    action: "quotation.supplierOffer.update",
    entity: "SupplierOffer",
    entityId: offerId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${offer.quotationId}`);
  return { ok: true };
}

export async function deleteSupplierOffer(offerId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const offer = await loadOffer(offerId, orgId);
  ensureCanEditOffers(offer.quotation.status);

  await prisma.supplierOffer.delete({ where: { id: offerId } });

  await audit({
    action: "quotation.supplierOffer.delete",
    entity: "SupplierOffer",
    entityId: offerId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${offer.quotationId}`);
  return { ok: true };
}

/**
 * Toggle a supplier offer's selection flag. Each offer is independent —
 * any combination (including multiple per team or multiple currencies)
 * can be selected at the same time. Generate Quote will produce one line
 * per selected offer.
 */
export async function selectSupplierOffer(offerId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const offer = await loadOffer(offerId, orgId);
  ensureCanEditOffers(offer.quotation.status);

  const nextIsSelected = !offer.isSelected;
  const nextStatus = nextIsSelected
    ? SupplierOfferStatus.SELECTED
    : SupplierOfferStatus.RECEIVED;

  await prisma.supplierOffer.update({
    where: { id: offerId },
    data: { isSelected: nextIsSelected, status: nextStatus },
  });

  await audit({
    action: nextIsSelected
      ? "quotation.supplierOffer.select"
      : "quotation.supplierOffer.deselect",
    entity: "SupplierOffer",
    entityId: offerId,
    orgId,
    userId: session.user.id,
    meta: {
      quotationId: offer.quotationId,
      team: offer.team,
      isSelected: nextIsSelected,
    },
  });

  revalidatePath(`/quotations/${offer.quotationId}`);
  return { ok: true, isSelected: nextIsSelected };
}

const requestPricingSchema = z.object({
  quotationId: z.string().min(1),
  offerIds: z.array(z.string().min(1)).min(1),
  message: z.string().max(2000).optional(),
});

export type RequestSupplierPricingResult = {
  ok: true;
  sent: number;
  failed: { offerId: string; reason: string }[];
};

export async function requestSupplierPricing(
  input: z.input<typeof requestPricingSchema>,
): Promise<RequestSupplierPricingResult> {
  const { session, orgId } = await requireRole(staffRoles);
  const data = requestPricingSchema.parse(input);

  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: data.quotationId, orgId },
    include: {
      customer: { select: { name: true } },
    },
  });

  const offers = await prisma.supplierOffer.findMany({
    where: { id: { in: data.offerIds }, quotationId: quote.id },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
    },
  });

  const now = new Date();
  const failed: RequestSupplierPricingResult["failed"] = [];
  let sent = 0;

  for (const offer of offers) {
    if (!offer.supplier.email) {
      failed.push({ offerId: offer.id, reason: "NO_EMAIL" });
      continue;
    }
    try {
      await sendEmail({
        to: offer.supplier.email,
        subject: `RFQ ${quote.number} — request for pricing`,
        html: buildSupplierRfqEmail({
          supplierName: offer.supplier.name,
          quoteNumber: quote.number,
          customerName: quote.customer.name,
          team: offer.team,
          origin: composeLocation(quote.originPort, quote.originAddress),
          destination: composeLocation(
            quote.destinationPort,
            quote.destinationAddress,
          ),
          incoterms: offer.incoterms ?? quote.incoterms,
          cargoDescription: quote.cargoDescription,
          cargoReadyDate: quote.cargoReadyDate,
          message: data.message,
        }),
      });
      sent++;
      await prisma.supplierOffer.update({
        where: { id: offer.id },
        data: {
          status: SupplierOfferStatus.REQUESTED,
          requestedAt: now,
        },
      });
    } catch (err) {
      failed.push({
        offerId: offer.id,
        reason: err instanceof Error ? err.message : "SEND_FAILED",
      });
    }
  }

  if (sent > 0) {
    await prisma.quotationActivity.create({
      data: {
        quotationId: quote.id,
        userId: session.user.id,
        kind: QuotationActivityKind.RFQ_SENT,
        note: `Requested pricing from ${sent} supplier(s)`,
        meta: JSON.stringify({
          offerIds: offers
            .filter((o) => !failed.some((f) => f.offerId === o.id))
            .map((o) => o.id),
        }),
      },
    });
  }

  await audit({
    action: "quotation.requestPricing",
    entity: "Quotation",
    entityId: quote.id,
    orgId,
    userId: session.user.id,
    meta: { sent, failed: failed.length },
  });

  revalidatePath(`/quotations/${quote.id}`);
  return { ok: true, sent, failed };
}

// ─── Generate Quote: PRICING -> DRAFT ────────────────────────────────────────

const generateQuoteSchema = z.object({
  quotationId: z.string().min(1),
  /** Per-team markup percentage (e.g. { SEA: 12, LAND: 10 }). Falls back to default. */
  markupByTeam: z.record(z.coerce.number().min(0)).optional(),
  defaultMarkupPercent: z.coerce.number().min(0).default(15),
  /** When true, replaces any existing QuotationLine rows. */
  replaceExisting: z.boolean().default(true),
});

export type GenerateQuoteResult =
  | { ok: true; linesCreated: number }
  | {
      ok: false;
      error:
        | { code: "INVALID_TRANSITION"; from: string }
        | { code: "NO_SELECTED_OFFER" };
    };

export async function generateQuoteFromSelected(
  input: z.input<typeof generateQuoteSchema>,
): Promise<GenerateQuoteResult> {
  const { session, orgId } = await requireRole(staffRoles);
  const data = generateQuoteSchema.parse(input);

  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: data.quotationId, orgId },
    include: {
      supplierOffers: {
        where: { isSelected: true },
        include: { supplier: { select: { name: true } } },
        orderBy: { team: "asc" },
      },
      lines: { select: { id: true } },
    },
  });

  if (quote.status !== QuotationStatus.PRICING) {
    return {
      ok: false,
      error: { code: "INVALID_TRANSITION", from: quote.status },
    };
  }
  if (quote.supplierOffers.length === 0) {
    return { ok: false, error: { code: "NO_SELECTED_OFFER" } };
  }

  const markup: Record<string, number> = data.markupByTeam ?? {};
  const linesCreated = await prisma.$transaction(async (tx) => {
    if (data.replaceExisting && quote.lines.length > 0) {
      await tx.quotationLine.deleteMany({ where: { quotationId: quote.id } });
    }

    let order = 0;
    for (const offer of quote.supplierOffers) {
      const m =
        markup[offer.team] != null
          ? Number(markup[offer.team])
          : data.defaultMarkupPercent;
      const cost = Number(offer.totalCost);
      const sell = round2(cost * (1 + m / 100));
      await tx.quotationLine.create({
        data: {
          quotationId: quote.id,
          description: `${offer.team} — ${offer.supplier.name}`,
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(sell),
          total: new Prisma.Decimal(sell),
          sortOrder: order++,
        },
      });
    }

    await recomputeQuotationTotals(tx, quote.id);
    await tx.quotation.update({
      where: { id: quote.id },
      data: { status: QuotationStatus.DRAFT },
    });
    await snapshotQuotation(tx, quote.id, {
      source: "ADMIN",
      authorUserId: session.user.id,
      message: "Generated draft from selected supplier offers",
    });

    return quote.supplierOffers.length;
  });

  await prisma.quotationActivity.create({
    data: {
      quotationId: quote.id,
      userId: session.user.id,
      kind: QuotationActivityKind.STATUS_CHANGE,
      note: `PRICING → DRAFT (Generate Quote, ${linesCreated} line(s))`,
    },
  });

  await audit({
    action: "quotation.generateQuote",
    entity: "Quotation",
    entityId: quote.id,
    orgId,
    userId: session.user.id,
    meta: { linesCreated },
  });

  revalidatePath(`/quotations/${quote.id}`);
  revalidatePath("/quotations");
  publishQuotationEvent(quote.id, {
    type: "stateChange",
    reason: "lineAdded",
    recipientRoles: ["ADMIN"],
  });
  return { ok: true, linesCreated };
}

// ─── Mark Won / Lost ────────────────────────────────────────────────────────

export async function markQuotationWon(quotationId: string) {
  const { session, orgId } = await requireRole(staffRoles);
  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: quotationId, orgId },
    select: { id: true, status: true, leadId: true, wonAt: true },
  });

  const status = quote.status as QuotationStatusValue;
  const check = checkQuotationTransition(
    {
      status,
      selectedOffersCount: 1,
      linesCount: 1,
      hasPortalUser: true,
    },
    QuotationStatus.WON,
  );
  if (!check.ok) {
    throw new Error(`Cannot mark won: ${check.error.code}`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status:
          status === QuotationStatus.CONVERTED
            ? QuotationStatus.CONVERTED
            : QuotationStatus.WON,
        wonAt: quote.wonAt ?? now,
      },
    });
    if (quote.leadId) {
      // Stamp lead.wonAt only if it isn't already set, mirroring the
      // applyOrderConfirmationSideEffects contract.
      await tx.lead.updateMany({
        where: { id: quote.leadId, wonAt: null },
        data: { wonAt: now },
      });
    }
    await tx.quotationActivity.create({
      data: {
        quotationId,
        userId: session.user.id,
        kind: QuotationActivityKind.STATUS_CHANGE,
        note: `Marked won`,
      },
    });
  });

  await audit({
    action: "quotation.markWon",
    entity: "Quotation",
    entityId: quotationId,
    orgId,
    userId: session.user.id,
  });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
  publishQuotationEvent(quotationId, {
    type: "stateChange",
    reason: "accepted",
    recipientRoles: ["ADMIN"],
  });
  return { ok: true };
}

const lostReasonSchema = z.object({
  quotationId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function markQuotationLost(
  input: z.input<typeof lostReasonSchema>,
) {
  const { session, orgId } = await requireRole(staffRoles);
  const data = lostReasonSchema.parse(input);

  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: data.quotationId, orgId },
    select: { id: true, status: true, lostAt: true },
  });
  if (
    quote.status === QuotationStatus.CONVERTED ||
    quote.status === QuotationStatus.WON
  ) {
    throw new Error("Already won — cannot mark lost");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: data.quotationId },
      data: {
        status: QuotationStatus.LOST,
        lostAt: quote.lostAt ?? now,
        lostReason: data.reason ?? null,
        rejectedAt: now,
      },
    });
    await tx.quotationActivity.create({
      data: {
        quotationId: data.quotationId,
        userId: session.user.id,
        kind: QuotationActivityKind.STATUS_CHANGE,
        note: `Marked lost${data.reason ? ` — ${data.reason}` : ""}`,
      },
    });
  });

  await audit({
    action: "quotation.markLost",
    entity: "Quotation",
    entityId: data.quotationId,
    orgId,
    userId: session.user.id,
    meta: { reason: data.reason },
  });

  revalidatePath(`/quotations/${data.quotationId}`);
  revalidatePath("/quotations");
  publishQuotationEvent(data.quotationId, {
    type: "stateChange",
    reason: "rejected",
    recipientRoles: ["ADMIN"],
  });
  return { ok: true };
}

// ─── Activity Feed ──────────────────────────────────────────────────────────

const addActivitySchema = z.object({
  quotationId: z.string().min(1),
  kind: z
    .enum(Object.values(QuotationActivityKind) as [string, ...string[]])
    .default(QuotationActivityKind.NOTE),
  note: z.string().min(1).max(2000),
});

export async function addQuotationActivity(
  input: z.input<typeof addActivitySchema>,
) {
  const { session, orgId } = await requireOrg();
  const data = addActivitySchema.parse(input);

  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: data.quotationId, orgId },
    select: { id: true },
  });

  await prisma.quotationActivity.create({
    data: {
      quotationId: quote.id,
      userId: session.user.id,
      kind: data.kind,
      note: data.note,
    },
  });

  revalidatePath(`/quotations/${quote.id}`);
  return { ok: true };
}

export async function listQuotationActivities(quotationId: string) {
  const { orgId } = await requireOrg();
  const quote = await prisma.quotation.findFirstOrThrow({
    where: { id: quotationId, orgId },
    select: { id: true },
  });
  return prisma.quotationActivity.findMany({
    where: { quotationId: quote.id },
    orderBy: { at: "desc" },
    take: 100,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadOffer(offerId: string, orgId: string) {
  const offer = await prisma.supplierOffer.findUnique({
    where: { id: offerId },
    include: {
      quotation: { select: { orgId: true, status: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  if (!offer) throw new Error("Supplier offer not found");
  if (offer.quotation.orgId !== orgId) throw new Error("Forbidden");
  return offer;
}

function ensureCanEditOffers(status: string) {
  if (
    status !== QuotationStatus.PRICING &&
    status !== QuotationStatus.DRAFT &&
    status !== QuotationStatus.COUNTERED
  ) {
    throw new Error(
      "Supplier offers can only be edited while quotation is in PRICING, DRAFT or COUNTERED",
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function composeLocation(port: string | null, address: string | null): string {
  return [port, address].filter(Boolean).join(" — ") || "—";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]!,
  );
}

function buildSupplierRfqEmail(opts: {
  supplierName: string;
  quoteNumber: string;
  customerName: string;
  team: string;
  origin: string;
  destination: string;
  incoterms: string | null;
  cargoDescription: string | null;
  cargoReadyDate: Date | null;
  message?: string;
}): string {
  const safeMsg = opts.message
    ? `<p style="white-space:pre-wrap;color:#444">${escapeHtml(opts.message)}</p>`
    : "";
  const ready = opts.cargoReadyDate
    ? opts.cargoReadyDate.toISOString().slice(0, 10)
    : "—";
  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1f2937">
      <h2 style="margin:0 0 12px">RFQ ${escapeHtml(opts.quoteNumber)} — ${escapeHtml(opts.team)}</h2>
      <p>Hi ${escapeHtml(opts.supplierName)},</p>
      <p>We are preparing a quotation for <strong>${escapeHtml(opts.customerName)}</strong>
         and would like your best pricing on the lane below:</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
        <tbody>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Origin</td><td>${escapeHtml(opts.origin)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Destination</td><td>${escapeHtml(opts.destination)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Incoterms</td><td>${escapeHtml(opts.incoterms ?? "—")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Cargo</td><td>${escapeHtml(opts.cargoDescription ?? "—")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Ready</td><td>${escapeHtml(ready)}</td></tr>
        </tbody>
      </table>
      ${safeMsg}
      <p style="font-size:12px;color:#6b7280">Please reply to this email with your total cost, transit time, and validity. Thanks!</p>
    </div>
  `.trim();
}
