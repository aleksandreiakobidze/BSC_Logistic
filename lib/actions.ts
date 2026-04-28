import { auth } from "./auth";
import { redirect } from "next/navigation";
import { hasRole } from "./rbac";
import type { Role } from "@/lib/enums";

export async function getSessionOrRedirect() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireOrg() {
  const session = await getSessionOrRedirect();
  if (!session.user.orgId) {
    throw new Error("No organization associated with user");
  }
  return { session, orgId: session.user.orgId };
}

export async function requireRole(roles: Role[]) {
  const { session, orgId } = await requireOrg();
  if (!hasRole(session.user.role, roles)) {
    throw new Error("Forbidden");
  }
  return { session, orgId };
}
