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
  type CustomFieldOption,
} from "@/lib/custom-fields";

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
}): CustomFieldDefinitionView {
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
