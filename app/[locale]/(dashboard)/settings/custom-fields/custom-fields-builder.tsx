"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  GripVertical,
  Plus,
  Save,
  FolderPlus,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CustomFieldType,
  customFieldTypes,
  normalizeCustomFieldKey,
  type CustomFieldDefinitionView,
  type CustomFieldEntity,
  type CustomFieldGroupView,
  type CustomFieldOption,
  type CustomFieldType as CustomFieldTypeValue,
} from "@/lib/custom-fields";
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import {
  archiveCustomFieldDefinition,
  createCustomFieldDefinition,
  createCustomFieldGroup,
  deleteCustomFieldGroup,
  reorderCustomFieldDefinitions,
  reorderCustomFieldGroups,
  updateCustomFieldDefinition,
  updateCustomFieldGroup,
} from "./actions";

type Draft = CustomFieldDefinitionView & { isNew?: boolean };
type GroupDraft = CustomFieldGroupView & { isNew?: boolean };

const ALLOWED_WIDTHS: Array<{ value: number; label: string; tx: string }> = [
  { value: 3, label: "1/4", tx: "customFields.widthQuarter" },
  { value: 4, label: "1/3", tx: "customFields.widthThird" },
  { value: 6, label: "1/2", tx: "customFields.widthHalf" },
  { value: 12, label: "Full", tx: "customFields.widthFull" },
];

const ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: "Customers",
  CONTACT: "Contacts",
  LEAD: "Leads",
  ORDER: "Orders",
  SHIPMENT: "Shipments",
  INVOICE: "Invoices",
  DRIVER: "Drivers",
  VEHICLE: "Vehicles",
};

const TYPE_LABELS: Record<string, string> = {
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

function defaultDraft(entityType: CustomFieldEntity, sortOrder = 0): Draft {
  return {
    id: `new-${crypto.randomUUID()}`,
    entityType,
    key: "new_field",
    label: "New Field",
    type: CustomFieldType.TEXT,
    required: false,
    sortOrder,
    isActive: true,
    options: [],
    validation: {},
    groupKey: null,
    width: 12,
    showInList: false,
    multiline: false,
    isNew: true,
  };
}

function FieldRow({
  field,
  selected,
  onSelect,
  groupLabel,
}: {
  field: Draft;
  selected: boolean;
  onSelect: () => void;
  groupLabel?: string;
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
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent hover:bg-muted",
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
        <span className="block truncate text-sm font-medium">
          {field.label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {field.key} · {TYPE_LABELS[field.type]}
          {groupLabel ? ` · ${groupLabel}` : ""}
        </span>
      </span>
      {field.showInList && (
        <span
          title="Shown in list"
          className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        >
          LIST
        </span>
      )}
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
                  value: normalizeCustomFieldKey(
                    rawValue?.trim() || cleanLabel,
                  ),
                };
              })
              .filter((item) => item.label && item.value),
          );
        }}
        placeholder="VIP:vip&#10;Standard:standard"
        className="min-h-24 font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        One option per line: Label:value
      </p>
    </div>
  );
}

