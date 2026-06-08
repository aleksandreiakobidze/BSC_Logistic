import { Prisma, type PrismaClient } from "@prisma/client";
import { QuotationActivityKind } from "@/lib/enums";

type Tx = Prisma.TransactionClient | PrismaClient;

export type FieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

/**
 * Normalizes a value so equality comparisons treat null/undefined/"" as the
 * same "absent" value, and Prisma.Decimal as its numeric form. Dates are
 * compared by their epoch ms, and arrays are compared as sorted JSON so the
 * order of multi-select options (e.g. requestedTeams) doesn't generate noise.
 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => normalize(v))
      .filter((v) => v !== null)
      .map((v) => String(v))
      .sort();
    return arr.length === 0 ? null : arr.join(",");
  }
  return value;
}

/**
 * If a value is a comma-separated string (e.g. "SEA,LAND"), returns the sorted
 * canonical form so order changes don't count as a diff. Returns null for
 * empty/missing strings.
 */
function normalizeCommaList(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return normalize(value);
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  return parts.length === 0 ? null : parts.join(",");
}

export interface DiffOptions<T> {
  /** Field names whose value is a comma-separated list of tags. */
  commaListFields?: (keyof T)[];
}

/**
 * Returns the subset of `fields` whose values differ between `before` and
 * `after`. Only includes a field when `after` actually carries a value (i.e.
 * skipped when `after[field] === undefined`, since callers use `undefined` to
 * mean "leave unchanged").
 */
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T>,
  after: Partial<T>,
  fields: (keyof T)[],
  options: DiffOptions<T> = {},
): FieldChange[] {
  const commaList = new Set<keyof T>(options.commaListFields ?? []);
  const changes: FieldChange[] = [];
  for (const field of fields) {
    if (after[field] === undefined) continue;
    const norm = commaList.has(field) ? normalizeCommaList : normalize;
    const a = norm(before[field]);
    const b = norm(after[field]);
    if (a !== b) {
      changes.push({
        field: String(field),
        from: before[field] ?? null,
        to: after[field] ?? null,
      });
    }
  }
  return changes;
}

/**
 * Inserts a single QuotationActivity row of kind FIELD_CHANGE summarising the
 * given field-level changes. No-op when `changes` is empty.
 */
export async function recordQuotationFieldChanges(
  tx: Tx,
  params: {
    quotationId: string;
    userId: string | null;
    /** Human label for the entity that was edited (e.g. "RFQ", "Line", "Supplier offer (Acme / SEA)"). */
    entity: string;
    /** Optional id of the sub-entity (line id, supplier offer id, …). */
    entityId?: string | null;
    changes: FieldChange[];
  },
): Promise<void> {
  if (params.changes.length === 0) return;
  const fieldList = params.changes.map((c) => c.field).join(", ");
  await tx.quotationActivity.create({
    data: {
      quotationId: params.quotationId,
      userId: params.userId,
      kind: QuotationActivityKind.FIELD_CHANGE,
      note: `Updated ${params.entity}: ${fieldList}`,
      meta: JSON.stringify({
        entity: params.entity,
        entityId: params.entityId ?? null,
        changes: params.changes.map((c) => ({
          field: c.field,
          from: serializeValue(c.from),
          to: serializeValue(c.to),
        })),
      }),
    },
  });
}

function serializeValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  return value;
}
