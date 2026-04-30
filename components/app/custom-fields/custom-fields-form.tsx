"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CustomFieldType,
  type CustomFieldDefinitionView,
  type CustomFieldValueMap,
} from "@/lib/custom-fields";

function stringValue(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

export function CustomFieldsForm({
  definitions,
  values = {},
}: {
  definitions: CustomFieldDefinitionView[];
  values?: CustomFieldValueMap;
}) {
  if (definitions.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Custom fields</h3>
        <p className="text-xs text-muted-foreground">
          Additional information configured by administrators.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {definitions.map((definition) => {
          const name = `cf_${definition.key}`;
          const value = values[definition.key] ?? definition.defaultValue ?? "";
          const common = {
            name,
            required: definition.required,
            placeholder: definition.placeholder,
          };

          return (
            <div key={definition.id} className="space-y-1">
              <Label className="text-xs" htmlFor={name}>
                {definition.label}
                {definition.required && <span className="ml-1 text-destructive">*</span>}
              </Label>

              {definition.type === CustomFieldType.BOOLEAN ? (
                <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm">
                  <input
                    id={name}
                    name={name}
                    type="checkbox"
                    defaultChecked={Boolean(value)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Yes
                </label>
              ) : definition.type === CustomFieldType.DROPDOWN ? (
                <select
                  id={name}
                  name={name}
                  required={definition.required}
                  defaultValue={stringValue(value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select...</option>
                  {(definition.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : definition.type === CustomFieldType.MULTI_SELECT ? (
                <div className="space-y-1 rounded-xl border bg-background p-2">
                  {(definition.options ?? []).map((option) => {
                    const selected = Array.isArray(value)
                      ? value.includes(option.value)
                      : stringValue(value).split(",").includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <input
                          name={name}
                          type="checkbox"
                          value={option.value}
                          defaultChecked={selected}
                          className="h-4 w-4 rounded border-input"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              ) : definition.type === CustomFieldType.TEXT ? (
                <Textarea id={name} {...common} defaultValue={stringValue(value)} />
              ) : (
                <Input
                  id={name}
                  {...common}
                  type={
                    definition.type === CustomFieldType.NUMBER ||
                    definition.type === CustomFieldType.CURRENCY
                      ? "number"
                      : definition.type === CustomFieldType.DATE
                        ? "date"
                        : definition.type === CustomFieldType.EMAIL
                          ? "email"
                          : definition.type === CustomFieldType.URL
                            ? "url"
                            : "text"
                  }
                  defaultValue={stringValue(value)}
                />
              )}

              {definition.helpText && (
                <p className="text-xs text-muted-foreground">{definition.helpText}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
