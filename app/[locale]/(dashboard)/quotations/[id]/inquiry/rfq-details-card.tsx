"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Incoterms, LeadPriority, QuotationTeam } from "@/lib/enums";
import {
  LocationAutocomplete,
  type LocationValue,
} from "@/components/app/location-autocomplete";
import { updateRfqHeader } from "./actions";

type UserOption = { id: string; name: string | null };

export interface RfqHeader {
  salesManagerId: string | null;
  requestedTeams: string | null;
  priority: string;
  mode: string | null;
  incoterms: string | null;
  originPort: string | null;
  originPortLat: number | null;
  originPortLng: number | null;
  originAddress: string | null;
  originAddressLat: number | null;
  originAddressLng: number | null;
  destinationPort: string | null;
  destinationPortLat: number | null;
  destinationPortLng: number | null;
  destinationAddress: string | null;
  destinationAddressLat: number | null;
  destinationAddressLng: number | null;
  cargoDescription: string | null;
  shipmentDetails: string | null;
  cargoValue: number | null;
  cargoValueCurrency: string | null;
  cargoReadyDate: string | null;
  specialRequirements: string | null;
}

interface RfqDetailsCardProps {
  quotationId: string;
  quoteNumber: string;
  customerName: string;
  contactName?: string | null;
  ownerName?: string | null;
  createdAt: string;
  header: RfqHeader;
  users: UserOption[];
  readOnly?: boolean;
  locale: string;
}

const PRIORITIES = Object.values(LeadPriority);
const TEAMS = Object.values(QuotationTeam);
const INCOTERMS = Object.values(Incoterms);
const UNASSIGNED = "__none__";
const NONE_VALUE = "__none__";

