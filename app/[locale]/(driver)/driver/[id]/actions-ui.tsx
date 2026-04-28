"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Truck, Package, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { driverUpdateStatus, driverReportLocation, driverUploadPOD } from "../actions";
import type { ShipmentStatus } from "@/lib/enums";

const NEXT: Record<string, ShipmentStatus> = {
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export function DriverShipmentActions({ shipmentId, status }: { shipmentId: string; status: ShipmentStatus }) {
  const t = useTranslations();
  const [loading, setLoading] = React.useState<string | null>(null);
  const [signedBy, setSignedBy] = React.useState("");
  const next = NEXT[status as keyof typeof NEXT];

  async function advance() {
    if (!next) return;
    setLoading("status");
    try {
      await driverUpdateStatus(shipmentId, next);
      toast.success("Status updated");
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void driverReportLocation(shipmentId, pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  async function reportFailed() {
    setLoading("failed");
    try {
      await driverUpdateStatus(shipmentId, "FAILED");
      toast.info("Delivery reported as failed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  async function onCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading("pod");
    try {
      const key = `pods/${shipmentId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, contentType: file.type || "image/jpeg" }),
      }).then((r) => (r.ok ? r.json() : null));

      if (presign?.url) {
        await fetch(presign.url, {
          method: "PUT",
          headers: { "content-type": file.type || "image/jpeg" },
          body: file,
        });
      }

      await driverUploadPOD(shipmentId, key, signedBy || undefined);
      toast.success("POD uploaded — delivery complete");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t("driverApp.updateStatus")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {status === "DELIVERED" ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-success">
            <CheckCircle2 className="h-4 w-4" /> Delivered
          </div>
        ) : status === "FAILED" ? (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-destructive">
            <XCircle className="h-4 w-4" /> Failed
          </div>
        ) : (
          <>
            {next && next !== "DELIVERED" && (
              <Button size="lg" className="w-full" disabled={loading !== null} onClick={advance}>
                {loading === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Mark as {next.replace(/_/g, " ")}
              </Button>
            )}

            {status === "IN_TRANSIT" && (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="font-medium">{t("driverApp.uploadPOD")}</div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("driverApp.signedBy")}</Label>
                  <Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Name of recipient" />
                </div>
                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium hover:bg-accent/30">
                  {loading === "pod" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {loading === "pod" ? "Uploading..." : t("driverApp.capturePhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onCapture}
                    disabled={loading !== null}
                  />
                </label>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full text-destructive"
              disabled={loading !== null}
              onClick={reportFailed}
            >
              <XCircle className="h-4 w-4" /> Report failed delivery
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
