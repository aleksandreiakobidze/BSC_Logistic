"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enqueueNotification } from "@/lib/queue";
import { Role } from "@/lib/enums";

const orgSchema = z.object({
  name: z.string().min(1),
  baseCurrency: z.string().min(1).default("USD"),
  locale: z.enum(["en", "ka", "ru"]).default("en"),
});

export async function updateOrganization(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = orgSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.organization.update({ where: { id: orgId }, data });
  await audit({
    action: "org.update",
    entity: "Organization",
    entityId: orgId,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/settings");
  return { ok: true };
}

const branchSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function createBranch(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = branchSchema.parse(Object.fromEntries(formData.entries()));
  const b = await prisma.branch.create({ data: { orgId, ...data } });
  await audit({ action: "branch.create", entity: "Branch", entityId: b.id, orgId, userId: session.user.id });
  revalidatePath("/settings");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).default(Role.DISPATCHER),
});

export async function inviteUser(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = inviteSchema.parse(Object.fromEntries(formData.entries()));

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const inv = await prisma.invitation.create({
    data: {
      email: data.email,
      role: data.role,
      orgId,
      invitedById: session.user.id,
      token,
      expiresAt,
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${token}`;
  await enqueueNotification("email", {
    to: data.email,
    subject: "You've been invited to BSC Logistics",
    body: `<p>You've been invited to join as ${data.role}.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
  });

  await audit({
    action: "invite.create",
    entity: "Invitation",
    entityId: inv.id,
    orgId,
    userId: session.user.id,
    meta: { email: data.email, role: data.role },
  });
  revalidatePath("/settings");
  return { ok: true };
}
