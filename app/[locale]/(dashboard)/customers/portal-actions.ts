"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
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

const updateEmailSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
});

/**
 * Provision portal access for a Customer: creates a User with role=CUSTOMER,
 * `customerId` set, and a bcrypt-hashed password. The Credentials provider
 * (lib/auth.ts) accepts CUSTOMER users uniformly, so the customer can log in
 * to /portal immediately afterwards.
 *
 * Email must be globally unique on the User table (existing constraint).
 */
export async function createCustomerPortalUser(input: z.input<typeof createSchema>) {
  const { session, orgId } = await requireRole(adminRoles);
  const data = createSchema.parse(input);

  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: data.customerId, orgId },
    select: { id: true, name: true },
  });

  const exists = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    select: { id: true },
  });
  if (exists) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      orgId,
      customerId: customer.id,
      email: data.email.toLowerCase(),
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
}

/**
 * Reset the password on an existing portal user. Verifies the user belongs
 * to the same org and that they're a CUSTOMER (so this can't be misused to
 * reset staff passwords).
 */
export async function resetCustomerPortalPassword(input: z.input<typeof resetSchema>) {
  const { session, orgId } = await requireRole(adminRoles);
  const data = resetSchema.parse(input);

  const user = await prisma.user.findFirst({
    where: { id: data.userId, orgId, role: Role.CUSTOMER },
    select: { id: true, customerId: true, email: true },
  });
  if (!user) throw new Error("Portal user not found");

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
 * Update the login email of an existing portal user. Verifies that the user
 * belongs to the same org and is a CUSTOMER (so this can't be misused to
 * change staff emails). Email must remain globally unique on the User table.
 */
export async function updateCustomerPortalEmail(input: z.input<typeof updateEmailSchema>) {
  const { session, orgId } = await requireRole(adminRoles);
  const data = updateEmailSchema.parse(input);
  const newEmail = data.email.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { id: data.userId, orgId, role: Role.CUSTOMER },
    select: { id: true, customerId: true, email: true },
  });
  if (!user) throw new Error("Portal user not found");

  if (newEmail !== user.email) {
    const exists = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (exists && exists.id !== user.id) {
      throw new Error("A user with this email already exists.");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail },
  });

  await audit({
    action: "customer.portal.updateEmail",
    entity: "User",
    entityId: user.id,
    orgId,
    userId: session.user.id,
    meta: { previousEmail: user.email, email: newEmail },
  });

  if (user.customerId) revalidatePath(`/customers/${user.customerId}`);
  return { ok: true };
}
