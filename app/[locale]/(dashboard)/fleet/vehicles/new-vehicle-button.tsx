"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomFieldsForm } from "@/components/app/custom-fields/custom-fields-form";
import type { CustomFieldDefinitionView } from "@/lib/custom-fields";
import { createVehicle } from "./actions";

export function NewVehicleButton({
  customFields = [],
}: {
  customFields?: CustomFieldDefinitionView[];
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [type, setType] = React.useState<string>("TRUCK");
  const [status, setStatus] = React.useState<string>("ACTIVE");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("type", type);
      fd.set("status", status);
      await createVehicle(fd);
      toast.success("Vehicle created");
      form.reset();
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("fleet.newVehicle")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("fleet.newVehicle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fleet.plate")}>
              <Input name="plate" required />
            </Field>
            <Field label="VIN">
              <Input name="vin" />
            </Field>
            <Field label={t("fleet.type")}>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["TRUCK", "VAN", "TRAILER", "REEFER", "TANKER", "CAR"].map((x) => (
                    <SelectItem key={x} value={x}>{x}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("fleet.status")}>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ACTIVE", "MAINTENANCE", "INACTIVE"].map((x) => (
                    <SelectItem key={x} value={x}>{x}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("fleet.make")}>
              <Input name="make" />
            </Field>
            <Field label={t("fleet.model")}>
              <Input name="model" />
            </Field>
            <Field label={t("fleet.year")}>
              <Input name="year" type="number" />
            </Field>
            <Field label="Capacity (kg)">
              <Input name="capacityKg" type="number" />
            </Field>
            <Field label="Capacity (m³)">
              <Input name="capacityM3" type="number" step="0.1" />
            </Field>
            <Field label={t("fleet.odometer")}>
              <Input name="odometerKm" type="number" defaultValue={0} />
            </Field>
            <Field label="Fuel type">
              <Input name="fuelType" defaultValue="Diesel" />
            </Field>
          </div>
          <CustomFieldsForm definitions={customFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
