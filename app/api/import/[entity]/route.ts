import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseSheetFromBuffer } from "@/lib/excel";
import {
  CustomerStatus,
  OrderStatus,
  ShipmentStatus,
  StopKind,
} from "@/lib/enums";
import { generateNumber, generateTrackingCode } from "@/lib/utils";
import {
  CustomFieldType,
  type CustomFieldEntity,
} from "@/lib/custom-fields";
import { saveCustomFieldValues } from "@/app/[locale]/(dashboard)/settings/custom-fields/actions";
import {
  ImportEntity,
  getEffectiveFields,
  importEntitySlugs,
  normalizeHeader,
  type EffectiveField,
  type ImportEntitySlug,
} from "@/lib/import/registry";

const MAX_ROWS = 5000;

type RowResult = {
  rowIndex: number; // 1-based, matches the spreadsheet row number (header = 1)
  ok: boolean;
  id?: string;
  error?: string;
};

type ImportResponse = {
  created: number;
  failed: number;
  rows: RowResult[];
};

/**
 * POST /api/import/[entity]
 *
 * multipart/form-data with `file` (xlsx/csv). Parses the first sheet,
 * matches headers (case/space-insensitive, ignoring trailing "*") to
 * effective fields, validates each row, and creates Customers or
 * Orders (with their initial Shipment + Stops). Custom-field values are
 * persisted via the existing `saveCustomFieldValues` helper.
 *
 * Returns a per-row report so the UI can show successes and failures
 * without aborting on the first error.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.orgId;
  const userId = session.user.id;

  const { entity } = await params;
  if (!importEntitySlugs.includes(entity as ImportEntitySlug)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  }
  const slug = entity as ImportEntitySlug;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    rows = parseSheetFromBuffer(buf) as Record<string, unknown>[];
  } catch {
    return NextResponse.json(
      { error: "Could not parse file. Use .xlsx or .csv." },
      { status: 400 },
    );
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (${rows.length}). Limit is ${MAX_ROWS}.` },
      { status: 400 },
    );
  }

  const fields = await getEffectiveFields(orgId, slug);
  // Map normalized header → field. We pre-normalize once.
  const fieldByHeader = new Map<string, EffectiveField>();
  for (const f of fields) {
    fieldByHeader.set(normalizeHeader(f.label), f);
  }

  const result: ImportResponse = { created: 0, failed: 0, rows: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // header row is 1
    const raw = rows[i];

    if (isEmptyRow(raw)) continue;

    // Build a normalized object keyed by EffectiveField.key, after matching
    // every header to an EffectiveField (unknown headers are ignored).
    const values: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(raw)) {
      const f = fieldByHeader.get(normalizeHeader(header));
      if (!f) continue;
      values[f.key] = value;
    }

    try {
      const created =
        slug === "customers"
          ? await createCustomerRow(orgId, fields, values)
          : await createOrderRow(orgId, fields, values);

      result.created++;
      result.rows.push({ rowIndex, ok: true, id: created.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.failed++;
      result.rows.push({ rowIndex, ok: false, error: message });
    }
  }

  await audit({
    action: `import.${slug}`,
    entity: slug === "customers" ? "Customer" : "Order",
    orgId,
    userId,
    meta: { created: result.created, failed: result.failed },
  });

  revalidatePath(`/${slug}`);
  if (slug === "orders") revalidatePath("/shipments");
  return NextResponse.json(result);
}

// ---------------------------------------------------------------------------
// Row-level helpers
// ---------------------------------------------------------------------------

function isEmptyRow(row: Record<string, unknown>) {
  for (const v of Object.values(row)) {
    if (v != null && String(v).trim() !== "") return false;
  }
  return true;
}

/**
 * Validate a single field's raw value against its effective type and
 * required state. Returns the coerced value or throws an Error with a
 * human-friendly message.
 */
function coerceFieldValue(field: EffectiveField, raw: unknown): unknown {
  const isEmpty =
    raw == null || (typeof raw === "string" && raw.trim() === "");

  if (isEmpty) {
    if (field.required) {
      throw new Error(`${field.label} is required`);
    }
    return null;
  }

  const str = String(raw).trim();

  switch (field.type) {
    case "number": {
      const num = Number(str.replace(/,/g, ""));
      if (Number.isNaN(num)) {
        throw new Error(`${field.label} must be a number`);
      }
      return num;
    }
    case "boolean": {
      const v = str.toLowerCase();
      if (["true", "yes", "y", "1", "on"].includes(v)) return true;
      if (["false", "no", "n", "0", "off"].includes(v)) return false;
      throw new Error(`${field.label} must be true/false`);
    }
    case "date": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`${field.label} must be a date`);
      }
      return d;
    }
    case "enum": {
      if (!field.enumValues || field.enumValues.length === 0) return str;
      const match = field.enumValues.find(
        (v) => v.toLowerCase() === str.toLowerCase(),
      );
      if (!match) {
        throw new Error(
          `${field.label} must be one of: ${field.enumValues.join(", ")}`,
        );
      }
      return match;
    }
    default:
      return str;
  }
}

