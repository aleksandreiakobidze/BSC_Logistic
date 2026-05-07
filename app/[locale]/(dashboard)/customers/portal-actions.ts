"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { Role } from "@/lib/enums";
import { adminRoles } from "@/lib/rbac";

const PASSWORD_MIN = 8;

const createSchema = z.object({
  customerId: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(120).optional(),
  password: z.string().min(PASSWORD_MIN).max(128),
});

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(PASSWORD_MIN).max(128),
});

const updateSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(120).optional(),
});

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/**
 * Provision portal access for a Customer: creates a User with role=CUSTOMER,
 * `customerId` set, and a bcrypt-hashed password. The Credentials provider
 * (lib/auth.ts) accepts CUSTOMER users uniformly, so the customer can log in
 * to /portal immediately afterwards.
 *
 * Email must be globally unique on the User table (existing constraint).
 *
 * Returns a discriminated union instead of throwing for known business
 * validations so the client can handle them gracefully without surfacing
 * a 500 in the network tab.
 */
export async function createCustomerPortalUser(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ userId: string }>> {
  const { session, orgId } = await requireRole(adminRoles);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, orgId },
    select: { id: true, name: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };

  const email = data.email.toLowerCase();

  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists) {
    return { ok: false, error: "A user with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        orgId,
        customerId: customer.id,
        email,
        name: data.name?.trim() || customer.name,
        role: Role.CUSTOMER,
        isActive: true,
        passwordHash,
      },
      select: { id: true, email: true },
    });

    await audit({
      action: "customer.portal.create",
      entity: "User",
      entityId: user.id,
      orgId,
      userId: session.user.id,
      meta: { customerId: customer.id, email: user.email },
    });

    revalidatePath(`/customers/${customer.id}`);
    return { ok: true, userId: user.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "A user with this email already exists." };
    }
    throw err;
  }
}

/**
 * Reset the password on an existing portal user. Verifies the user belongs
 * to the same org and that they're a CUSTOMER (so this can't be misused to
 * reset staff passwords).
 */
export async function resetCustomerPortalPassword(
  input: z.input<typeof resetSchema>,
): Promise<ActionResult> {
  const { session, orgId } = await requireRole(adminRoles);
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const user = await prisma.user.findFirst({
    where: { id: data.userId, orgId, role: Role.CUSTOMER },
    select: { id: true, customerId: true, email: true },
  });
  if (!user) return { ok: false, error: "Portal user not found" };

  const passwordHash = await bcrypt.hash(data.password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await audit({
    action: "customer.portal.resetPassword",
    entity: "User",
    entityId: user.id,
    orgId,
    userId: session.user.id,
    meta: { email: user.email },
  });

  if (user.customerId) revalidatePath(`/customers/${user.customerId}`);
  return { ok: true };
}

/**
 * Update an existing portal user's login email (and optionally display name).
 * Same admin gate + CUSTOMER-role guard as the password reset so this can't
 * be repurposed to rename staff accounts. Globally-unique `email` collisions
 * surface as a friendly error rather than a 500.
 */
export async function updateCustomerPortalUser(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<{ unchanged?: boolean }>> {
  const { session, orgId } = await requireRole(adminRoles);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const user = await prisma.user.findFirst({
    where: { id: data.userId, orgId, role: Role.CUSTOMER },
    select: { id: true, customerId: true, email: true, name: true },
  });
  if (!user) return { ok: false, error: "Portal user not found" };

  const newEmail = data.email.toLowerCase();
  const newName = data.name?.trim() || user.name;

  if (newEmail === user.email && newName === user.name) {
    return { ok: true, unchanged: true };
  }

  if (newEmail !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "Another user already uses this email." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail, name: newName },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "Another user already uses this email." };
    }
    throw err;
  }

  await audit({
    action: "customer.portal.updateProfile",
    entity: "User",
    entityId: user.id,
    orgId,
    userId: session.user.id,
    meta: {
      from: { email: user.email, name: user.name },
      to: { email: newEmail, name: newName },
    },
  });

  if (user.customerId) revalidatePath(`/customers/${user.customerId}`);
  return { ok: true };
}
