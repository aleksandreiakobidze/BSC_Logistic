"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
});

export async function updateCustomerProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.customerId || session.user.role !== "CUSTOMER") {
    return { error: "Unauthorized" };
  }

  const parsed = profileSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  await prisma.customer.update({
    where: { id: session.user.customerId },
    data: {
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      address: parsed.data.address || undefined,
      city: parsed.data.city || undefined,
      country: parsed.data.country || undefined,
    },
  });

  revalidatePath("/portal/profile");
  return { ok: true };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
});

export async function changePortalPassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return { error: "Unauthorized" };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "No password set" };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect" };
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash },
  });

  return { ok: true };
}
