"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EffectiveField, ImportEntitySlug } from "@/lib/import/registry";
import { getImportConfig, setFieldRequired } from "./actions";

type EntityState = {
  loading: boolean;
  fields: EffectiveField[];
  /** Field keys currently being mutated (disables their switch). */
  pending: Set<string>;
};

const ENTITY_LABELS: Record<ImportEntitySlug, string> = {
  customers: "Customers",
  orders: "Orders",
};

/**
 * Settings → Import section.
 *
 * Lists every effective field (built-in + active custom field) for each
 * importable entity, with a Switch to toggle whether it's required when
 * importing. Updates persist via the `setFieldRequired` server action and
 * therefore feed straight back into the importer + template generator.
 */
export function ImportSettings() {
  const [state, setState] = React.useState<Record<ImportEntitySlug, EntityState>>({
    customers: { loading: true, fields: [], pending: new Set() },
    orders: { loading: true, fields: [], pending: new Set() },
  });

  const loadEntity = React.useCallback(async (entity: ImportEntitySlug) => {
    setState((prev) => ({
      ...prev,
      [entity]: { ...prev[entity], loading: true },
    }));
    try {
      const res = await getImportConfig(entity);
      setState((prev) => ({
        ...prev,
        [entity]: { loading: false, fields: res.fields, pending: new Set() },
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load fields");
      setState((prev) => ({
        ...prev,
        [entity]: { ...prev[entity], loading: false },
      }));
    }
  }, []);

  React.useEffect(() => {
    loadEntity("customers");
    loadEntity("orders");
  }, [loadEntity]);

  async function onToggle(
    entity: ImportEntitySlug,
    fieldKey: string,
    next: boolean,
  ) {
    // Optimistic update with mutation guard.
    setState((prev) => {
      const pending = new Set(prev[entity].pending);
      pending.add(fieldKey);
      return {
        ...prev,
        [entity]: {
          ...prev[entity],
          pending,
          fields: prev[entity].fields.map((f) =>
            f.key === fieldKey ? { ...f, required: next } : f,
          ),
        },
      };
    });

    try {
      await setFieldRequired({ entity, fieldKey, required: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      // Revert on failure.
      setState((prev) => ({
        ...prev,
        [entity]: {
          ...prev[entity],
          fields: prev[entity].fields.map((f) =>
            f.key === fieldKey ? { ...f, required: !next } : f,
          ),
        },
      }));
    } finally {
      setState((prev) => {
        const pending = new Set(prev[entity].pending);
        pending.delete(fieldKey);
        return {
          ...prev,
          [entity]: { ...prev[entity], pending },
        };
      });
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3">
        <div className="text-[15px] font-semibold">Import</div>
        <div className="text-soft mt-0.5 text-[12.5px]">
          Toggle which fields must be present in the spreadsheet when importing.
          Custom fields added in <span className="font-medium">Custom fields</span> appear
          here automatically.
        </div>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList>
          {(Object.keys(ENTITY_LABELS) as ImportEntitySlug[]).map((slug) => (
            <TabsTrigger key={slug} value={slug}>
              {ENTITY_LABELS[slug]}
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(ENTITY_LABELS) as ImportEntitySlug[]).map((slug) => (
          <TabsContent key={slug} value={slug} className="mt-4">
            <FieldList
              entityState={state[slug]}
              onToggle={(key, next) => onToggle(slug, key, next)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FieldList({
  entityState,
  onToggle,
}: {
  entityState: EntityState;
  onToggle: (fieldKey: string, next: boolean) => void;
}) {
  if (entityState.loading) {
    return (
      <div className="text-soft flex items-center gap-2 py-6 text-[12.5px]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fields…
      </div>
    );
  }
  if (entityState.fields.length === 0) {
    return (
      <div className="text-soft py-6 text-center text-[12.5px]">
        No fields defined.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-app">
      <div className="surface-2 grid grid-cols-[1fr_auto_120px] gap-3 border-b border-app px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-dim">
        <span>Field</span>
        <span>Source</span>
        <span className="text-right">Required</span>
      </div>
      {entityState.fields.map((f) => {
        const isPending = entityState.pending.has(f.key);
        return (
          <div
            key={f.key}
            className="grid grid-cols-[1fr_auto_120px] items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: "hsl(var(--border-soft))" }}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{f.label}</div>
              <div className="text-dim font-mono text-[11px]">
                {f.key} · {f.type}
                {f.enumValues && f.enumValues.length > 0
                  ? ` · (${f.enumValues.join(" / ")})`
                  : ""}
              </div>
            </div>
            <div>
              {f.source === "custom" ? (
                <span className="pill" title="Defined in Settings → Custom fields">
                  <Sparkles className="h-2.5 w-2.5" /> Custom
                </span>
              ) : (
                <span className="pill">Built-in</span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                checked={f.required}
                disabled={isPending}
                onCheckedChange={(next) => onToggle(f.key, next)}
                aria-label={`Required: ${f.label}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
