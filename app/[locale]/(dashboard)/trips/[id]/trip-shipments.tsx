"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignShipmentToTrip, removeShipmentFromTrip } from "../actions";

type AttachedShipment = {
  id: string;
  number: string;
  status: string;
  cargoType: string | null;
  cargoWeightKg: number | null;
  customer: string;
  orderNumber: string;
};

type AvailableShipment = {
  id: string;
  number: string;
  customer: string;
  orderNumber: string;
};

export function TripShipments({
  tripId,
  attached,
  available,
}: {
  tripId: string;
  attached: AttachedShipment[];
  available: AvailableShipment[];
}) {
  const [open, setOpen] = React.useState(false);
  const [shipmentId, setShipmentId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  async function onAssign() {
    if (!shipmentId) return toast.error("Select a shipment");
    setLoading(true);
    try {
      await assignShipmentToTrip(tripId, shipmentId);
      toast.success("Shipment attached to trip");
      setOpen(false);
      setShipmentId("");
    } catch {
      toast.error("Failed to attach shipment");
    } finally {
      setLoading(false);
    }
  }

  async function onRemove(id: string) {
    try {
      await removeShipmentFromTrip(id);
      toast.success("Shipment removed from trip");
    } catch {
      toast.error("Failed to remove shipment");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Shipments on this trip</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add shipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Attach shipment to trip</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={shipmentId} onValueChange={setShipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a shipment…" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="py-2 px-2 text-sm text-muted-foreground">No unassigned shipments</div>
                  ) : (
                    available.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.number} · {s.customer} · {s.orderNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only shipments not currently on a trip are listed.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={onAssign} disabled={loading} className="gap-1.5">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Attach
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {attached.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No shipments attached yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>{`Status`}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {attached.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/shipments/${s.id}`} className="hover:underline">{s.number}</Link>
                  </TableCell>
                  <TableCell className="text-xs">{s.orderNumber}</TableCell>
                  <TableCell>{s.customer}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.cargoType ?? "—"}</TableCell>
                  <TableCell className="text-xs">{s.cargoWeightKg ? `${s.cargoWeightKg} kg` : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{s.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemove(s.id)}
                      title="Remove from trip"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
