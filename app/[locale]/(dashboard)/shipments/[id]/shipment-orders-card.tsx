"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  X,
  Loader2,
  Package,
  Search,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  addOrderToShipment,
  removeOrderFromShipment,
  searchOrdersForShipment,
} from "../actions";

export type ShipmentOrderItem = {
  id: string;
  number: string;
  status: string;
  /** Pre-formatted on the server to avoid Node↔browser Intl hydration mismatches. */
  priceFormatted: string;
  customerName: string;
};

export function ShipmentOrdersCard({
  shipmentId,
  orders,
  locale,
}: {
  shipmentId: string;
  orders: ShipmentOrderItem[];
  locale: string;
}) {
  const router = useRouter();
  const t = useTranslations("shipments");
  const tCommon = useTranslations("common");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const onRemove = async (orderId: string) => {
    if (orders.length <= 1) {
      toast.error(t("lastOrderError"));
      return;
    }
    if (!confirm(t("removeOrderConfirm"))) return;
    setRemoving(orderId);
    try {
      await removeOrderFromShipment(shipmentId, orderId);
      toast.success(t("statusChanged"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          {t("ordersCard")}
          {orders.length > 1 && (
            <Badge variant="secondary" className="ml-1 font-normal">
              {orders.length}
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("addOrder")}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/orders/${o.id}`}
                    className="font-medium hover:underline"
                  >
                    {o.number}
                  </Link>
                  <Badge variant="outline" className="text-[10px]">
                    {o.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {o.customerName}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{o.priceFormatted}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title={t("removeOrder")}
                disabled={removing === o.id || orders.length <= 1}
                onClick={() => onRemove(o.id)}
              >
                {removing === o.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      <OrderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        shipmentId={shipmentId}
        locale={locale}
        onAdded={() => router.refresh()}
        excludeIds={orders.map((o) => o.id)}
        labels={{
          title: t("addOrder"),
          description: t("addOrderDescription"),
          search: t("searchOrders"),
          empty: t("noOrdersFound"),
          add: tCommon("save"),
          cancel: tCommon("cancel"),
        }}
      />
    </Card>
  );
}

function OrderPickerDialog({
  open,
  onOpenChange,
  shipmentId,
  onAdded,
  excludeIds,
  locale,
  labels,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipmentId: string;
  onAdded: () => void;
  excludeIds: string[];
  locale: string;
  labels: {
    title: string;
    description: string;
    search: string;
    empty: string;
    add: string;
    cancel: string;
  };
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<
    Awaited<ReturnType<typeof searchOrdersForShipment>>
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState<string | null>(null);

  const runSearch = React.useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const data = await searchOrdersForShipment(query, shipmentId);
        setResults(data);
      } finally {
        setLoading(false);
      }
    },
    [shipmentId],
  );

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(q), 200);
    return () => clearTimeout(t);
  }, [open, q, runSearch]);

  const onPick = async (orderId: string) => {
    setAdding(orderId);
    try {
      await addOrderToShipment(shipmentId, orderId);
      toast.success(labels.add);
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAdding(null);
    }
  };

  const filtered = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={labels.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                …
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {labels.empty}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={adding !== null}
                    onClick={() => onPick(o.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{o.number}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {o.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.customerName}
                      </div>
                    </div>
                    <div className="font-mono text-sm">
                      {formatCurrency(o.price, o.currency, locale)}
                    </div>
                    {adding === o.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
