import { Badge } from "@/components/ui/badge";
import type {
  ShipmentStatus,
  OrderStatus,
  InvoiceStatus,
  VehicleStatus,
  DriverStatus,
  QuotationStatus,
  CustomerStatus,
} from "@/lib/enums";

type Variant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "muted";

const shipment: Record<ShipmentStatus, Variant> = {
  PLANNED: "muted",
  ASSIGNED: "default",
  PICKED_UP: "warning",
  IN_TRANSIT: "warning",
  DELIVERED: "success",
  FAILED: "destructive",
  CANCELLED: "muted",
};

const order: Record<OrderStatus, Variant> = {
  QUOTE: "muted",
  CONFIRMED: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "muted",
};

const invoice: Record<InvoiceStatus, Variant> = {
  DRAFT: "muted",
  SENT: "default",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "muted",
};

const vehicle: Record<VehicleStatus, Variant> = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  INACTIVE: "muted",
};

const driver: Record<DriverStatus, Variant> = {
  AVAILABLE: "success",
  ON_DUTY: "warning",
  OFF_DUTY: "muted",
  SUSPENDED: "destructive",
};

const quotation: Record<QuotationStatus, Variant> = {
  DRAFT: "muted",
  SENT: "default",
  COUNTERED: "warning",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CONVERTED: "success",
  CANCELLED: "muted",
};

const customer: Record<CustomerStatus, Variant> = {
  PROSPECT: "warning",
  ACTIVE: "success",
  INACTIVE: "muted",
};

const variants = {
  shipment,
  order,
  invoice,
  vehicle,
  driver,
  quotation,
  customer,
} as const;

export function StatusBadge({
  kind,
  status,
  label,
}: {
  kind: keyof typeof variants;
  status: string;
  label?: string;
}) {
  const v = (variants[kind] as Record<string, Variant>)[status] ?? "default";
  return (
    <Badge variant={v}>
      {label ?? status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}
