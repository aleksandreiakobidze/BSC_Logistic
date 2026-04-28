"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignShipment } from "../actions";

export function AssignShipmentForm({
  shipmentId,
  currentDriverId,
  currentVehicleId,
  drivers,
  vehicles,
}: {
  shipmentId: string;
  currentDriverId: string | null;
  currentVehicleId: string | null;
  drivers: { id: string; label: string }[];
  vehicles: { id: string; label: string }[];
}) {
  const [driverId, setDriverId] = React.useState(currentDriverId ?? "__none__");
  const [vehicleId, setVehicleId] = React.useState(currentVehicleId ?? "__none__");
  const [loading, setLoading] = React.useState(false);

  async function onSave() {
    setLoading(true);
    try {
      const d = driverId === "__none__" ? null : driverId;
      const v = vehicleId === "__none__" ? null : vehicleId;
      await assignShipment(shipmentId, d, v);
      toast.success("Assignment saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Driver</Label>
        <Select value={driverId} onValueChange={setDriverId}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Vehicle</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onSave} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save assignment
      </Button>
    </div>
  );
}
