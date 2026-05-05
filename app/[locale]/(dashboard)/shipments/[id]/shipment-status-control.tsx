"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  PackageCheck,
  Truck,
  XCircle,
  Settings2,
  ChevronDown,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ShipmentStatus } from "@/lib/enums";
import { updateShipmentStatus } from "../actions";

type Status = ShipmentStatus;

type WorkflowAction = {
  label: string;
  to: Status;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "secondary" | "outline";
};

export function ShipmentStatusControl({
  shipmentId,
  currentStatus,
  hasDriver,
  isAdmin,
}: {
  shipmentId: string;
  currentStatus: Status;
  hasDriver: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("shipments");
  const [pending, setPending] = React.useState<Status | null>(null);

  const change = React.useCallback(
    async (next: Status) => {
      setPending(next);
      try {
        await updateShipmentStatus(shipmentId, next);
        toast.success(t("statusChanged"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      } finally {
        setPending(null);
      }
    },
    [router, shipmentId, t],
  );

  const workflow = React.useMemo<WorkflowAction[]>(() => {
    switch (currentStatus) {
      case ShipmentStatus.PLANNED:
        // Driver assignment is the natural next step (handled by AssignShipmentForm).
        // Allow forward jump if driver is already set.
        return hasDriver
          ? [{ label: t("markPickedUp"), to: ShipmentStatus.PICKED_UP, icon: Package }]
          : [];
      case ShipmentStatus.ASSIGNED:
        return [{ label: t("markPickedUp"), to: ShipmentStatus.PICKED_UP, icon: Package }];
      case ShipmentStatus.PICKED_UP:
        return [{ label: t("markInTransit"), to: ShipmentStatus.IN_TRANSIT, icon: Truck }];
      case ShipmentStatus.IN_TRANSIT:
        return [
          {
            label: t("markDelivered"),
            to: ShipmentStatus.DELIVERED,
            icon: PackageCheck,
          },
          {
            label: t("markFailed"),
            to: ShipmentStatus.FAILED,
            icon: XCircle,
            variant: "destructive",
          },
        ];
      default:
        return [];
    }
  }, [currentStatus, hasDriver, t]);

  const allStatuses = Object.values(ShipmentStatus) as Status[];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workflow.map((action) => {
        const Icon = action.icon;
        const isPending = pending === action.to;
        return (
          <Button
            key={action.to}
            size="sm"
            variant={action.variant ?? "default"}
            disabled={pending !== null}
            onClick={() => change(action.to)}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-1.5 h-4 w-4" />
            )}
            {action.label}
          </Button>
        );
      })}

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending !== null}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              {t("setStatus")}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{t("setStatus")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allStatuses.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === currentStatus || pending !== null}
                onClick={() => change(s)}
              >
                {s === ShipmentStatus.CANCELLED ? (
                  <Ban className="h-4 w-4 text-destructive" />
                ) : (
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                )}
                {t(`status.${s}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
