import { prisma } from "@/lib/db";
import {
  CustomFieldType,
  type CustomFieldDefinitionView,
  type CustomFieldEntity,
} from "@/lib/custom-fields";
import { getCustomFieldDefinitions } from "@/app/[locale]/(dashboard)/settings/custom-fields/actions";
import { CustomerStatus, OrderStatus } from "@/lib/enums";

/**
 * The set of entities the importer supports. Each value maps 1:1 to a
 * `CustomFieldEntity` so that custom-field definitions for the same entity
 * are automatically merged into the importer.
 */
export const ImportEntity = {
  customers: "CUSTOMER",
  orders: "ORDER",
} as const;

export type ImportEntitySlug = keyof typeof ImportEntity;

export const importEntitySlugs = Object.keys(ImportEntity) as ImportEntitySlug[];

/**
 * The shape used by both the template builder and the upload validator.
 * Built-in fields are statically declared (their handlers live in the import
 * route); custom fields are loaded at request-time from
 * `CustomFieldDefinition` rows so adding a new one in Settings makes it
 * available immediately.
 */
export type FieldType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "enum";

export type BuiltinField = {
  key: string;
  label: string;
  type: FieldType;
  /** Allowed values when `type === "enum"`. */
  enumValues?: readonly string[];
  /** Required by default (e.g. Customer.name). Can be overridden per-org. */
  defaultRequired: boolean;
  /** A short example to put in the template's first data row. */
  example?: string | number;
};

export type EffectiveField = {
  key: string;
  label: string;
  type: FieldType;
  enumValues?: readonly string[];
  required: boolean;
  source: "builtin" | "custom";
  /** Present only when `source === "custom"`. */
  definition?: CustomFieldDefinitionView;
  example?: string | number;
};

const CUSTOMER_STATUS_VALUES = Object.values(CustomerStatus);
const ORDER_STATUS_VALUES = [
  OrderStatus.QUOTE,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PROGRESS,
] as const;

/**
 * Mirrors the new-customer dialog form fields. Required defaults follow the
 * customerSchema in customers/actions.ts (`name` is the only required field).
 */
const CUSTOMER_FIELDS: BuiltinField[] = [
  { key: "name", label: "Name", type: "string", defaultRequired: true, example: "Acme Logistics" },
  { key: "code", label: "Code", type: "string", defaultRequired: false, example: "CUS-001" },
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumValues: CUSTOMER_STATUS_VALUES,
    defaultRequired: false,
    example: CustomerStatus.PROSPECT,
  },
  { key: "email", label: "Email", type: "string", defaultRequired: false, example: "ops@acme.com" },
  { key: "phone", label: "Phone", type: "string", defaultRequired: false, example: "+1 555 0100" },
  { key: "taxId", label: "Tax ID", type: "string", defaultRequired: false, example: "TAX-123" },
  { key: "address", label: "Address", type: "string", defaultRequired: false, example: "12 Main St" },
  { key: "city", label: "City", type: "string", defaultRequired: false, example: "Tbilisi" },
  { key: "country", label: "Country", type: "string", defaultRequired: false, example: "GE" },
  { key: "creditLimit", label: "Credit Limit", type: "number", defaultRequired: false, example: 0 },
  { key: "notes", label: "Notes", type: "string", defaultRequired: false, example: "" },
];

/**
 * Mirrors the new-order dialog. Customer linking happens by Code (per the
 * import design) instead of the internal cuid `customerId`.
 *
 * Pickup/dropoff fields drive the initial Shipment + Stops created alongside
 * the Order in `createOrder` (orders/actions.ts).
 */
const ORDER_FIELDS: BuiltinField[] = [
  {
    key: "customerCode",
    label: "Customer Code",
    type: "string",
    defaultRequired: true,
    example: "CUS-001",
  },
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumValues: ORDER_STATUS_VALUES,
    defaultRequired: false,
    example: OrderStatus.QUOTE,
  },
  { key: "reference", label: "Reference", type: "string", defaultRequired: false, example: "PO-9001" },
  { key: "price", label: "Price", type: "number", defaultRequired: false, example: 0 },
  { key: "currency", label: "Currency", type: "string", defaultRequired: false, example: "USD" },
  { key: "notes", label: "Notes", type: "string", defaultRequired: false, example: "" },
];

export const BUILTIN_FIELDS: Record<ImportEntitySlug, BuiltinField[]> = {
  customers: CUSTOMER_FIELDS,
  orders: ORDER_FIELDS,
};

/** Map a `CustomFieldType` to the importer's simpler `FieldType`. */
function mapCustomType(type: CustomFieldType): FieldType {
  switch (type) {
    case CustomFieldType.NUMBER:
    case CustomFieldType.CURRENCY:
      return "number";
    case CustomFieldType.DATE:
      return "date";
    case CustomFieldType.BOOLEAN:
      return "boolean";
    case CustomFieldType.DROPDOWN:
    case CustomFieldType.MULTI_SELECT:
      return "enum";
    default:
      // TEXT, EMAIL, PHONE, URL, FILE all serialize to plain strings.
      return "string";
  }
}

/**
 * Resolve the full set of fields the importer should accept for the given
 * entity, merging built-in columns with any active CustomFieldDefinition
 * rows for the org. Required state is overridden by ImportFieldConfig when
 * a row exists.
 */
export async function getEffectiveFields(
  orgId: string,
  entitySlug: ImportEntitySlug,
): Promise<EffectiveField[]> {
  const entityType = ImportEntity[entitySlug] as CustomFieldEntity;

  const [overrides, customDefs] = await Promise.all([
    prisma.importFieldConfig.findMany({
      where: { orgId, entityType },
      select: { fieldKey: true, required: true },
    }),
    getCustomFieldDefinitions(orgId, entityType),
  ]);

  const overrideMap = new Map(overrides.map((row) => [row.fieldKey, row.required]));

  const fields: EffectiveField[] = [];

  for (const builtin of BUILTIN_FIELDS[entitySlug]) {
    const override = overrideMap.get(builtin.key);
    fields.push({
      key: builtin.key,
      label: builtin.label,
      type: builtin.type,
      enumValues: builtin.enumValues,
      required: override ?? builtin.defaultRequired,
      source: "builtin",
      example: builtin.example,
    });
  }

  for (const def of customDefs) {
    const fieldKey = `cf_${def.key}`;
    const override = overrideMap.get(fieldKey);
    const enumValues =
      def.type === CustomFieldType.DROPDOWN || def.type === CustomFieldType.MULTI_SELECT
        ? def.options?.map((opt) => opt.value)
        : undefined;
    fields.push({
      key: fieldKey,
      label: def.label,
      type: mapCustomType(def.type),
      enumValues,
      required: override ?? def.required,
      source: "custom",
      definition: def,
    });
  }

  return fields;
}

/** Slugify the imported header so users can use any casing/spacing. */
export function normalizeHeader(header: string): string {
  return header
    .replace(/\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
