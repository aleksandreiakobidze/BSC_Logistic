import { prisma } from "./db";

export async function audit(params: {
  action: string;
  entity: string;
  entityId?: string;
  orgId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        orgId: params.orgId ?? null,
        userId: params.userId ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
