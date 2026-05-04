"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import {
  getEffectiveFields,
  importEntitySlugs,
  type EffectiveField,
  type ImportEntitySlug,
} from "@/lib/import/registry";

const entitySchema = z.enum(importEntitySlugs as [ImportEntitySlug, ...ImportEntitySlug[]]);

const setRequiredSchema = z.object({
  entity: entitySchema,
  fieldKey: z.string().min(1).max(80),
  required: z.boolean(),
});

/**
 * Admin-only: list every effective field (built-in + custom) for an entity
 * along with its current required state. Used by the Settings → Import UI.
 */
export async function getImportConfig(entity: ImportEntitySlug): Promise<{
  entity: ImportEntitySlug;
  fields: EffectiveField[];
}> {
  const { orgId } = await requireRole(["ADMIN"]);
  const slug = entitySchema.parse(entity);
  const fields = await getEffectiveFields(orgId, slug);
  return { entity: slug, fields };
}

/**
 * Admin-only: upsert an `ImportFieldConfig` row that overrides the default
 * required state for the given (entity, fieldKey). Setting `required` back
 * to its default still keeps a row — that's intentional so the override is
 * "sticky" across changes to the built-in registry / custom fields.
 */
export async function setFieldRequired(input: {
  entity: ImportEntitySlug;
  fieldKey: string;
  required: boolean;
}) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = setRequiredSchema.parse(input);

  await prisma.importFieldConfig.upsert({
    where: {
      orgId_entityType_fieldKey: {
        orgId,
        entityType: data.entity === "customers" ? "CUSTOMER" : "ORDER",
        fieldKey: data.fieldKey,
      },
    },
    create: {
      orgId,
      entityType: data.entity === "customers" ? "CUSTOMER" : "ORDER",
      fieldKey: data.fieldKey,
      required: data.required,
    },
    update: { required: data.required },
  });

  await audit({
    action: "import.setRequired",
    entity: "ImportFieldConfig",
    orgId,
    userId: session.user.id,
    meta: { entity: data.entity, fieldKey: data.fieldKey, required: data.required },
  });

  revalidatePath("/settings");
  return { ok: true };
}
