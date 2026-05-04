"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Columns3,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ColumnDescriptor = {
  /** Stable identifier; used for both visibility and order. */
  id: string;
  /** Human-readable label shown in the picker. */
  label: string;
  /**
   * Whether the column is fixed and cannot be hidden/reordered. Use for
   * "name" or other anchor columns.
   */
  pinned?: boolean;
  /** Default visibility on first load (the user can override). */
  defaultVisible?: boolean;
};

export type ColumnPrefs = {
  visible: string[];
  /** Order array — drives which columns appear first. */
  order: string[];
};

type Props = {
  /** Stable per-table id used as the localStorage key suffix. */
  storageKey: string;
  columns: ColumnDescriptor[];
  prefs: ColumnPrefs;
  onChange: (next: ColumnPrefs) => void;
};

const PREFIX = "table-cols";

/**
 * Build the localStorage key for a given table.
 */
export function columnsStorageKey(scope: string): string {
  return `${PREFIX}:${scope}`;
}

/**
 * Compute the initial prefs for a table from defaults + any persisted
 * overrides. Call this on the client side via `React.useEffect` or via a
 * `useState` lazy initializer in a client component.
 */
export function loadColumnPrefs(
  scope: string,
  columns: ColumnDescriptor[],
): ColumnPrefs {
  const defaults: ColumnPrefs = {
    visible: columns
      .filter((c) => c.pinned || c.defaultVisible)
      .map((c) => c.id),
    order: columns.map((c) => c.id),
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(columnsStorageKey(scope));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ColumnPrefs>;
    const knownIds = new Set(columns.map((c) => c.id));
    const visible = Array.isArray(parsed.visible)
      ? parsed.visible.filter((id) => knownIds.has(id))
      : defaults.visible;
    const order = Array.isArray(parsed.order)
      ? [
          ...parsed.order.filter((id) => knownIds.has(id)),
          ...columns.map((c) => c.id).filter((id) => !parsed.order!.includes(id)),
        ]
      : defaults.order;
    // Always force pinned columns to be visible.
    const forced = new Set(visible);
    columns.forEach((c) => {
      if (c.pinned) forced.add(c.id);
    });
    return { visible: Array.from(forced), order };
  } catch {
    return defaults;
  }
}

export function saveColumnPrefs(scope: string, prefs: ColumnPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(columnsStorageKey(scope), JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode errors */
  }
}

/**
 * Column-picker button used in entity list toolbars. Renders a popover with
 * checkboxes (visibility) and drag handles (reorder). Persists choices via
 * `saveColumnPrefs` and emits a fresh `prefs` object whenever the user
 * toggles or drags.
 */
export function DataTableColumnsButton({
  storageKey,
  columns,
  prefs,
  onChange,
}: Props) {
  const t = useTranslations();
  const sensors = useSensors(useSensor(PointerSensor));

  function tx(k: string, fb: string): string {
    return t.has(k) ? t(k) : fb;
  }

  const ordered = React.useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return prefs.order
      .map((id) => byId.get(id))
      .filter((c): c is ColumnDescriptor => !!c);
  }, [columns, prefs.order]);

  function toggle(id: string) {
    const col = columns.find((c) => c.id === id);
    if (col?.pinned) return;
    const set = new Set(prefs.visible);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = { ...prefs, visible: Array.from(set) };
    onChange(next);
    saveColumnPrefs(storageKey, next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((c) => c.id === active.id);
    const newIndex = ordered.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex).map((c) => c.id);
    const next = { ...prefs, order: reordered };
    onChange(next);
    saveColumnPrefs(storageKey, next);
  }

  function reset() {
    const next: ColumnPrefs = {
      visible: columns
        .filter((c) => c.pinned || c.defaultVisible)
        .map((c) => c.id),
      order: columns.map((c) => c.id),
    };
    onChange(next);
    saveColumnPrefs(storageKey, next);
  }

  const visibleSet = new Set(prefs.visible);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          {tx("customFields.chooseColumns", "Columns")}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {prefs.visible.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tx("customFields.chooseColumns", "Columns")}
          </span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            {tx("customFields.resetColumns", "Reset")}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ordered.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {ordered.map((col) => (
                <ColumnRow
                  key={col.id}
                  column={col}
                  visible={visibleSet.has(col.id)}
                  onToggle={() => toggle(col.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnRow({
  column,
  visible,
  onToggle,
}: {
  column: ColumnDescriptor;
  visible: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, disabled: column.pinned });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
    >
      <span
        {...attributes}
        {...listeners}
        className={`text-muted-foreground ${
          column.pinned
            ? "cursor-not-allowed opacity-30"
            : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        onClick={onToggle}
        disabled={column.pinned}
        className="flex flex-1 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-sm">{column.label}</span>
        {visible ? (
          <Eye className="h-3.5 w-3.5 text-foreground" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