export function CustomFieldsBuilder({
  entities,
  initialDefinitions,
  initialGroups,
}: {
  entities: CustomFieldEntity[];
  initialDefinitions: CustomFieldDefinitionView[];
  initialGroups: CustomFieldGroupView[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const [entityType, setEntityType] = useState<CustomFieldEntity>(entities[0]);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [fields, setFields] = useState<Draft[]>(
    initialDefinitions.map((d) => ({ ...d })),
  );
  const [groups, setGroups] = useState<GroupDraft[]>(
    initialGroups.map((g) => ({ ...g })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor));

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  const entityGroups = useMemo(
    () =>
      groups
        .filter((g) => g.entityType === entityType)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [groups, entityType],
  );

  const groupLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    entityGroups.forEach((g) => m.set(g.key, g.label));
    return m;
  }, [entityGroups]);

  const entityFields = useMemo(
    () =>
      fields
        .filter((field) => field.entityType === entityType)
        .filter((field) =>
          tab === "active" ? field.isActive : !field.isActive,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [fields, entityType, tab],
  );

  const selected =
    entityFields.find((field) => field.id === selectedId) ??
    entityFields[0] ??
    null;

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
                  : (patch.key ?? field.key),
            }
          : field,
      ),
    );
  }

  function addField() {
    const draft = {
      ...defaultDraft(entityType, entityFields.length),
    };
    setFields((prev) => [...prev, draft]);
    setSelectedId(draft.id);
    setTab("active");
  }

  function duplicateField() {
    if (!selected) return;
    const draft = {
      ...selected,
      id: `new-${crypto.randomUUID()}`,
      key: `${selected.key}_copy`,
      label: `${selected.label} Copy`,
      sortOrder: entityFields.length,
      isActive: true,
      isNew: true,
    };
    setFields((prev) => [...prev, draft]);
    setSelectedId(draft.id);
    setTab("active");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entityFields.findIndex((field) => field.id === active.id);
    const newIndex = entityFields.findIndex((field) => field.id === over.id);
    const reordered = arrayMove(entityFields, oldIndex, newIndex).map(
      (field, index) => ({
        ...field,
        sortOrder: index,
      }),
    );
    setFields((prev) => [
      ...prev.filter(
        (field) =>
          field.entityType !== entityType ||
          field.isActive !== (tab === "active"),
      ),
      ...reordered,
    ]);
    startTransition(async () => {
      await reorderCustomFieldDefinitions(
        reordered.filter((field) => !field.isNew).map((field) => field.id),
      );
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
            field.id === selected.id
              ? { ...res.definition, isNew: false }
              : field,
          ),
        );
        setSelectedId(res.definition.id);
        toast.success(tx("common.saved", "Saved"));
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : tx("common.saveFailed", "Failed to save"),
        );
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
      setFields((prev) =>
        prev.map((field) =>
          field.id === selected.id ? { ...field, isActive: false } : field,
        ),
      );
      setSelectedId(null);
      toast.success(tx("customFields.archived", "Field archived"));
      router.refresh();
    });
  }

  function restoreField() {
    if (!selected) return;
    startTransition(async () => {
      try {
        // Restore by toggling isActive back on through update.
        const res = await updateCustomFieldDefinition({
          ...selected,
          isActive: true,
          options: selected.options ?? [],
          validation: selected.validation ?? {},
        });
        setFields((prev) =>
          prev.map((field) =>
            field.id === selected.id
              ? { ...res.definition, isNew: false }
              : field,
          ),
        );
        toast.success(tx("customFields.restored", "Field restored"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to restore");
      }
    });
  }

  // ─── Group management ────────────────────────────────────────────────────

  async function addGroup() {
    const label = prompt(tx("customFields.groupNamePrompt", "Group name?"));
    if (!label) return;
    startTransition(async () => {
      try {
        const res = await createCustomFieldGroup({
          entityType,
          key: normalizeCustomFieldKey(label),
          label,
          sortOrder: entityGroups.length,
        });
        setGroups((prev) => [...prev, res.group]);
        toast.success(tx("customFields.groupCreated", "Group created"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  async function renameGroup(group: GroupDraft, newLabel: string) {
    startTransition(async () => {
      try {
        const res = await updateCustomFieldGroup({
          id: group.id,
          entityType: group.entityType,
          key: group.key,
          label: newLabel,
          sortOrder: group.sortOrder,
        });
        setGroups((prev) =>
          prev.map((g) => (g.id === group.id ? res.group : g)),
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  async function removeGroup(group: GroupDraft) {
    if (
      !confirm(
        tx(
          "customFields.deleteGroupConfirm",
          "Delete this group? Fields inside will be moved to 'Other'.",
        ),
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteCustomFieldGroup(group.id);
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        // Reassign in local state
        setFields((prev) =>
          prev.map((f) =>
            f.entityType === group.entityType && f.groupKey === group.key
              ? { ...f, groupKey: null }
              : f,
          ),
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entityGroups.findIndex((g) => g.id === active.id);
    const newIndex = entityGroups.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(entityGroups, oldIndex, newIndex).map(
      (g, index) => ({ ...g, sortOrder: index }),
    );
    setGroups((prev) => [
      ...prev.filter((g) => g.entityType !== entityType),
      ...reordered,
    ]);
    startTransition(async () => {
      await reorderCustomFieldGroups(reordered.map((g) => g.id));
      router.refresh();
    });
  }

  // Live preview uses the real CustomFieldsForm.
  const previewDefs = entityFields.filter((f) => f.isActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v as CustomFieldEntity);
            setSelectedId(null);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entities.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {ENTITY_LABELS[entity]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="active">
              {tx("customFields.tabActive", "Active")}
            </TabsTrigger>
            <TabsTrigger value="archived">
              {tx("customFields.tabArchived", "Archived")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_280px_1fr_320px]">
        {/* Groups */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="text-sm">
              {tx("customFields.groups", "Groups")}
            </CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addGroup}
              className="h-7 gap-1 px-2"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {tx("customFields.addGroup", "Add")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGroupDragEnd}
            >
              <SortableContext
                items={entityGroups.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                {entityGroups.map((g) => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    onRename={(label) => renameGroup(g, label)}
                    onDelete={() => removeGroup(g)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {tx(
                "customFields.otherGroup",
                "More details",
              )}{" "}
              <span className="opacity-70">
                ({tx("customFields.builtin", "built-in")})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Field list */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{tx("customFields.fields", "Fields")}</span>
              <Button
                type="button"
                size="sm"
                onClick={addField}
                className="h-7 gap-1 px-2"
              >
                <Plus className="h-3.5 w-3.5" />
                {tx("customFields.addField", "Add")}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entityFields.map((field) => field.id)}
                strategy={verticalListSortingStrategy}
              >
                {entityFields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    selected={selected?.id === field.id}
                    onSelect={() => setSelectedId(field.id)}
                    groupLabel={
                      field.groupKey
                        ? groupLabelByKey.get(field.groupKey)
                        : undefined
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
            {entityFields.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {tab === "active"
                  ? tx("customFields.empty", "No custom fields yet.")
                  : tx("customFields.emptyArchived", "No archived fields.")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live preview using the actual form component */}
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm">
              {tx("customFields.livePreview", "Live preview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {previewDefs.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {tx(
                  "customFields.previewEmpty",
                  "Add fields to preview the form users will see.",
                )}
              </div>
            ) : (
              <CustomFieldsForm
                definitions={previewDefs}
                groups={entityGroups}
              />
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm">
              {tx("customFields.editor", "Editor")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                {tx(
                  "customFields.selectHint",
                  "Select a field to edit its settings.",
                )}
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.label", "Label")}
                  </Label>
                  <Input
                    value={selected.label}
                    onChange={(e) =>
                      patchSelected({ label: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.key", "Key")}
                  </Label>
                  <Input
                    value={selected.key}
                    onChange={(e) =>
                      patchSelected({
                        key: normalizeCustomFieldKey(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.type", "Type")}
                  </Label>
                  <Select
                    value={selected.type}
                    onValueChange={(v) =>
                      patchSelected({ type: v as CustomFieldTypeValue })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customFieldTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {tx("customFields.group", "Group")}
                    </Label>
                    <Select
                      value={selected.groupKey ?? "__other"}
                      onValueChange={(v) =>
                        patchSelected({
                          groupKey: v === "__other" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__other">
                          {tx("customFields.otherGroup", "More details")}
                        </SelectItem>
                        {entityGroups.map((g) => (
                          <SelectItem key={g.id} value={g.key}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {tx("customFields.width", "Width")}
                    </Label>
                    <Select
                      value={String(selected.width)}
                      onValueChange={(v) =>
                        patchSelected({ width: Number(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOWED_WIDTHS.map((w) => (
                          <SelectItem key={w.value} value={String(w.value)}>
                            {tx(w.tx, w.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <ToggleRow
                    label={tx("customFields.required", "Required")}
                    description={tx(
                      "customFields.requiredDesc",
                      "Users must provide a value.",
                    )}
                    checked={selected.required}
                    onChange={(v) => patchSelected({ required: v })}
                  />
                  <ToggleRow
                    label={tx("customFields.showInList", "Show in list table")}
                    description={tx(
                      "customFields.showInListDesc",
                      "Suggests this field as a default column.",
                    )}
                    checked={selected.showInList}
                    onChange={(v) => patchSelected({ showInList: v })}
                  />
                  {selected.type === CustomFieldType.TEXT && (
                    <ToggleRow
                      label={tx("customFields.multiline", "Multiline text")}
                      description={tx(
                        "customFields.multilineDesc",
                        "Render as a textarea instead of a single-line input.",
                      )}
                      checked={selected.multiline}
                      onChange={(v) => patchSelected({ multiline: v })}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.placeholder", "Placeholder")}
                  </Label>
                  <Input
                    value={selected.placeholder ?? ""}
                    onChange={(e) =>
                      patchSelected({ placeholder: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.defaultValue", "Default value")}
                  </Label>
                  <Input
                    value={selected.defaultValue ?? ""}
                    onChange={(e) =>
                      patchSelected({ defaultValue: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {tx("customFields.helpText", "Help text")}
                  </Label>
                  <Textarea
                    value={selected.helpText ?? ""}
                    onChange={(e) =>
                      patchSelected({ helpText: e.target.value })
                    }
                  />
                </div>
                {(selected.type === CustomFieldType.DROPDOWN ||
                  selected.type === CustomFieldType.MULTI_SELECT) && (
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
                      onChange={(e) =>
                        patchSelected({
                          validation: {
                            ...selected.validation,
                            min: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max</Label>
                    <Input
                      type="number"
                      value={selected.validation?.max ?? ""}
                      onChange={(e) =>
                        patchSelected({
                          validation: {
                            ...selected.validation,
                            max: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={saveField}
                    disabled={isPending}
                    className="col-span-2 gap-2"
                  >
                    <Save className="h-4 w-4" />{" "}
                    {tx("customFields.save", "Save")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={duplicateField}
                    className="gap-2"
                    title={tx("customFields.duplicate", "Duplicate")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {selected.isActive ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={archiveField}
                      className="col-span-3 gap-2"
                    >
                      <Archive className="h-4 w-4" />{" "}
                      {tx("customFields.archive", "Archive")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={restoreField}
                      className="col-span-3 gap-2"
                    >
                      <ArchiveRestore className="h-4 w-4" />{" "}
                      {tx("customFields.restore", "Restore")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GroupRow({
  group,
  onRename,
  onDelete,
}: {
  group: GroupDraft;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className="flex items-center gap-1 rounded-xl border bg-background px-2 py-1.5"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {editing ? (
        <>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 flex-1 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(draft);
                setEditing(false);
              } else if (e.key === "Escape") {
                setDraft(group.label);
                setEditing(false);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => {
              onRename(draft);
              setEditing(false);
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => {
              setDraft(group.label);
              setEditing(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{group.label}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div className="min-w-0 flex-1 pr-2">
        <Label className="text-xs">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
