"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Loader2,
  Search,
  X,
  Building2,
  Package,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import {
  LocationAutocomplete,
  type LocationValue,
} from "@/components/app/location-autocomplete";
import { formatCurrency } from "@/lib/utils";
import { createShipment, searchOrdersForShipment } from "./actions";

type OrderResult = Awaited<ReturnType<typeof searchOrdersForShipment>>[number];

/**
 * Common AfterShip carrier slugs. Pulled from
 * https://www.aftership.com/couriers - the full list has 1000+ entries; we
 * surface the most-used global carriers here and fall back to a free-text
 * tracking number for everything else.
 */
const AFTERSHIP_CARRIERS: { slug: string; label: string }[] = [
  { slug: "fedex", label: "FedEx" },
  { slug: "ups", label: "UPS" },
  { slug: "dhl", label: "DHL Express" },
  { slug: "dhl-global-mail", label: "DHL eCommerce" },
  { slug: "usps", label: "USPS" },
  { slug: "tnt", label: "TNT" },
  { slug: "aramex", label: "Aramex" },
  { slug: "dpd", label: "DPD" },
  { slug: "gls", label: "GLS" },
  { slug: "royal-mail", label: "Royal Mail" },
  { slug: "china-post", label: "China Post" },
  { slug: "ems", label: "EMS" },
  { slug: "maersk", label: "Maersk" },
  { slug: "msc", label: "MSC" },
  { slug: "cma-cgm", label: "CMA CGM" },
];

