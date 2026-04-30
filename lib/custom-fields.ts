export const CustomFieldEntity = {
  CUSTOMER: "CUSTOMER",
  CONTACT: "CONTACT",
  LEAD: "LEAD",
  ORDER: "ORDER",
  SHIPMENT: "SHIPMENT",
  INVOICE: "INVOICE",
  DRIVER: "DRIVER",
  VEHICLE: "VEHICLE",
} as const;

export type CustomFieldEntity =
  (typeof CustomFieldEntity)[keyof typeof CustomFieldEntity];

export const customFieldEntities = Object.values(CustomFieldEntity);

export const CustomFieldType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  DATE: "DATE",
  BOOLEAN: "BOOLEAN",
  DROPDOWN: "DROPDOWN",
  MULTI_SELECT: "MULTI_SELECT",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  URL: "URL",
  CURRENCY: "CURRENCY",
  FILE: "FILE",
} as const;

export type CustomFieldType =
  (typeof CustomFieldType)[keyof typeof CustomFieldType];

export const customFieldTypes = Object.values(CustomFieldType);

export type CustomFieldOption = {
  label: string;
  value: string;
};

export type CustomFieldValidation = {
  min?: number;
  max?: number;
  regex?: string;
};

export type CustomFieldDefinitionInput = {
  entityType: CustomFieldEntity;
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  defaultValue?: string;
  helpText?: string;
  placeholder?: string;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  sortOrder?: number;
  isActive?: boolean;
};

export type CustomFieldDefinitionView = CustomFieldDefinitionInput & {
  id: string;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type CustomFieldValueMap = Record<string, unknown>;

export function normalizeCustomFieldKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function parseOptions(json?: string | null): CustomFieldOption[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        label: String(item?.label ?? item?.value ?? "").trim(),
        value: String(item?.value ?? item?.label ?? "").trim(),
      }))
      .filter((item) => item.label && item.value);
  } catch {
    return [];
  }
}

export function parseValidation(json?: string | null): CustomFieldValidation {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return {
      min: typeof parsed?.min === "number" ? parsed.min : undefined,
      max: typeof parsed?.max === "number" ? parsed.max : undefined,
      regex: typeof parsed?.regex === "string" ? parsed.regex : undefined,
    };
  } catch {
    return {};
  }
}

export function serializeValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function parseValue(json?: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

export function coerceCustomFieldValue(
  type: CustomFieldType,
  raw: FormDataEntryValue | FormDataEntryValue[] | null | undefined,
) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter(Boolean);
  }
  const value = raw == null ? "" : String(raw).trim();

  if (type === CustomFieldType.BOOLEAN) return value === "on" || value === "true";
  if (type === CustomFieldType.NUMBER || type === CustomFieldType.CURRENCY) {
    return value === "" ? null : Number(value);
  }
  if (type === CustomFieldType.MULTI_SELECT) {
    return value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
  }
  return value || null;
}

export function validateCustomFieldValue(
  definition: Pick<
    CustomFieldDefinitionView,
    "label" | "type" | "required" | "options" | "validation"
  >,
  value: unknown,
) {
  const empty =
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (definition.required && empty) {
    return `${definition.label} is required`;
  }
  if (empty) return null;

  if (
    (definition.type === CustomFieldType.NUMBER ||
      definition.type === CustomFieldType.CURRENCY) &&
    Number.isNaN(Number(value))
  ) {
    return `${definition.label} must be a number`;
  }
  if (definition.type === CustomFieldType.EMAIL && !/^\S+@\S+\.\S+$/.test(String(value))) {
    return `${definition.label} must be a valid email`;
  }
  if (definition.type === CustomFieldType.URL) {
    try {
      new URL(String(value));
    } catch {
      return `${definition.label} must be a valid URL`;
    }
  }
  if (definition.validation?.regex) {
    try {
      if (!new RegExp(definition.validation.regex).test(String(value))) {
        return `${definition.label} has invalid format`;
      }
    } catch {
      return `${definition.label} has invalid validation regex`;
    }
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (definition.validation?.min != null && numeric < definition.validation.min) {
      return `${definition.label} must be at least ${definition.validation.min}`;
    }
    if (definition.validation?.max != null && numeric > definition.validation.max) {
      return `${definition.label} must be at most ${definition.validation.max}`;
    }
  }
  return null;
}

export function formatCustomFieldValue(
  type: CustomFieldType,
  value: unknown,
  currency = "USD",
) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return "—";
  }
  if (type === CustomFieldType.BOOLEAN) return value ? "Yes" : "No";
  if (type === CustomFieldType.MULTI_SELECT && Array.isArray(value)) {
    return value.join(", ");
  }
  if (type === CustomFieldType.CURRENCY) {
    return `${currency} ${Number(value ?? 0).toFixed(2)}`;
  }
  return String(value);
}
