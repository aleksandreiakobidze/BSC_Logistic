import {
  LayoutDashboard,
  Truck,
  Package,
  Wrench,
  Users,
  Users2,
  Building2,
  Warehouse,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  Map,
  Route,
  UserPlus,
  Wallet,
  HandCoins,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/enums";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: Role[];
};

export type NavGroup = {
  labelKey?: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/overview", labelKey: "nav.overview", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "nav.shipments",
    items: [
      { href: "/orders", labelKey: "nav.orders", icon: Package },
      { href: "/shipments", labelKey: "nav.shipments", icon: Truck },
      { href: "/trips", labelKey: "nav.trips", icon: Route, roles: ["ADMIN", "DISPATCHER"] },
      { href: "/dispatch", labelKey: "nav.dispatch", icon: Route, roles: ["ADMIN", "DISPATCHER"] },
      { href: "/tracking", labelKey: "nav.tracking", icon: Map },
    ],
  },
  {
    labelKey: "nav.fleet",
    items: [
      { href: "/fleet/vehicles", labelKey: "nav.vehicles", icon: Truck },
      { href: "/fleet/maintenance", labelKey: "nav.maintenance", icon: Wrench },
      { href: "/drivers", labelKey: "nav.drivers", icon: Users },
      {
        href: "/drivers/settlements",
        labelKey: "nav.settlements",
        icon: HandCoins,
        roles: ["ADMIN", "ACCOUNTANT"],
      },
    ],
  },
  {
    labelKey: "nav.crm",
    items: [
      { href: "/customers", labelKey: "nav.customers", icon: Building2 },
      { href: "/contacts", labelKey: "nav.contacts", icon: Users2 },
      {
        href: "/leads",
        labelKey: "nav.leads",
        icon: UserPlus,
        roles: ["ADMIN", "DISPATCHER"],
      },
      {
        href: "/quotations",
        labelKey: "nav.quotations",
        icon: FileSignature,
        roles: ["ADMIN", "DISPATCHER"],
      },
      {
        href: "/suppliers",
        labelKey: "nav.suppliers",
        icon: Truck,
        roles: ["ADMIN", "DISPATCHER"],
      },
      { href: "/items", labelKey: "nav.items", icon: Package },
      { href: "/warehouse", labelKey: "nav.warehouse", icon: Warehouse },
    ],
  },
  {
    labelKey: "nav.invoices",
    items: [
      { href: "/invoices", labelKey: "nav.invoices", icon: FileText, roles: ["ADMIN", "ACCOUNTANT", "DISPATCHER"] },
      { href: "/payments", labelKey: "nav.payments", icon: Wallet, roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/expenses", labelKey: "nav.expenses", icon: Receipt, roles: ["ADMIN", "ACCOUNTANT"] },
      { href: "/reports", labelKey: "nav.reports", icon: BarChart3 },
    ],
  },
  {
    items: [
      { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export const bottomNav: NavItem[] = [
  { href: "/overview", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/shipments", labelKey: "nav.shipments", icon: Truck },
  { href: "/dispatch", labelKey: "nav.dispatch", icon: Route },
  { href: "/invoices", labelKey: "nav.invoices", icon: FileText },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];
