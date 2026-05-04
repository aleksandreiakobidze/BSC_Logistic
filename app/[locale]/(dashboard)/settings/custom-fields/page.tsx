import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import {
  customFieldEntities,
  parseOptions,
  parseValidation,
  type CustomFieldDefinitionView,
  type CustomFieldEntity,
  type CustomFieldGroupView,
  type CustomFieldType,
} from "@/lib/custom-fields";
import { CustomFieldsBuilder } from "./custom-fields-builder";

const ALLOWED_WIDTHS = new Set([3, 4, 6, 12]);

function toView(definition: {
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
  groupKey: string | null;
  width: number;
  showInList: boolean;
  multiline: boolean;
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
    groupKey: definition.groupKey,
    width: ALLOWED_WIDTHS.has(definition.width) ? definition.width : 12,
    showInList: definition.showInList,
    multiline: definition.multiline,
  };
}

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

export default async function CustomFieldsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { orgId } = await requireRole(["ADMIN"]);

  const [definitions, groups] = await Promise.all([
    prisma.customFieldDefinition.findMany({
      where: { orgId },
      orderBy: [
        { entityType: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    }),
    prisma.customFieldGroup.findMany({
      where: { orgId },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customFields.title")}
        description={t("customFields.description")}
      />
      <CustomFieldsBuilder
        entities={customFieldEntities}
        initialDefinitions={definitions.map(toView)}
        initialGroups={groups.map(toGroupView)}
      />
    </div>
  );
}