export function RfqDetailsCard({
  quotationId,
  quoteNumber,
  customerName,
  contactName,
  ownerName,
  createdAt,
  header,
  users,
  readOnly = false,
  locale,
}: RfqDetailsCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);
  const [loading, setLoading] = React.useState(false);
  const [salesManagerId, setSalesManagerId] = React.useState(
    header.salesManagerId ?? UNASSIGNED,
  );
  const [teams, setTeams] = React.useState<Set<string>>(
    new Set(
      (header.requestedTeams ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  const [priority, setPriority] = React.useState(
    header.priority || LeadPriority.MEDIUM,
  );
  const [incoterms, setIncoterms] = React.useState(
    header.incoterms ?? NONE_VALUE,
  );
  const [originPort, setOriginPort] = React.useState<LocationValue>({
    name: header.originPort ?? "",
    lat: header.originPortLat,
    lng: header.originPortLng,
  });
  const [originAddress, setOriginAddress] = React.useState<LocationValue>({
    name: header.originAddress ?? "",
    lat: header.originAddressLat,
    lng: header.originAddressLng,
  });
  const [destinationPort, setDestinationPort] = React.useState<LocationValue>({
    name: header.destinationPort ?? "",
    lat: header.destinationPortLat,
    lng: header.destinationPortLng,
  });
  const [destinationAddress, setDestinationAddress] =
    React.useState<LocationValue>({
      name: header.destinationAddress ?? "",
      lat: header.destinationAddressLat,
      lng: header.destinationAddressLng,
    });

  const formatDate = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  function toggleTeam(team: string, on: boolean) {
    setTeams((prev) => {
      const next = new Set(prev);
      if (on) next.add(team);
      else next.delete(team);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await updateRfqHeader(quotationId, {
        salesManagerId:
          salesManagerId === UNASSIGNED ? null : salesManagerId,
        requestedTeams: Array.from(teams),
        priority,
        mode: (fd.get("mode") as string) || null,
        incoterms: incoterms === NONE_VALUE ? null : incoterms,
        originPort: originPort.name || null,
        originPortLat: originPort.lat,
        originPortLng: originPort.lng,
        originAddress: originAddress.name || null,
        originAddressLat: originAddress.lat,
        originAddressLng: originAddress.lng,
        destinationPort: destinationPort.name || null,
        destinationPortLat: destinationPort.lat,
        destinationPortLng: destinationPort.lng,
        destinationAddress: destinationAddress.name || null,
        destinationAddressLat: destinationAddress.lat,
        destinationAddressLng: destinationAddress.lng,
        cargoDescription: (fd.get("cargoDescription") as string) || null,
        shipmentDetails: (fd.get("shipmentDetails") as string) || null,
        cargoValue: fd.get("cargoValue")
          ? Number(fd.get("cargoValue"))
          : null,
        cargoValueCurrency: (fd.get("cargoValueCurrency") as string) || null,
        cargoReadyDate: fd.get("cargoReadyDate")
          ? new Date(String(fd.get("cargoReadyDate")))
          : null,
        specialRequirements:
          (fd.get("specialRequirements") as string) || null,
      });
      toast.success(t("quotations.inquiry.saved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.rfqDetails")}
        </CardTitle>
        <Badge variant="outline" className="font-mono text-[10px]">
          {quoteNumber}
        </Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3 rounded-lg bg-muted/30 p-3 text-xs">
            <Row
              label={t("orders.customer")}
              value={<span className="font-medium">{customerName}</span>}
            />
            {contactName && (
              <Row label={t("contacts.fullName")} value={contactName} />
            )}
            {ownerName && (
              <Row label={tx("common.owner", "Owner")} value={ownerName} />
            )}
            <Row
              label={t("common.created")}
              value={formatDate.format(new Date(createdAt))}
            />
          </div>

          <Field label={t("quotations.inquiry.salesManager")}>
            <Select
              value={salesManagerId}
              onValueChange={setSalesManagerId}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>—</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("quotations.inquiry.requestedTeams")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {TEAMS.map((team) => {
                const checked = teams.has(team);
                return (
                  <button
                    type="button"
                    key={team}
                    onClick={() => !readOnly && toggleTeam(team, !checked)}
                    disabled={readOnly}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {t(`quotations.inquiry.teams.${team}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("quotations.inquiry.priority")}>
              <Select
                value={priority}
                onValueChange={setPriority}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {tx(`leads.priorities.${p}`, p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("quotations.inquiry.incoterms")}>
              <Select
                value={incoterms}
                onValueChange={setIncoterms}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>—</SelectItem>
                  {INCOTERMS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("quotations.inquiry.mode")} className="col-span-2">
              <Input
                name="mode"
                defaultValue={header.mode ?? ""}
                placeholder="FCL / LCL / FTL / LTL / Air …"
                disabled={readOnly}
              />
            </Field>

            <Field label={t("quotations.inquiry.originPort")}>
              <LocationAutocomplete
                kind="port"
                value={originPort}
                onChange={setOriginPort}
                disabled={readOnly}
              />
            </Field>
            <Field label={t("quotations.inquiry.destinationPort")}>
              <LocationAutocomplete
                kind="port"
                value={destinationPort}
                onChange={setDestinationPort}
                disabled={readOnly}
              />
            </Field>

            <Field
              label={t("quotations.inquiry.originAddress")}
              className="col-span-2"
            >
              <LocationAutocomplete
                kind="address"
                value={originAddress}
                onChange={setOriginAddress}
                disabled={readOnly}
              />
            </Field>
            <Field
              label={t("quotations.inquiry.destinationAddress")}
              className="col-span-2"
            >
              <LocationAutocomplete
                kind="address"
                value={destinationAddress}
                onChange={setDestinationAddress}
                disabled={readOnly}
              />
            </Field>

            <Field
              label={t("quotations.inquiry.cargoDescription")}
              className="col-span-2"
            >
              <Textarea
                name="cargoDescription"
                rows={2}
                defaultValue={header.cargoDescription ?? ""}
                disabled={readOnly}
              />
            </Field>
            <Field
              label={t("quotations.inquiry.shipmentDetails")}
              className="col-span-2"
            >
              <Textarea
                name="shipmentDetails"
                rows={2}
                defaultValue={header.shipmentDetails ?? ""}
                disabled={readOnly}
              />
            </Field>

            <Field label={t("quotations.inquiry.cargoValue")}>
              <Input
                name="cargoValue"
                type="number"
                step="0.01"
                defaultValue={
                  header.cargoValue != null ? String(header.cargoValue) : ""
                }
                disabled={readOnly}
              />
            </Field>
            <Field label={t("common.currency")}>
              <Input
                name="cargoValueCurrency"
                defaultValue={header.cargoValueCurrency ?? ""}
                placeholder="USD"
                maxLength={6}
                disabled={readOnly}
              />
            </Field>

            <Field label={t("quotations.inquiry.cargoReadyDate")}>
              <Input
                name="cargoReadyDate"
                type="date"
                defaultValue={
                  header.cargoReadyDate
                    ? header.cargoReadyDate.slice(0, 10)
                    : ""
                }
                disabled={readOnly}
              />
            </Field>
          </div>

          <Field label={t("quotations.inquiry.specialRequirements")}>
            <Textarea
              name="specialRequirements"
              rows={2}
              defaultValue={header.specialRequirements ?? ""}
              disabled={readOnly}
            />
          </Field>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("common.save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
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
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
