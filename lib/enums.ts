/**
 * SQLite-friendly enum shim.
 *
 * The Prisma SQLite provider does not support native enums. Instead of scattering
 * string literals across the codebase, we re-declare each "enum" here as a frozen
 * const object plus a union-string type. All runtime imports (e.g. `ShipmentStatus.DELIVERED`)
 * and type imports (e.g. `type Role`) keep working unchanged.
 */

export const Role = {
  ADMIN: "ADMIN",
  DISPATCHER: "DISPATCHER",
  DRIVER: "DRIVER",
  ACCOUNTANT: "ACCOUNTANT",
  CUSTOMER: "CUSTOMER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const VehicleType = {
  TRUCK: "TRUCK",
  VAN: "VAN",
  TRAILER: "TRAILER",
  REEFER: "REEFER",
  TANKER: "TANKER",
  CAR: "CAR",
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const VehicleStatus = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
} as const;
export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export const MaintenanceKind = {
  SCHEDULED: "SCHEDULED",
  REPAIR: "REPAIR",
  INSPECTION: "INSPECTION",
  TIRES: "TIRES",
  OIL: "OIL",
  OTHER: "OTHER",
} as const;
export type MaintenanceKind = (typeof MaintenanceKind)[keyof typeof MaintenanceKind];

export const DriverStatus = {
  AVAILABLE: "AVAILABLE",
  ON_DUTY: "ON_DUTY",
  OFF_DUTY: "OFF_DUTY",
  SUSPENDED: "SUSPENDED",
} as const;
export type DriverStatus = (typeof DriverStatus)[keyof typeof DriverStatus];

export const OrderStatus = {
  QUOTE: "QUOTE",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ShipmentStatus = {
  PLANNED: "PLANNED",
  ASSIGNED: "ASSIGNED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const StopKind = {
  PICKUP: "PICKUP",
  DROPOFF: "DROPOFF",
  WAYPOINT: "WAYPOINT",
} as const;
export type StopKind = (typeof StopKind)[keyof typeof StopKind];

export const EventType = {
  CREATED: "CREATED",
  ASSIGNED: "ASSIGNED",
  STATUS_CHANGE: "STATUS_CHANGE",
  LOCATION: "LOCATION",
  POD_UPLOADED: "POD_UPLOADED",
  NOTE: "NOTE",
  DELAY: "DELAY",
  EXCEPTION: "EXCEPTION",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const MovementKind = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
  TRANSFER: "TRANSFER",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type MovementKind = (typeof MovementKind)[keyof typeof MovementKind];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentKind = {
  RECEIVABLE: "RECEIVABLE",
  SETTLEMENT_PAYOUT: "SETTLEMENT_PAYOUT",
} as const;
export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];

export const PaymentMethod = {
  CASH: "CASH",
  BANK: "BANK",
  CARD: "CARD",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const DocKind = {
  WAYBILL: "WAYBILL",
  CMR: "CMR",
  BOL: "BOL",
  POD: "POD",
  INVOICE: "INVOICE",
  INSURANCE: "INSURANCE",
  TECH_INSPECTION: "TECH_INSPECTION",
  LICENSE: "LICENSE",
  OTHER: "OTHER",
} as const;
export type DocKind = (typeof DocKind)[keyof typeof DocKind];

export const LeadStatus = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadSource = {
  WEBSITE: "WEBSITE",
  PHONE: "PHONE",
  REFERRAL: "REFERRAL",
  EMAIL: "EMAIL",
  TENDER: "TENDER",
  SOCIAL: "SOCIAL",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const ActivityKind = {
  NOTE: "NOTE",
  CALL: "CALL",
  EMAIL: "EMAIL",
  MEETING: "MEETING",
  STATUS_CHANGE: "STATUS_CHANGE",
} as const;
export type ActivityKind = (typeof ActivityKind)[keyof typeof ActivityKind];

export const LeadPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type LeadPriority = (typeof LeadPriority)[keyof typeof LeadPriority];

export const CustomerStatus = {
  PROSPECT: "PROSPECT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const QuotationStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  COUNTERED: "COUNTERED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  CONVERTED: "CONVERTED",
  CANCELLED: "CANCELLED",
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
