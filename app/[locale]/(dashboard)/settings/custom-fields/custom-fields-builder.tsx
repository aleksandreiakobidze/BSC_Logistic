"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Copy, GripVertical, Plus, Save } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CustomFieldType,
  customFieldTypes,
  normalizeCustomFieldKey,
  type CustomFieldDefinitionView,
  type CustomFieldEntity,
  type CustomFieldOption,
  type CustomFieldType as CustomFieldTypeValue,
} from "@/lib/custom-fields";
import {
  archiveCustomFieldDefinition,
  createCustomFieldDefinition,
  reorderCustomFieldDefinitions,
  updateCustomFieldDefinition,
} from "./actions";

type Draft = CustomFieldDefinitionView & { isNew?: boolean };

const entityLabels: Record<string, string> = {
  CUSTOMER: "Customers",
  CONTACT: "Contacts",
  LEAD: "Leads",
  ORDER: "Orders",
  SHIPMENT: "Shipments",
  INVOICE: "Invoices",
  DRIVER: "Drivers",
  VEHICLE: "Vehicles",
};

const typeLabels: Record<string, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  BOOLEAN: "Yes / No",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multi-select",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  CURRENCY: "Currency",
  FILE: "File upload",
};

function defaultDraft(entityType: CustomFieldEntity): Draft {
  return {
    id: `new-${crypto.randomUUID()}`,
    entityType,
    key: "new_field",
    label: "New Field",
    type: CustomFieldType.TEXT,
    required: false,
    sortOrder: 0,
    isActive: true,
    options: [],
    validation: {},
    isNew: true,
  };
}

function FieldRow({
  field,
  selected,
  onSelect,
}: {
  field: Draft;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted",
        !field.isActive && "opacity-50",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{field.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {field.key} · {typeLabels[field.type]}
        </span>
      </span>
    </button>
  );
}

function OptionsEditor({
  value,
  onChange,
}: {
  value: CustomFieldOption[];
  onChange: (options: CustomFieldOption[]) => void;
}) {
  const text = value.map((opt) => `${opt.label}:${opt.value}`).join("\n");
  return (
    <div className="space-y-1">
      <Label className="text-xs">Options</Label>
      <Textarea
        value={text}
        onChange={(e) => {
          onChange(
            e.target.value
              .split("\n")
              .map((line) => {
                const [label, rawValue] = line.split(":");
                const cleanLabel = label?.trim() ?? "";
                return {
                  label: cleanLabel,
                  value: normalizeCustomFieldKey(rawValue?.trim() || cleanLabel),
                };
              })
              .filter((item) => item.label && item.value),
          );
        }}
        placeholder="VIP:vip&#10;Standard:standard"
        className="min-h-24 font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">One option per line: Label:value</p>
    </div>
  );
}

function PreviewInput({ field }: { field: Draft }) {
  return (
    <div className="space-y-1 rounded-xl border bg-background p-3">
      <Label className="text-xs">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.type === CustomFieldType.BOOLEAN ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch disabled />
          <span className="text-xs text-muted-foreground">Yes / No</span>
        </div>
      ) : field.type === CustomFieldType.DROPDOWN ? (
        <Select disabled>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={field.placeholder || "Select option"} />
          </SelectTrigger>
        </Select>
      ) : field.type === CustomFieldType.MULTI_SELECT ? (
        <Input disabled placeholder="Multi-select values" className="h-9" />
      ) : field.type === CustomFieldType.DATE ? (
        <Input disabled type="date" className="h-9" />
      ) : (
        <Input
          disabled
          type={
            field.type === CustomFieldType.NUMBER ||
            field.type === CustomFieldType.CURRENCY
              ? "number"
              : field.type === CustomFieldType.EMAIL
                ? "email"
                : field.type === CustomFieldType.URL
                  ? "url"
                  : "text"
          }
          placeholder={field.placeholder || field.defaultValue || ""}
          className="h-9"
        />
      )}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  );
}

