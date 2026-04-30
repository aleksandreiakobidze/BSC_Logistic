"use client";

import * as React from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { createTrip } from "./actions";

export function NewTripButton({
  drivers,
  vehicles,
}: {
  drivers: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; plate: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [driverId, setDriverId] = React.useState<string>("__none__");
  const [vehicleId, setVehicleId] = React.useState<string>("__none__");
  const [plannedStart, setPlannedStart] = React.useState<Date | undefined>();
  const [plannedEnd, setPlannedEnd] = React.useState<Date | undefined>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      if (driverId !== "__none__") fd.set("driverId", driverId);
      if (vehicleId !== "__none__") fd.set("vehicleId", vehicleId);
      if (plannedStart) fd.set("plannedStart", plannedStart.toISOString());
      if (plannedEnd) fd.set("plannedEnd", plannedEnd.toISOString());
      const res = await createTrip(fd);
      if (res.ok) {
        toast.success("Trip created");
        setOpen(false);
        form.reset();
        setDriverId("__none__");
        setVehicleId("__none__");
        setPlannedStart(undefined);
        setPlannedEnd(undefined);
      }
    } catch {
      toast.error("Failed to create trip");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassigned —</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassigned —</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Planned start</Label>
              <DateTimePicker
                value={plannedStart}
                onChange={setPlannedStart}
                placeholder="Start date & time"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Planned end</Label>
              <DateTimePicker
                value={plannedEnd}
                onChange={setPlannedEnd}
                placeholder="End date & time"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
