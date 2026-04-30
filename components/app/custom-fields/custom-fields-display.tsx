import {
  formatCustomFieldValue,
  type CustomFieldDefinitionView,
  type CustomFieldValueMap,
} from "@/lib/custom-fields";

export function CustomFieldsDisplay({
  definitions,
  values = {},
  currency = "USD",
}: {
  definitions: CustomFieldDefinitionView[];
  values?: CustomFieldValueMap;
  currency?: string;
}) {
  if (definitions.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Custom fields</h3>
      </div>
      <dl className="grid gap-0 sm:grid-cols-2">
        {definitions.map((definition) => (
          <div key={definition.id} className="border-b px-4 py-3 last:border-b-0 sm:odd:border-r">
            <dt className="text-xs font-medium text-muted-foreground">{definition.label}</dt>
            <dd className="mt-1 text-sm">
              {formatCustomFieldValue(definition.type, values[definition.key], currency)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