export function CustomFieldsBuilder({
  entities,
  initialDefinitions,
}: {
  entities: CustomFieldEntity[];
  initialDefinitions: CustomFieldDefinitionView[];
}) {
  const router = useRouter();
  const [entityType, setEntityType] = useState<CustomFieldEntity>(entities[0]);
  const [fields, setFields] = useState<Draft[]>(
    initialDefinitions.filter((d) => d.isActive).map((d) => ({ ...d })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor));

  const entityFields = useMemo(
    () =>
      fields
        .filter((field) => field.entityType === entityType)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [fields, entityType],
  );
  const selected = entityFields.find((field) => field.id === selectedId) ?? entityFields[0] ?? null;

  function patchSelected(patch: Partial<Draft>) {
    if (!selected) return;
    setFields((prev) =>
      prev.map((field) =>
        field.id === selected.id
          ? {
              ...field,
              ...patch,
              key:
                patch.label && (!patch.key || patch.key === field.key)
                  ? normalizeCustomFieldKey(patch.label)
                  : patch.key ?? field.key,
            }
          : field,
      ),
    );
  }

  function addField() {
    const draft = {
      ...defaultDraft(entityType),
      sortOrder: entityFields.length,
    };
    setFields((prev) => [...prev, draft]);
    setSelectedId(draft.id);
  }

  function duplicateField() {
    if (!selected) return;
    const draft = {
      ...selected,
      id: `new-${crypto.randomUUID()}`,
      key: `${selected.key}_copy`,
      label: `${selected.label} Copy`,
      sortOrder: entityFields.length,
      isNew: true,
    };
    setFields((prev) => [...prev, draft]);
    setSelectedId(draft.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entityFields.findIndex((field) => field.id === active.id);
    const newIndex = entityFields.findIndex((field) => field.id === over.id);
    const reordered = arrayMove(entityFields, oldIndex, newIndex).map((field, index) => ({
      ...field,
      sortOrder: index,
    }));
    setFields((prev) => [
      ...prev.filter((field) => field.entityType !== entityType),
      ...reordered,
    ]);
    startTransition(async () => {
      await reorderCustomFieldDefinitions(reordered.filter((field) => !field.isNew).map((field) => field.id));
      router.refresh();
    });
  }

  function saveField() {
    if (!selected) return;
    startTransition(async () => {
      try {
        const payload = {
          ...selected,
          key: normalizeCustomFieldKey(selected.key),
          type: selected.type as CustomFieldTypeValue,
          options: selected.options ?? [],
          validation: selected.validation ?? {},
        };
        const res = selected.isNew
          ? await createCustomFieldDefinition(payload)
          : await updateCustomFieldDefinition(payload);
        setFields((prev) =>
          prev.map((field) =>
            field.id === selected.id ? { ...res.definition, isNew: false } : field,
          ),
        );
        setSelectedId(res.definition.id);
        toast.success("Custom field saved.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save custom field.");
      }
    });
  }

  function archiveField() {
    if (!selected) return;
    startTransition(async () => {
      if (selected.isNew) {
        setFields((prev) => prev.filter((field) => field.id !== selected.id));
        setSelectedId(null);
        return;
      }
      await archiveCustomFieldDefinition(selected.id);
      setFields((prev) => prev.filter((field) => field.id !== selected.id));
      setSelectedId(null);
      toast.success("Custom field archived.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_320px]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm">Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <Select value={entityType} onValueChange={(v) => {
            setEntityType(v as CustomFieldEntity);
            setSelectedId(null);
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {entityLabels[entity]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="w-full gap-2" onClick={addField}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entityFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {entityFields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    selected={selected?.id === field.id}
                    onSelect={() => setSelectedId(field.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {entityFields.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No custom fields yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm">Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {entityFields.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Add fields to preview the form users will see.
            </div>
          ) : (
            entityFields.map((field) => <PreviewInput key={field.id} field={field} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm">Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a field to edit its settings.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={selected.label} onChange={(e) => patchSelected({ label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input value={selected.key} onChange={(e) => patchSelected({ key: normalizeCustomFieldKey(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={selected.type} onValueChange={(v) => patchSelected({ type: v as CustomFieldTypeValue })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customFieldTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {typeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label className="text-xs">Required</Label>
                  <p className="text-xs text-muted-foreground">Users must provide a value.</p>
                </div>
                <Switch checked={selected.required} onCheckedChange={(v) => patchSelected({ required: v })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Placeholder</Label>
                <Input value={selected.placeholder ?? ""} onChange={(e) => patchSelected({ placeholder: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default value</Label>
                <Input value={selected.defaultValue ?? ""} onChange={(e) => patchSelected({ defaultValue: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Help text</Label>
                <Textarea value={selected.helpText ?? ""} onChange={(e) => patchSelected({ helpText: e.target.value })} />
              </div>
              {(selected.type === CustomFieldType.DROPDOWN || selected.type === CustomFieldType.MULTI_SELECT) && (
                <OptionsEditor
                  value={selected.options ?? []}
                  onChange={(options) => patchSelected({ options })}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    value={selected.validation?.min ?? ""}
                    onChange={(e) => patchSelected({ validation: { ...selected.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    value={selected.validation?.max ?? ""}
                    onChange={(e) => patchSelected({ validation: { ...selected.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Regex validation</Label>
                <Input value={selected.validation?.regex ?? ""} onChange={(e) => patchSelected({ validation: { ...selected.validation, regex: e.target.value || undefined } })} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button type="button" onClick={saveField} disabled={isPending} className="col-span-2 gap-2">
                  <Save className="h-4 w-4" /> Save
                </Button>
                <Button type="button" variant="outline" onClick={duplicateField} className="gap-2">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="destructive" onClick={archiveField} className="col-span-3 gap-2">
                  <Archive className="h-4 w-4" /> Archive
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
