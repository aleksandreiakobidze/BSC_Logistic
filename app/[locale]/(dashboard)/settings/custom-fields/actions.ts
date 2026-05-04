"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import {
  CustomFieldType,
  customFieldEntities,
  customFieldTypes,
  coerceCustomFieldValue,
  normalizeCustomFieldKey,
  parseOptions,
  parseValidation,
  parseValue,
  serializeValue,
  validateCustomFieldValue,
  type CustomFieldDefinitionView,
  type CustomFieldEntity,
  type CustomFieldGroupView,
  type CustomFieldOption,
} from "@/lib/custom-fields";

const ALLOWED_WIDTHS = [3, 4, 6, 12] as const;

const definitionSchema = z.object({
  id: z.string().optional(),
  entityType: z.string().refine((v) => customFieldEntities.includes(v as CustomFieldEntity)),
  key: z.string().min(1).max(48),
  label: z.string().min(1).max(80),
  type: z.string().refine((v) => customFieldTypes.includes(v as CustomFieldType)),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    regex: z.string().optional(),
  }).default({}),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  groupKey: z.string().max(48).optional().nullable(),
  width: z
    .number()
    .int()
    .refine((v) => ALLOWED_WIDTHS.includes(v as (typeof ALLOWED_WIDTHS)[number]))
    .default(12),
  showInList: z.boolean().default(false),
  multiline: z.boolean().default(false),
});

type DefinitionPayload = z.infer<typeof definitionSchema>;

function needsOptions(type: string) {
  return type === CustomFieldType.DROPDOWN || type === CustomFieldType.MULTI_SELECT;
}

function cleanOptions(options: CustomFieldOption[]) {
  return options
    .map((option) => ({
      label: option.label.trim(),
      value: normalizeCustomFieldKey(option.value || option.label),
    }))
    .filter((option) => option.label && option.value);
}

function toDefinitionView(definition: {
  id: string;
  entityType: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  helpText: string | null;
  placeholder: string | null;
  optionsJson: string | null;
  validationJson: string | null;
  sortOrder: number;
  isActive: boolean;
  groupKey?: string | null;
  width?: number | null;
  showInList?: boolean | null;
  multiline?: boolean | null;
}): CustomFieldDefinitionView {
  const width = definition.width ?? 12;
  return {
    id: definition.id,
    entityType: definition.entityType as CustomFieldEntity,
    key: definition.key,
    label: definition.label,
    type: definition.type as CustomFieldType,
    required: definition.required,
    defaultValue: definition.defaultValue ?? undefined,
    helpText: definition.helpText ?? undefined,
    placeholder: definition.placeholder ?? undefined,
    options: parseOptions(definition.optionsJson),
    validation: parseValidation(definition.validationJson),
    sortOrder: definition.sortOrder,
    isActive: definition.isActive,
    groupKey: definition.groupKey ?? null,
    width: ALLOWED_WIDTHS.includes(width as (typeof ALLOWED_WIDTHS)[number]) ? width : 12,
    showInList: !!definition.showInList,
    multiline: !!definition.multiline,
  };
}

function prepareDefinition(payload: DefinitionPayload) {
  const key = normalizeCustomFieldKey(payload.key);
  const options = cleanOptions(payload.options);
  if (!key) throw new Error("Invalid field key");
  if (needsOptions(payload.type) && options.length === 0) {
    throw new Error("Dropdown fields require at least one option");
  }

  return {
    entityType: payload.entityType,
    key,
    label: payload.label.trim(),
    type: payload.type,
    required: payload.required,
    defaultValue: payload.defaultValue?.trim() || null,
    helpText: payload.helpText?.trim() || null,
    placeholder: payload.placeholder?.trim() || null,
    optionsJson: options.length ? JSON.stringify(options) : null,
    validationJson: Object.keys(payload.validation).length
      ? JSON.stringify(payload.validation)
      : null,
    sortOrder: payload.sortOrder,
    isActive: payload.isActive,
    groupKey: payload.groupKey?.trim() || null,
    width: payload.width,
    showInList: payload.showInList,
    multiline: payload.type === CustomFieldType.TEXT ? payload.multiline : false,
  };
}