/**
 * Build a synthetic FormData for the given row containing only the
 * `cf_<key>` entries that `saveCustomFieldValues` consumes. Multi-select
 * values may arrive as comma-delimited strings, which we split here so
 * the helper sees them as multiple entries (matching what the real form
 * would post).
 */
function buildCustomFieldFormData(
  fields: EffectiveField[],
  values: Record<string, unknown>,
): FormData {
  const fd = new FormData();
  for (const field of fields) {
    if (field.source !== "custom" || !field.definition) continue;
    const raw = values[field.key];
    if (raw == null || raw === "") continue;
    const str = String(raw);

    if (field.definition.type === CustomFieldType.MULTI_SELECT) {
      for (const part of str.split(",").map((s) => s.trim()).filter(Boolean)) {
        fd.append(field.key, part);
      }
    } else {
      fd.set(field.key, str);
    }
  }
  return fd;
}

async function createCustomerRow(
  orgId: string,
  fields: EffectiveField[],
  values: Record<string, unknown>,
) {
  // Coerce + validate every effective field. We only persist built-in
  // values inline; custom fields are forwarded through saveCustomFieldValues.
  const builtin: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.source === "builtin") {
      builtin[f.key] = coerceFieldValue(f, values[f.key]);
    }
  }

  const status =
    (builtin.status as string | null) ?? CustomerStatus.PROSPECT;

  const created = await prisma.customer.create({
    data: {
      orgId,
      name: builtin.name as string,
      code: (builtin.code as string | null) || null,
      email: (builtin.email as string | null) || null,
      phone: (builtin.phone as string | null) || null,
      taxId: (builtin.taxId as string | null) || null,
      address: (builtin.address as string | null) || null,
      city: (builtin.city as string | null) || null,
      country: (builtin.country as string | null) || null,
      creditLimit: (builtin.creditLimit as number | null) ?? 0,
      notes: (builtin.notes as string | null) || null,
      status,
    },
  });

  const cfFormData = buildCustomFieldFormData(fields, values);
  await saveCustomFieldValues({
    orgId,
    entityType: ImportEntity.customers as CustomFieldEntity,
    recordId: created.id,
    formData: cfFormData,
  });

  return created;
}

async function createOrderRow(
  orgId: string,
  fields: EffectiveField[],
  values: Record<string, unknown>,
) {
  const builtin: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.source === "builtin") {
      builtin[f.key] = coerceFieldValue(f, values[f.key]);
    }
  }

  const customerCode = (builtin.customerCode as string | null) || null;
  if (!customerCode) {
    throw new Error("Customer Code is required");
  }
  const customer = await prisma.customer.findFirst({
    where: { orgId, code: customerCode },
    select: { id: true },
  });
  if (!customer) {
    throw new Error(`No customer found with code "${customerCode}"`);
  }

  const status = (builtin.status as string | null) ?? OrderStatus.QUOTE;
  const currency = (builtin.currency as string | null) || "USD";

  const order = await prisma.order.create({
    data: {
      orgId,
      customerId: customer.id,
      number: generateNumber("ORD"),
      price: (builtin.price as number | null) ?? 0,
      currency,
      status,
      reference: (builtin.reference as string | null) || null,
      notes: (builtin.notes as string | null) || null,
    },
  });

  // Mirror createOrder in orders/actions.ts: every imported order gets an
  // initial Shipment + pickup/dropoff Stops + CREATED event, linked via the join table.
  await prisma.shipment.create({
    data: {
      orgId,
      number: generateNumber("SHP"),
      trackingCode: generateTrackingCode(),
      status: ShipmentStatus.PLANNED,
      cargoType: (builtin.cargoType as string | null) || null,
      cargoWeightKg: (builtin.cargoWeightKg as number | null) ?? null,
      stops: {
        create: [
          {
            sequence: 1,
            kind: StopKind.PICKUP,
            address: builtin.pickupAddress as string,
            city: (builtin.pickupCity as string | null) || null,
            country: (builtin.pickupCountry as string | null) || null,
          },
          {
            sequence: 2,
            kind: StopKind.DROPOFF,
            address: builtin.dropoffAddress as string,
            city: (builtin.dropoffCity as string | null) || null,
            country: (builtin.dropoffCountry as string | null) || null,
          },
        ],
      },
      events: {
        create: { type: "CREATED", note: "Order & shipment imported" },
      },
      orderLinks: { create: { orderId: order.id, sortOrder: 0 } },
    },
  });

  const cfFormData = buildCustomFieldFormData(fields, values);
  await saveCustomFieldValues({
    orgId,
    entityType: ImportEntity.orders as CustomFieldEntity,
    recordId: order.id,
    formData: cfFormData,
  });

  return order;
}
