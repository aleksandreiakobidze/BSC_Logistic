"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Upload,
  X,
  Link as LinkIcon,
  FileText,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CustomFieldType,
  type CustomFieldDefinitionView,
  type CustomFieldGroupView,
  type CustomFieldValueMap,
} from "@/lib/custom-fields";

const ALLOWED_WIDTHS = new Set([3, 4, 6, 12]);

function widthToClass(width: number): string {
  // 12-col responsive grid; full width on mobile, requested width on sm+.
  switch (width) {
    case 3:
      return "sm:col-span-3";
    case 4:
      return "sm:col-span-4";
    case 6:
      return "sm:col-span-6";
    default:
      return "sm:col-span-12";
  }
}

function stringValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

type GroupBucket = {
  key: string;
  label: string;
  defs: CustomFieldDefinitionView[];
};

/**
 * Render every custom field definition for an entity as a form fragment. The
 * component groups fields by `groupKey` into collapsible cards (mapped to
 * friendly labels via the optional `groups` prop). All inputs use uncontrolled
 * `name="cf_<key>"` so the parent `<form>` continues to submit a regular
 * FormData payload to `saveCustomFieldValues`.
 *
 * Type-aware widgets cover BOOLEAN (Switch), MULTI_SELECT (chips), DATE,
 * PHONE/URL/EMAIL/CURRENCY (typed inputs), and FILE (uploads to `/api/uploads`
 * and stores the returned URL in a hidden input).
 */
export function CustomFieldsForm({
  definitions,
  values = {},
  groups = [],
  baseCurrency = "USD",
  defaultOpen = true,
}: {
  definitions: CustomFieldDefinitionView[];
  values?: CustomFieldValueMap;
  groups?: CustomFieldGroupView[];
  baseCurrency?: string;
  defaultOpen?: boolean;
}) {
  const t = useTranslations();
  if (definitions.length === 0) return null;

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  const buckets = bucketize(definitions, groups, (k, fb) => tx(k, fb));

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <GroupCard
          key={bucket.key}
          bucket={bucket}
          values={values}
          baseCurrency={baseCurrency}
          defaultOpen={defaultOpen}
          tx={tx}
        />
      ))}
    </div>
  );
}

function bucketize(
  definitions: CustomFieldDefinitionView[],
  groups: CustomFieldGroupView[],
  tx: (k: string, fb: string) => string,
): GroupBucket[] {
  const labelByKey = new Map<string, string>();
  const orderByKey = new Map<string, number>();
  groups.forEach((g, i) => {
    labelByKey.set(g.key, g.label);
    orderByKey.set(g.key, i);
  });

  const map = new Map<string, GroupBucket>();
  for (const def of definitions) {
    const k = def.groupKey ?? "__other";
    const label =
      def.groupKey == null
        ? tx("customFields.otherGroup", "More details")
        : (labelByKey.get(def.groupKey) ?? def.groupKey);
    if (!map.has(k)) map.set(k, { key: k, label, defs: [] });
    map.get(k)!.defs.push(def);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "__other" && b.key !== "__other") return 1;
    if (b.key === "__other" && a.key !== "__other") return -1;
    return (orderByKey.get(a.key) ?? 0) - (orderByKey.get(b.key) ?? 0);
  });
}

