"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Trash2,
  ListOrdered,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  QuotationStatus,
  QuotationTeam,
  SupplierOfferStatus,
} from "@/lib/enums";
import { AddSupplierOfferDialog } from "./add-supplier-offer-dialog";
import { RequestPricingDialog } from "./request-pricing-dialog";
import {
  deleteSupplierOffer,
  selectSupplierOffer,
} from "./actions";

type UserOption = { id: string; name: string | null };

export type SupplierOfferRow = {
  id: string;
  team: string;
  status: string;
  isSelected: boolean;
  totalCost: number;
  currency: string;
  transitTimeDays: number | null;
  manager: { id: string; name: string | null } | null;
  supplier: {
    id: string;
    name: string;
    code: string | null;
    email: string | null;
  };
  incoterms: string | null;
  notes: string | null;
};

interface SupplierOffersTableProps {
  quotationId: string;
  status: string;
  offers: SupplierOfferRow[];
  users: UserOption[];
  locale: string;
}

const TEAMS = Object.values(QuotationTeam);
type SortKey = "default" | "cheapest" | "fastest";

export function SupplierOffersTable({
  quotationId,
  status,
  offers,
  users,
  locale,
}: SupplierOffersTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const [teamFilter, setTeamFilter] = React.useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = React.useState<string>("ALL");
  const [sort, setSort] = React.useState<SortKey>("default");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [requestOpen, setRequestOpen] = React.useState(false);

  const editable =
    status === QuotationStatus.PRICING ||
    status === QuotationStatus.DRAFT ||
    status === QuotationStatus.COUNTERED;

  const currencies = React.useMemo(
    () => Array.from(new Set(offers.map((o) => o.currency))).sort(),
    [offers],
  );

  const filtered = React.useMemo(() => {
    let rows = offers;
    if (teamFilter !== "ALL") {
      rows = rows.filter((o) => o.team === teamFilter);
    }
    if (currencyFilter !== "ALL") {
      rows = rows.filter((o) => o.currency === currencyFilter);
    }
    if (sort === "cheapest") {
      rows = [...rows].sort((a, b) => a.totalCost - b.totalCost);
    } else if (sort === "fastest") {
      rows = [...rows].sort(
        (a, b) =>
          (a.transitTimeDays ?? Infinity) - (b.transitTimeDays ?? Infinity),
      );
    }
    return rows;
  }, [offers, teamFilter, currencyFilter, sort]);

  async function onSelect(id: string) {
    setBusyId(id);
    try {
      await selectSupplierOffer(id);
      toast.success(t("quotations.inquiry.offerSelected"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      await deleteSupplierOffer(id);
      toast.success(t("quotations.inquiry.offerDeleted"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-medium">
          {t("quotations.inquiry.supplierOffers")}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("quotations.inquiry.team")}</SelectItem>
                {TEAMS.map((te) => (
                  <SelectItem key={te} value={te}>
                    {t(`quotations.inquiry.teams.${te}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.currency")}</SelectItem>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={sort === "cheapest" ? "default" : "outline"}
              onClick={() =>
                setSort((s) => (s === "cheapest" ? "default" : "cheapest"))
              }
            >
              <ListOrdered className="h-4 w-4" />
              Cheapest
            </Button>
            <Button
              size="sm"
              variant={sort === "fastest" ? "default" : "outline"}
              onClick={() =>
                setSort((s) => (s === "fastest" ? "default" : "fastest"))
              }
            >
              <Timer className="h-4 w-4" />
              Fastest
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  {t("quotations.inquiry.team")}
                </TableHead>
                <TableHead>{t("quotations.inquiry.manager")}</TableHead>
                <TableHead>{t("quotations.inquiry.supplier")}</TableHead>
                <TableHead className="text-right">
                  {t("quotations.inquiry.totalCost")}
                </TableHead>
                <TableHead className="text-right">
                  {t("quotations.inquiry.transitTime")}
                </TableHead>
                <TableHead className="w-[100px]">
                  {t("suppliers.offerStatus")}
                </TableHead>
                <TableHead className="w-[110px] text-center">
                  {t("quotations.inquiry.select")}
                </TableHead>
                {editable && <TableHead className="w-[40px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={editable ? 8 : 7}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    {t("quotations.inquiry.noOffers")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((offer) => (
                  <TableRow
                    key={offer.id}
                    className={
                      offer.isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                    }
                  >
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {t(`quotations.inquiry.teams.${offer.team}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {offer.manager?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <div>{offer.supplier.name}</div>
                      {offer.supplier.code && (
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {offer.supplier.code}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(offer.totalCost, offer.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {offer.transitTimeDays != null
                        ? `${offer.transitTimeDays}d`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          offer.isSelected
                            ? "success"
                            : offer.status === SupplierOfferStatus.REJECTED
                              ? "destructive"
                              : offer.status === SupplierOfferStatus.REQUESTED
                                ? "warning"
                                : "outline"
                        }
                        className="text-[10px]"
                      >
                        {offer.isSelected
                          ? t("quotations.inquiry.selected")
                          : offer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant={offer.isSelected ? "default" : "ghost"}
                        title={t("quotations.inquiry.select")}
                        disabled={!editable || busyId === offer.id}
                        onClick={() => onSelect(offer.id)}
                      >
                        {busyId === offer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2
                            className={`h-4 w-4 ${
                              offer.isSelected ? "" : "text-muted-foreground"
                            }`}
                          />
                        )}
                      </Button>
                    </TableCell>
                    {editable && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          title="Delete"
                          disabled={busyId === offer.id}
                          onClick={() => onDelete(offer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <AddSupplierOfferDialog
              quotationId={quotationId}
              users={users}
              defaultTeam={
                teamFilter !== "ALL" ? teamFilter : QuotationTeam.SEA
              }
            />
            <Button
              size="sm"
              variant="outline"
              disabled={offers.length === 0}
              onClick={() => setRequestOpen(true)}
            >
              <Mail className="h-4 w-4" />
              {t("quotations.actions.requestPricing")}
            </Button>
          </div>
        )}

        <RequestPricingDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          quotationId={quotationId}
          offers={offers}
        />
      </CardContent>
    </Card>
  );
}