export async function getCustomFieldDefinitions(
  orgId: string,
  entityType: CustomFieldEntity,
  includeInactive = false,
) {
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { orgId, entityType, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return definitions.map(toDefinitionView);
}

export async function getCustomFieldValues(
  orgId: string,
  entityType: CustomFieldEntity,
  recordId: string,
) {
  const rows = await prisma.customFieldValue.findMany({
    where: { orgId, entityType, recordId },
    include: { definition: true },
  });
  return Object.fromEntries(
    rows.map((row) => [row.definition.key, parseValue(row.valueJson)]),
  );
}

export async function listCustomFieldDefinitions(entityType: CustomFieldEntity) {
  const { orgId } = await requireRole(["ADMIN"]);
  return getCustomFieldDefinitions(orgId, entityType, true);
}

export async function createCustomFieldDefinition(payload: DefinitionPayload) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const parsed = definitionSchema.parse(payload);
  const data = prepareDefinition(parsed);

  const definition = await prisma.customFieldDefinition.create({
    data: { orgId, ...data },
  });
  await audit({
    action: "customField.definition.create",
    entity: "CustomFieldDefinition",
    entityId: definition.id,
    orgId,
    userId: session.user.id,
    meta: { entityType: data.entityType, key: data.key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true, definition: toDefinitionView(definition) };
}

export async function updateCustomFieldDefinition(payload: DefinitionPayload) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const parsed = definitionSchema.extend({ id: z.string().min(1) }).parse(payload);
  const data = prepareDefinition(parsed);

  const definition = await prisma.customFieldDefinition.update({
    where: { id: parsed.id, orgId },
    data,
  });
  await audit({
    action: "customField.definition.update",
    entity: "CustomFieldDefinition",
    entityId: definition.id,
    orgId,
    userId: session.user.id,
    meta: { entityType: data.entityType, key: data.key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true, definition: toDefinitionView(definition) };
}

export async function archiveCustomFieldDefinition(id: string) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const definition = await prisma.customFieldDefinition.update({
    where: { id, orgId },
    data: { isActive: false },
  });
  await audit({
    action: "customField.definition.archive",
    entity: "CustomFieldDefinition",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { entityType: definition.entityType, key: definition.key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

export async function reorderCustomFieldDefinitions(ids: string[]) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.customFieldDefinition.update({
        where: { id, orgId },
        data: { sortOrder: index },
      }),
    ),
  );
  await audit({
    action: "customField.definition.reorder",
    entity: "CustomFieldDefinition",
    orgId,
    userId: session.user.id,
    meta: { ids },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

// ─── Custom field groups ────────────────────────────────────────────────────

const groupSchema = z.object({
  id: z.string().optional(),
  entityType: z
    .string()
    .refine((v) => customFieldEntities.includes(v as CustomFieldEntity)),
  key: z.string().min(1).max(48),
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().default(0),
});

function toGroupView(g: {
  id: string;
  entityType: string;
  key: string;
  label: string;
  sortOrder: number;
}): CustomFieldGroupView {
  return {
    id: g.id,
    entityType: g.entityType as CustomFieldEntity,
    key: g.key,
    label: g.label,
    sortOrder: g.sortOrder,
  };
}

export async function getCustomFieldGroups(
  orgId: string,
  entityType: CustomFieldEntity,
): Promise<CustomFieldGroupView[]> {
  const rows = await prisma.customFieldGroup.findMany({
    where: { orgId, entityType },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toGroupView);
}

export async function listCustomFieldGroups(entityType: CustomFieldEntity) {
  const { orgId } = await requireRole(["ADMIN"]);
  return getCustomFieldGroups(orgId, entityType);
}

export async function createCustomFieldGroup(
  payload: z.input<typeof groupSchema>,
) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const parsed = groupSchema.parse(payload);
  const key = normalizeCustomFieldKey(parsed.key);
  if (!key) throw new Error("Invalid group key");
  const group = await prisma.customFieldGroup.create({
    data: {
      orgId,
      entityType: parsed.entityType,
      key,
      label: parsed.label.trim(),
      sortOrder: parsed.sortOrder,
    },
  });
  await audit({
    action: "customField.group.create",
    entity: "CustomFieldGroup",
    entityId: group.id,
    orgId,
    userId: session.user.id,
    meta: { entityType: parsed.entityType, key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true, group: toGroupView(group) };
}

export async function updateCustomFieldGroup(
  payload: z.input<typeof groupSchema>,
) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const parsed = groupSchema.extend({ id: z.string().min(1) }).parse(payload);
  const group = await prisma.customFieldGroup.update({
    where: { id: parsed.id, orgId },
    data: {
      label: parsed.label.trim(),
      sortOrder: parsed.sortOrder,
    },
  });
  await audit({
    action: "customField.group.update",
    entity: "CustomFieldGroup",
    entityId: group.id,
    orgId,
    userId: session.user.id,
    meta: { entityType: parsed.entityType, key: group.key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true, group: toGroupView(group) };
}

export async function deleteCustomFieldGroup(id: string) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const existing = await prisma.customFieldGroup.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Group not found");

  // Reassign all defs in this group back to "Other" (null) instead of failing.
  await prisma.$transaction([
    prisma.customFieldDefinition.updateMany({
      where: { orgId, entityType: existing.entityType, groupKey: existing.key },
      data: { groupKey: null },
    }),
    prisma.customFieldGroup.delete({ where: { id } }),
  ]);

  await audit({
    action: "customField.group.delete",
    entity: "CustomFieldGroup",
    entityId: id,
    orgId,
    userId: session.user.id,
    meta: { entityType: existing.entityType, key: existing.key },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

export async function reorderCustomFieldGroups(ids: string[]) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.customFieldGroup.update({
        where: { id, orgId },
        data: { sortOrder: index },
      }),
    ),
  );
  await audit({
    action: "customField.group.reorder",
    entity: "CustomFieldGroup",
    orgId,
    userId: session.user.id,
    meta: { ids },
  });
  revalidatePath("/settings/custom-fields");
  return { ok: true };
}

export async function saveCustomFieldValues({
  orgId,
  entityType,
  recordId,
  formData,
}: {
  orgId: string;
  entityType: CustomFieldEntity;
  recordId: string;
  formData: FormData;
}) {
  const definitions = await getCustomFieldDefinitions(orgId, entityType);
  if (definitions.length === 0) return;

  const writes = [];
  for (const definition of definitions) {
    const fieldName = `cf_${definition.key}`;
    const raw =
      definition.type === CustomFieldType.MULTI_SELECT
        ? formData.getAll(fieldName)
        : formData.get(fieldName);
    const value = coerceCustomFieldValue(definition.type, raw);
    const error = validateCustomFieldValue(definition, value);
    if (error) throw new Error(error);

    writes.push(
      prisma.customFieldValue.upsert({
        where: {
          definitionId_recordId: {
            definitionId: definition.id,
            recordId,
          },
        },
        create: {
          orgId,
          definitionId: definition.id,
          entityType,
          recordId,
          valueJson: serializeValue(value),
        },
        update: { valueJson: serializeValue(value) },
      }),
    );
  }
  await prisma.$transaction(writes);
}