export function NewShipmentButton({
  drivers,
  vehicles,
  locale,
}: {
  drivers: { id: string; label: string }[];
  vehicles: { id: string; label: string }[];
  locale: string;
}) {
  const router = useRouter();
  const t = useTranslations("shipments");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<OrderResult[]>([]);
  const [q, setQ] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<OrderResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [driverId, setDriverId] = React.useState<string>("__none__");
  const [vehicleId, setVehicleId] = React.useState<string>("__none__");
  const [carrierSlug, setCarrierSlug] = React.useState<string>("__none__");
  const [pickup, setPickup] = React.useState<LocationValue>({
    name: "",
    lat: null,
    lng: null,
  });
  const [dropoff, setDropoff] = React.useState<LocationValue>({
    name: "",
    lat: null,
    lng: null,
  });

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchOrdersForShipment(q);
        if (!cancelled) setSearchResults(res);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, open]);

  React.useEffect(() => {
    if (!open) {
      setSelected([]);
      setQ("");
      setDriverId("__none__");
      setVehicleId("__none__");
      setCarrierSlug("__none__");
      setPickup({ name: "", lat: null, lng: null });
      setDropoff({ name: "", lat: null, lng: null });
    }
  }, [open]);

  const togglePick = (o: OrderResult) => {
    setSelected((prev) =>
      prev.find((p) => p.id === o.id)
        ? prev.filter((p) => p.id !== o.id)
        : [...prev, o],
    );
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected.length === 0) {
      toast.error(t("selectOrders"));
      return;
    }
    if (!pickup.name.trim() || !dropoff.name.trim()) {
      toast.error(t("addressesRequired"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const carrier = carrierSlug === "__none__" ? null : carrierSlug;
      const res = await createShipment({
        orderIds: selected.map((s) => s.id),
        driverId: driverId === "__none__" ? null : driverId,
        vehicleId: vehicleId === "__none__" ? null : vehicleId,
        cargoType: (fd.get("cargoType") as string) || null,
        cargoWeightKg: fd.get("cargoWeightKg")
          ? Number(fd.get("cargoWeightKg"))
          : null,
        cargoVolumeM3: fd.get("cargoVolumeM3")
          ? Number(fd.get("cargoVolumeM3"))
          : null,
        temperature: (fd.get("temperature") as string) || null,
        plannedStart: (fd.get("plannedStart") as string) || null,
        plannedEnd: (fd.get("plannedEnd") as string) || null,
        notes: (fd.get("notes") as string) || null,
        pickupAddress: pickup.name.trim(),
        pickupCity: (fd.get("pickupCity") as string) || null,
        pickupCountry: (fd.get("pickupCountry") as string) || null,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name.trim(),
        dropoffCity: (fd.get("dropoffCity") as string) || null,
        dropoffCountry: (fd.get("dropoffCountry") as string) || null,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        carrier,
        externalTrackingNumber:
          (fd.get("externalTrackingNumber") as string)?.trim() || null,
      });
      toast.success(t("statusChanged"));
      setOpen(false);
      router.push(`/shipments/${res.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newShipment")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t("newShipment")}</DialogTitle>
          <DialogDescription>{t("newShipmentDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* LEFT: Orders selection */}
            <section className="flex min-h-0 flex-col gap-2 overflow-hidden border-b p-4 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {t("selectOrders")}
                </Label>
                {selected.length > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {selected.length}
                  </Badge>
                )}
              </div>

              {selected.length > 0 && (
                <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto rounded-lg border bg-muted/30 p-1.5">
                  {selected.map((o) => (
                    <Badge
                      key={o.id}
                      variant="secondary"
                      className="gap-1 pl-1.5 pr-0.5 text-[11px]"
                    >
                      <span className="font-mono">{o.number}</span>
                      <button
                        type="button"
                        onClick={() => togglePick(o)}
                        className="ml-0.5 rounded p-0.5 hover:bg-background"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchOrders")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
                {searching ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    …
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {t("noOrdersFound")}
                  </div>
                ) : (
                  <div className="divide-y">
                    {searchResults.map((o) => {
                      const isSel = !!selected.find((s) => s.id === o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => togglePick(o)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 ${
                            isSel ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">
                                {o.number}
                              </span>
                              {isSel && (
                                <Badge className="h-4 px-1 text-[9px]">
                                  ✓
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{o.customerName}</span>
                            </div>
                          </div>
                          <div className="font-mono text-xs">
                            {formatCurrency(o.price, o.currency, locale)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT: Form fields */}
            <section className="min-h-0 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Route */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Route
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Pickup address" className="sm:col-span-3">
                      <LocationAutocomplete
                        kind="address"
                        value={pickup}
                        onChange={setPickup}
                        placeholder="Search pickup address…"
                      />
                    </Field>
                    <Field label="Pickup city" className="sm:col-span-2">
                      <Input name="pickupCity" className="h-9" />
                    </Field>
                    <Field label="Country">
                      <Input name="pickupCountry" className="h-9" />
                    </Field>
                    <Field label="Dropoff address" className="sm:col-span-3">
                      <LocationAutocomplete
                        kind="address"
                        value={dropoff}
                        onChange={setDropoff}
                        placeholder="Search dropoff address…"
                      />
                    </Field>
                    <Field label="Dropoff city" className="sm:col-span-2">
                      <Input name="dropoffCity" className="h-9" />
                    </Field>
                    <Field label="Country">
                      <Input name="dropoffCountry" className="h-9" />
                    </Field>
                  </div>
                </div>

                {/* Cargo */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cargo
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Field label="Type">
                      <Input
                        name="cargoType"
                        placeholder="General"
                        className="h-9"
                      />
                    </Field>
                    <Field label="Weight (kg)">
                      <Input
                        name="cargoWeightKg"
                        type="number"
                        step="0.01"
                        className="h-9"
                      />
                    </Field>
                    <Field label="Volume (m³)">
                      <Input
                        name="cargoVolumeM3"
                        type="number"
                        step="0.01"
                        className="h-9"
                      />
                    </Field>
                    <Field label="Temperature">
                      <Input name="temperature" className="h-9" />
                    </Field>
                  </div>
                </div>

                {/* Schedule + Assignment */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Schedule & assignment
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Planned start">
                      <Input
                        name="plannedStart"
                        type="datetime-local"
                        className="h-9"
                      />
                    </Field>
                    <Field label="Planned end">
                      <Input
                        name="plannedEnd"
                        type="datetime-local"
                        className="h-9"
                      />
                    </Field>
                    <Field label="Driver">
                      <Select value={driverId} onValueChange={setDriverId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Vehicle">
                      <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>

                {/* External tracking (AfterShip) */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    External tracking
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Carrier">
                      <Select
                        value={carrierSlug}
                        onValueChange={setCarrierSlug}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Manual / no carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            Manual / no carrier
                          </SelectItem>
                          {AFTERSHIP_CARRIERS.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Tracking number">
                      <Input
                        name="externalTrackingNumber"
                        placeholder="e.g. 1Z999AA10123456784"
                        className="h-9"
                      />
                    </Field>
                  </div>
                </div>

                <Field label={tCommon("notes")}>
                  <Textarea name="notes" rows={2} />
                </Field>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <div className="mr-auto text-xs text-muted-foreground">
              {selected.length === 0
                ? t("selectOrders")
                : `${selected.length} order${selected.length > 1 ? "s" : ""} selected`}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading || selected.length === 0}>
              {loading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {tCommon("save")}
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
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
