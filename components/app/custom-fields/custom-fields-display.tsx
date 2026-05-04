"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Check,
  X as XIcon,
  ChevronDown,
  Mail,
  ExternalLink,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  CustomFieldType,
  type CustomFieldDefinitionView,
  type CustomFieldGroupView,
  type CustomFieldValueMap,
} from "@/lib/custom-fields";

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

type Bucket = {
  key: string;
  label: string;
  defs: CustomFieldDefinitionView[];
};

/**
 * Read-only display of custom field values. Groups by `groupKey`, hides empty
 * values by default (with a toggle to reveal), and renders type-aware:
 * mailto/url links, MULTI_SELECT chips, BOOLEAN check icons, formatted DATE,
 * formatted CURRENCY, and FILE download links.
 */
export function CustomFieldsDisplay({
  definitions,
  values = {},
  currency = "USD",
  groups = [],
}: {
  definitions: CustomFieldDefinitionView[];
  values?: CustomFieldValueMap;
  currency?: string;
  groups?: CustomFieldGroupView[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [hideEmpty, setHideEmpty] = React.useState(true);

  function tx(k: string, fb: string): string {
    return t.has(k) ? t(k) : fb;
  }

  if (definitions.length === 0) return null;

  const buckets = bucketize(definitions, groups, tx);
  const hasAnyValue = definitions.some((d) => !isEmpty(values[d.key]));
  if (!hasAnyValue && hideEmpty) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {tx("customFields.title", "Custom fields")}
          </h3>
          <button
            type="button"
            onClick={() => setHideEmpty(false)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            {tx("customFields.showEmpty", "Show empty fields")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tx("customFields.noValues", "No custom values entered yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setHideEmpty((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {hideEmpty ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {hideEmpty
            ? tx("customFields.showEmpty", "Show empty fields")
            : tx("customFields.hideEmpty", "Hide empty fields")}
        </button>
      </div>
      {buckets.map((bucket) => (
        <GroupSection
          key={bucket.key}
          bucket={bucket}
          values={values}
          currency={currency}
          locale={locale}
          hideEmpty={hideEmpty}
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
): Bucket[] {
  const labelByKey = new Map<string, string>();
  const orderByKey = new Map<string, number>();
  groups.forEach((g, i) => {
    labelByKey.set(g.key, g.label);
    orderByKey.set(g.key, i);
  });

  const map = new Map<string, Bucket>();
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

function GroupSection({
  bucket,
  values,
  currency,
  locale,
  hideEmpty,
  tx,
}: {
  bucket: Bucket;
  values: CustomFieldValueMap;
  currency: string;
  locale: string;
  hideEmpty: boolean;
  tx: (k: string, fb: string) => string;
}) {
  const [open, setOpen] = React.useState(true);
  const visibleDefs = hideEmpty
    ? bucket.defs.filter((d) => !isEmpty(values[d.key]))
    : bucket.defs;
  if (visibleDefs.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b bg-muted/30 px-4 py-2.5 text-left text-sm font-semibold"
      >
        <span>{bucket.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <dl className="grid gap-0 sm:grid-cols-2">
          {visibleDefs.map((definition) => (
            <div
              key={definition.id}
              className="border-b px-4 py-3 last:border-b-0 sm:odd:border-r"
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {definition.label}
              </dt>
              <dd className="mt-1 text-sm">
                <ValueRenderer
                  type={definition.type}
                  value={values[definition.key]}
                  options={definition.options ?? []}
                  currency={currency}
                  locale={locale}
                  tx={tx}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ValueRenderer({
  type,
  value,
  options,
  currency,
  locale,
  tx,
}: {
  type: string;
  value: unknown;
  options: { label: string; value: string }[];
  currency: string;
  locale: string;
  tx: (k: string, fb: string) => string;
}) {
  if (isEmpty(value)) {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (type) {
    case CustomFieldType.BOOLEAN:
      return value ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
          {tx("customFields.boolYes", "Yes")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XIcon className="h-3.5 w-3.5" />
          {tx("customFields.boolNo", "No")}
        </span>
      );
    case CustomFieldType.MULTI_SELECT: {
      const arr = Array.isArray(value) ? value.map(String) : [];
      const labels = new Map(options.map((o) => [o.value, o.label]));
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((v) => (
            <span
              key={v}
              className="rounded-full border bg-muted px-2 py-0.5 text-xs"
            >
              {labels.get(v) ?? v}
            </span>
          ))}
        </div>
      );
    }
    case CustomFieldType.DROPDOWN: {
      const labels = new Map(options.map((o) => [o.value, o.label]));
      return <span>{labels.get(String(value)) ?? String(value)}</span>;
    }
    case CustomFieldType.EMAIL:
      return (
        <a
          href={`mailto:${String(value)}`}
          className="inline-flex items-center gap-1 text-foreground underline"
        >
          <Mail className="h-3.5 w-3.5" />
          {String(value)}
        </a>
      );
    case CustomFieldType.URL:
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="truncate">{String(value)}</span>
        </a>
      );
    case CustomFieldType.FILE: {
      const url = String(value);
      const name = url.split("/").pop() ?? url;
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate">{name}</span>
        </a>
      );
    }
    case CustomFieldType.DATE: {
      try {
        return (
          <span>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(String(value)),
            )}
          </span>
        );
      } catch {
        return <span>{String(value)}</span>;
      }
    }
    case CustomFieldType.CURRENCY:
      return (
        <span className="font-mono">
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(Number(value))}
        </span>
      );
    case CustomFieldType.NUMBER:
      return <span className="font-mono">{String(value)}</span>;
    default:
      return (
        <span className="whitespace-pre-wrap break-words">{String(value)}</span>
      );
  }
}
