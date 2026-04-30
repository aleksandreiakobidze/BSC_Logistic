"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block, BlockId } from "@/lib/invoice-template";

interface BlockListProps {
  blocks: Block[];
  selectedId: BlockId | null;
  onSelect: (id: BlockId) => void;
  onToggleVisible: (id: BlockId) => void;
  onReorder: (blocks: Block[]) => void;
}

function SortableBlock({
  block,
  isSelected,
  onSelect,
  onToggle,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer border",
        "hover:bg-muted/60 transition-colors",
        isSelected ? "bg-primary/10 border-primary/40" : "border-transparent",
        !block.visible && "opacity-40",
      )}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 truncate font-medium">{block.label}</span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title={block.visible ? "Hide block" : "Show block"}
      >
        {block.visible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onToggleVisible,
  onReorder,
}: BlockListProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onReorder(arrayMove(blocks, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              isSelected={selectedId === block.id}
              onSelect={() => onSelect(block.id)}
              onToggle={() => onToggleVisible(block.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
