"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateSettlement } from "./actions";

interface DriverOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function GenerateSettlementButton({
  drivers,
}: {
  drivers: DriverOption[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [driverId, setDriverId] = React.useState("");

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(today.getDate() - 30);
  const [periodFrom, setPeriodFrom] = React.useState(
    defaultFrom.toISOString().slice(0, 10),
  );
  const [periodTo, setPeriodTo] = React.useState(today.toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverId) return toast.error(t("settlements.errors.selectDriver"));
    setLoading(true);
    try {
      const res = await generateSettlement({
        driverId,
        periodFrom,
        periodTo,
        notes: notes || undefined,
      });
      if (!res.ok) {
        toast.error(res.error || t("settlements.errors.failed"));
        return;
      }
      toast.success(t("settlements.generated"));
      setOpen(false);
      setNotes("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("settlements.generate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settlements.generate")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <Field label={t("drivers.title")}>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder={t("settlements.selectDriver")} />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settlements.periodFrom")}>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                required
              />
            </Field>
            <Field label={t("settlements.periodTo")}>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label={t("payments.note")}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("settlements.notesPlaceholder")}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("settlements.generate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
