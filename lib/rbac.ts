import { Role } from "@/lib/enums";

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  ACCOUNTANT: "Accountant",
  CUSTOMER: "Customer",
};

export const allRoles = Object.values(Role);

export const adminRoles: Role[] = ["ADMIN"];
export const staffRoles: Role[] = ["ADMIN", "DISPATCHER", "ACCOUNTANT"];
export const dispatchRoles: Role[] = ["ADMIN", "DISPATCHER"];
export const accountingRoles: Role[] = ["ADMIN", "ACCOUNTANT"];

export function hasRole(userRole: Role | undefined, allowed: Role[]) {
  return !!userRole && allowed.includes(userRole);
}

export function roleHomePath(role: Role | undefined): string {
  switch (role) {
    case "DRIVER":
      return "/driver";
    case "CUSTOMER":
      return "/portal";
    default:
      return "/overview";
  }
}