function GroupCard({
  bucket,
  values,
  baseCurrency,
  defaultOpen,
  tx,
}: {
  bucket: GroupBucket;
  values: CustomFieldValueMap;
  baseCurrency: string;
  defaultOpen: boolean;
  tx: (k: string, fb: string) => string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span>{bucket.label}</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="grid grid-cols-12 gap-3 pt-0">
          {bucket.defs.map((definition) => (
            <FieldCell
              key={definition.id}
              definition={definition}
              value={values[definition.key]}
              baseCurrency={baseCurrency}
              tx={tx}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function FieldCell({
  definition,
  value,
  baseCurrency,
  tx,
}: {
  definition: CustomFieldDefinitionView;
  value: unknown;
  baseCurrency: string;
  tx: (k: string, fb: string) => string;
}) {
  const name = `cf_${definition.key}`;
  const incoming = value ?? definition.defaultValue ?? "";
  const width = ALLOWED_WIDTHS.has(definition.width) ? definition.width : 12;

  return (
    <div className={`col-span-12 space-y-1.5 ${widthToClass(width)}`}>
      <Label className="text-xs" htmlFor={name}>
        {definition.label}
        {definition.required && (
          <span className="ml-1 text-destructive">*</span>
        )}
      </Label>
      {renderWidget(definition, name, incoming, baseCurrency, tx)}
      {definition.helpText && (
        <p className="text-xs text-muted-foreground">{definition.helpText}</p>
      )}
    </div>
  );
}

function renderWidget(
  definition: CustomFieldDefinitionView,
  name: string,
  value: unknown,
  baseCurrency: string,
  tx: (k: string, fb: string) => string,
) {
  const required = definition.required;
  const placeholder = definition.placeholder;

  switch (definition.type) {
    case CustomFieldType.BOOLEAN:
      return <BooleanField name={name} value={value} tx={tx} />;
    case CustomFieldType.DROPDOWN:
      return (
        <select
          id={name}
          name={name}
          required={required}
          defaultValue={stringValue(value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">
            {tx("customFields.dropdownPlaceholder", "Select...")}
          </option>
          {(definition.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case CustomFieldType.MULTI_SELECT:
      return <MultiSelectField name={name} value={value} definition={definition} tx={tx} />;
    case CustomFieldType.TEXT:
      if (definition.multiline) {
        return (
          <Textarea
            id={name}
            name={name}
            required={required}
            placeholder={placeholder}
            defaultValue={stringValue(value)}
            rows={3}
          />
        );
      }
      return (
        <Input
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={stringValue(value)}
          type="text"
        />
      );
    case CustomFieldType.NUMBER:
      return (
        <Input
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={stringValue(value)}
          type="number"
          step="any"
          inputMode="decimal"
        />
      );
    case CustomFieldType.CURRENCY:
      return (
        <div className="relative">
          <Input
            id={name}
            name={name}
            required={required}
            placeholder={placeholder}
            defaultValue={stringValue(value)}
            type="number"
            step="0.01"
            inputMode="decimal"
            className="pr-14"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {baseCurrency}
          </span>
        </div>
      );
    case CustomFieldType.DATE:
      return (
        <Input
          id={name}
          name={name}
          required={required}
          defaultValue={stringValue(value)}
          type="date"
        />
      );
    case CustomFieldType.EMAIL:
      return (
        <Input
          id={name}
          name={name}
          required={required}
          placeholder={placeholder ?? "name@example.com"}
          defaultValue={stringValue(value)}
          type="email"
          inputMode="email"
        />
      );
    case CustomFieldType.PHONE:
      return (
        <Input
          id={name}
          name={name}
          required={required}
          placeholder={placeholder ?? "+1 555 0100"}
          defaultValue={stringValue(value)}
          type="tel"
          inputMode="tel"
        />
      );
    case CustomFieldType.URL:
      return (
        <div className="relative">
          <Input
            id={name}
            name={name}
            required={required}
            placeholder={placeholder ?? "https://"}
            defaultValue={stringValue(value)}
            type="url"
            inputMode="url"
            className="pr-9"
          />
          <LinkIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      );
    case CustomFieldType.FILE:
      return <FileField name={name} value={value} required={required} tx={tx} />;
    default:
      return (
        <Input
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={stringValue(value)}
        />
      );
  }
}

function BooleanField({
  name,
  value,
  tx,
}: {
  name: string;
  value: unknown;
  tx: (k: string, fb: string) => string;
}) {
  const [checked, setChecked] = React.useState<boolean>(Boolean(value));
  return (
    <label className="flex h-10 items-center gap-3 rounded-xl border bg-background px-3 text-sm">
      <Switch checked={checked} onCheckedChange={setChecked} id={name} />
      <span className="text-muted-foreground">
        {checked
          ? tx("customFields.boolYes", "Yes")
          : tx("customFields.boolNo", "No")}
      </span>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </label>
  );
}

function MultiSelectField({
  name,
  value,
  definition,
  tx,
}: {
  name: string;
  value: unknown;
  definition: CustomFieldDefinitionView;
  tx: (k: string, fb: string) => string;
}) {
  const initial = React.useMemo(() => new Set(asArray(value)), [value]);
  const [selected, setSelected] = React.useState<Set<string>>(initial);

  function toggle(v: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl border bg-background p-2">
        {(definition.options ?? []).map((option) => {
          const active = selected.has(option.value);
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
        {(definition.options ?? []).length === 0 && (
          <span className="px-1 text-xs text-muted-foreground">
            {tx("customFields.noOptions", "No options configured")}
          </span>
        )}
      </div>
      {Array.from(selected).map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}

function FileField({
  name,
  value,
  required,
  tx,
}: {
  name: string;
  value: unknown;
  required: boolean;
  tx: (k: string, fb: string) => string;
}) {
  const [url, setUrl] = React.useState<string>(stringValue(value));
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function onPick(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
    } catch (err) {
      alert(
        tx("customFields.uploadError", "Upload failed") +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} required={required} />
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center gap-1.5 truncate text-xs text-foreground underline"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{url.split("/").pop()}</span>
          </a>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">
            {tx("customFields.noFile", "No file uploaded")}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-8 gap-1"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {url
            ? tx("customFields.replaceFile", "Replace")
            : tx("customFields.uploadFile", "Upload")}
        </Button>
        {url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setUrl("")}
            disabled={uploading}
            className="h-8 px-2"
            aria-label={tx("customFields.removeFile", "Remove file")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
