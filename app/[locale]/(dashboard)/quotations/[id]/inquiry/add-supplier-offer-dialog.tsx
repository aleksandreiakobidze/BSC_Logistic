"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import {
  SupplierPicker,
  type SupplierSnapshot,
} from "@/components/app/supplier-picker";
import { Incoterms, QuotationTeam } from "@/lib/enums";
import { addSupplierOffer } from "./actions";

type UserOption = { id: string; name: string | null };

interface AddSupplierOfferDialogProps {
  quotationId: string;
  defaultTeam?: string;
  users: UserOption[];
  trigger?: React.ReactNode;
}

const TEAMS = Object.values(QuotationTeam);
const INCOTERMS = Object.values(Incoterms);
const NONE = "__none__";

export function AddSupplierOfferDialog({
  quotationId,
  defaultTeam = QuotationTeam.SEA,
  users,
  trigger,
}: AddSupplierOfferDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [supplier, setSupplier] = React.useState<SupplierSnapshot | undefined>();
  const [team, setTeam] = React.useState(defaultTeam);
  const [managerId, setManagerId] = React.useState<string>(NONE);
  const [currency, setCurrency] = React.useState("USD");
  const [incoterms, setIncoterms] = React.useState<string>(NONE);

  React.useEffect(() => {
    if (open) {
      setSupplier(undefined);
      setTeam(defaultTeam);
      setManagerId(NONE);
      setCurrency("USD");
      setIncoterms(NONE);
    }
  }, [open, defaultTeam]);

  React.useEffect(() => {
    if (supplier?.currency) setCurrency(supplier.currency);
  }, [supplier]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplier) {
      toast.error(t("quotations.inquiry.supplier"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await addSupplierOffer({
        quotationId,
        supplierId: supplier.id,
        team,
        managerUserId: managerId === NONE ? null : managerId,
        totalCost: Number(fd.get("totalCost") || 0),
        currency,
        transitTimeDays: fd.get("transitTimeDays")
          ? Number(fd.get("transitTimeDays"))
          : undefined,
        incoterms: incoterms === NONE ? null : (incoterms as never),
        validUntil: fd.get("validUntil")
          ? new Date(String(fd.get("validUntil")))
          : null,
        terms: (fd.get("terms") as string) || null,
        notes: (fd.get("notes") as string) || null,
      });
      if (res.ok) {
        toast.success(t("quotations.inquiry.offerAdded"));
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t("quotations.inquiry.addOffer")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        withDescription
      >
        <DialogHeader>
          <DialogTitle>{t("quotations.inquiry.addOffer")}</DialogTitle>
          <DialogDescription>
            {t("quotations.inquiry.selectWinnerHint")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="text-xs">
              {t("quotations.inquiry.supplier")}
            </Label>
            <SupplierPicker
              value={supplier?.id}
              onChange={setSupplier}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("quotations.inquiry.team")}>
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((te) => (
                    <SelectItem key={te} value={te}>
                      {t(`quotations.inquiry.teams.${te}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("quotations.inquiry.manager")}>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("quotations.inquiry.totalCost")}>
              <Input
                name="totalCost"
                type="number"
                step="0.01"
                min={0}
                required
              />
            </Field>
            <Field label={t("common.currency")}>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </Field>

            <Field label={t("quotations.inquiry.transitTime")}>
              <Input
                name="transitTimeDays"
                type="number"
                min={0}
                placeholder="days"
              />
            </Field>
            <Field label={t("quotations.inquiry.incoterms")}>
              <Select value={incoterms} onValueChange={setIncoterms}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {INCOTERMS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("quotations.validUntil")} className="col-span-2">
              <Input name="validUntil" type="date" />
            </Field>

            <Field label="Terms" className="col-span-2">
              <Input name="terms" placeholder="Payment terms, validity…" />
            </Field>

            <Field label={t("common.notes")} className="col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || !supplier}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
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
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
