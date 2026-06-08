"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleSlash,
  Loader2,
  PackagePlus,
  PlayCircle,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  LocationAutocomplete,
  type LocationValue,
} from "@/components/app/location-autocomplete";
import { OrderStatus } from "@/lib/enums";
import { revertOrderToQuotation, updateOrderStatus } from "../actions";
import { createShipmentFromOrder } from "../../shipments/actions";

interface OrderActionsBarProps {
  orderId: string;
  orderNumber: string;
  status: string;
  shipmentCount: number;
  invoiceCount: number;
  expenseCount: number;
  hasSourceQuotation: boolean;
}

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

export function OrderActionsBar({
  orderId,
  orderNumber,
  status,
  shipmentCount,
  invoiceCount,
  expenseCount,
  hasSourceQuotation,
}: OrderActionsBarProps) {
  const t = useTranslations();
  const router = useRouter();

  const [revertOpen, setRevertOpen] = React.useState(false);
  const [revertLoading, setRevertLoading] = React.useState(false);

  const [shipOpen, setShipOpen] = React.useState(false);
  const [shipLoading, setShipLoading] = React.useState(false);
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
    if (!shipOpen) {
      setCarrierSlug("__none__");
      setPickup({ name: "", lat: null, lng: null });
      setDropoff({ name: "", lat: null, lng: null });
    }
  }, [shipOpen]);

  const [statusLoading, setStatusLoading] =
    React.useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canRevert =
    status === "QUOTE" &&
    shipmentCount === 0 &&
    invoiceCount === 0 &&
    expenseCount === 0;

  // The plan: button is gated by status !== QUOTE && status !== CANCELLED.
  // When still QUOTE, we render the button disabled with a hint tooltip so
  // staff understand they need to authorize the order first.
  const canCreateShipment = status !== "CANCELLED";
  const createShipmentDisabled = status === "QUOTE";

  const isTerminal = status === "COMPLETED" || status === "CANCELLED";

  async function handleStatusChange(
    next: OrderStatus,
    successKey: string,
  ) {
    setStatusLoading(next);
    try {
      await updateOrderStatus(orderId, next);
      toast.success(t(successKey));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleCancelConfirm() {
    setStatusLoading(OrderStatus.CANCELLED);
    try {
      await updateOrderStatus(orderId, OrderStatus.CANCELLED);
      toast.success(t("orders.cancel.success"));
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleRevert() {
    setRevertLoading(true);
    try {
      const res = await revertOrderToQuotation(orderId);
      toast.success(t("orders.revertToQuotation.success"));
      setRevertOpen(false);
      if (res.quotationId) {
        router.push(`/quotations/${res.quotationId}`);
      } else {
        router.push("/orders");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setRevertLoading(false);
    }
  }

  async function handleCreateShipment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pickup.name.trim() || !dropoff.name.trim()) {
      toast.error(t("shipments.addressesRequired"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    setShipLoading(true);
    try {
      const carrier = carrierSlug === "__none__" ? null : carrierSlug;
      const res = await createShipmentFromOrder(orderId, {
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
        driverId: null,
        vehicleId: null,
      });
      toast.success(t("orders.createShipment.success"));
      setShipOpen(false);
      router.push(`/shipments/${res.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setShipLoading(false);
    }
  }

  return (
    <>
      {status === "QUOTE" && (
        <Button
          size="sm"
          onClick={() =>
            handleStatusChange(
              OrderStatus.CONFIRMED,
              "orders.authorize.success",
            )
          }
          disabled={statusLoading !== null}
          className="gap-1.5"
        >
          {statusLoading === OrderStatus.CONFIRMED ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {t("orders.authorize.button")}
        </Button>
      )}
      {status === "CONFIRMED" && (
        <Button
          size="sm"
          onClick={() =>
            handleStatusChange(
              OrderStatus.IN_PROGRESS,
              "orders.markInProgress.success",
            )
          }
          disabled={statusLoading !== null}
          className="gap-1.5"
        >
          {statusLoading === OrderStatus.IN_PROGRESS ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {t("orders.markInProgress.button")}
        </Button>
      )}
      {status === "IN_PROGRESS" && (
        <Button
          size="sm"
          onClick={() =>
            handleStatusChange(
              OrderStatus.COMPLETED,
              "orders.markCompleted.success",
            )
          }
          disabled={statusLoading !== null}
          className="gap-1.5"
        >
          {statusLoading === OrderStatus.COMPLETED ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {t("orders.markCompleted.button")}
        </Button>
      )}
      {!isTerminal && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCancelOpen(true)}
          disabled={statusLoading !== null}
          className="gap-1.5"
        >
          <CircleSlash className="h-4 w-4" />
          {t("orders.cancel.button")}
        </Button>
      )}
      {canRevert && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRevertOpen(true)}
          className="gap-1.5"
        >
          <Undo2 className="h-4 w-4" />
          {t("orders.revertToQuotation.button")}
        </Button>
      )}
      {canCreateShipment && (
        <Button
          size="sm"
          onClick={() => setShipOpen(true)}
          disabled={createShipmentDisabled}
          title={
            createShipmentDisabled
              ? t("orders.createShipment.disabledHint")
              : undefined
          }
          className="gap-1.5"
        >
          <PackagePlus className="h-4 w-4" />
          {t("orders.createShipment.button")}
        </Button>
      )}

      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orders.revertToQuotation.title")}</DialogTitle>
            <DialogDescription>
              {hasSourceQuotation
                ? t("orders.revertToQuotation.confirmWithQuotation", {
                    number: orderNumber,
                  })
                : t("orders.revertToQuotation.confirmNoQuotation", {
                    number: orderNumber,
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevertOpen(false)}
              disabled={revertLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevert}
              disabled={revertLoading}
            >
              {revertLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("orders.revertToQuotation.button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orders.cancel.title")}</DialogTitle>
            <DialogDescription>
              {t("orders.cancel.confirm", { number: orderNumber })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={statusLoading !== null}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={statusLoading !== null}
            >
              {statusLoading === OrderStatus.CANCELLED ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("orders.cancel.button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("orders.createShipment.button")}</DialogTitle>
            <DialogDescription>
              {t("orders.createShipment.dialogDescription", {
                number: orderNumber,
              })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateShipment} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
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

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Cargo
              </Label>
              <div className="grid gap-2 sm:grid-cols-4">
                <Field label="Type">
                  <Input name="cargoType" placeholder="General" className="h-9" />
                </Field>
                <Field label="Weight (kg)">
                  <Input name="cargoWeightKg" type="number" step="0.01" className="h-9" />
                </Field>
                <Field label="Volume (m³)">
                  <Input name="cargoVolumeM3" type="number" step="0.01" className="h-9" />
                </Field>
                <Field label="Temperature">
                  <Input name="temperature" className="h-9" />
                </Field>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Schedule
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Planned start">
                  <Input name="plannedStart" type="datetime-local" className="h-9" />
                </Field>
                <Field label="Planned end">
                  <Input name="plannedEnd" type="datetime-local" className="h-9" />
                </Field>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                External tracking
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Carrier">
                  <Select value={carrierSlug} onValueChange={setCarrierSlug}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Manual / no carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Manual / no carrier</SelectItem>
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

            <Field label={t("common.notes")}>
              <Textarea name="notes" rows={2} />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShipOpen(false)}
                disabled={shipLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={shipLoading}>
                {shipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("orders.createShipment.button")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
