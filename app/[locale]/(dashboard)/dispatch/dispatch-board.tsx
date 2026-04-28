"use client";

import * as React from "react";
import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { MapPin, Truck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app/status-badge";
import { assignShipment } from "../shipments/actions";
import { useRouter } from "next/navigation";

type Shipment = {
  id: string;
  number: string;
  status: string;
  driverId: string | null;
  vehicle: { plate: string } | null;
  order: { customer: { name: string } };
  stops: { city: string | null; address: string }[];
};

type Column = {
  id: string;
  title: string;
  subtitle: string;
  shipments: Shipment[];
};

const UNASSIGNED = "__unassigned__";

export function DispatchBoard({ columns }: { columns: Column[] }) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragId, setDragId] = React.useState<string | null>(null);
  const all = React.useMemo(() => columns.flatMap((c) => c.shipments), [columns]);
  const dragging = all.find((s) => s.id === dragId);

  function onStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  async function onEnd(e: DragEndEvent) {
    setDragId(null);
    const overId = e.over?.id;
    const activeId = String(e.active.id);
    if (!overId) return;
    const targetDriverId = overId === UNASSIGNED ? null : String(overId);
    const ship = all.find((s) => s.id === activeId);
    if (!ship) return;
    if (ship.driverId === targetDriverId) return;
    try {
      await assignShipment(activeId, targetDriverId, undefined);
      toast.success(targetDriverId ? "Shipment assigned" : "Shipment unassigned");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {columns.map((col) => (
          <DropColumn key={col.id} column={col} />
        ))}
      </div>
      <DragOverlay>{dragging ? <ShipmentCard shipment={dragging} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function DropColumn({ column }: { column: Column }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-2xl border bg-card/30",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <div className="text-sm font-semibold">{column.title}</div>
          {column.subtitle && <div className="text-xs text-muted-foreground">{column.subtitle}</div>}
        </div>
        <div className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {column.shipments.length}
        </div>
      </div>
      <div className="scrollbar-thin flex flex-col gap-2 p-3 min-h-[60vh]">
        {column.shipments.map((s) => (
          <DraggableShipment key={s.id} shipment={s} />
        ))}
        {column.shipments.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableShipment({ shipment }: { shipment: Shipment }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: shipment.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-30")}>
      <ShipmentCard shipment={shipment} />
    </div>
  );
}

function ShipmentCard({ shipment, dragging }: { shipment: Shipment; dragging?: boolean }) {
  const pickup = shipment.stops[0];
  const dropoff = shipment.stops[shipment.stops.length - 1];
  return (
    <div
      className={cn(
        "cursor-grab rounded-xl border bg-background p-3 shadow-sm transition-colors hover:bg-accent/30 active:cursor-grabbing",
        dragging && "shadow-xl",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{shipment.number}</div>
        <StatusBadge kind="shipment" status={shipment.status as never} />
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{shipment.order.customer.name}</div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span className="truncate">
          {pickup?.city ?? pickup?.address ?? "—"} → {dropoff?.city ?? dropoff?.address ?? "—"}
        </span>
      </div>
      {shipment.vehicle && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Truck className="h-3 w-3" />
          {shipment.vehicle.plate}
        </div>
      )}
    </div>
  );
}
