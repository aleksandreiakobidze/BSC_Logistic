"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { DriverStatus } from "@/lib/enums";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  licenseNo: z.string().min(1),
  licenseExpiry: z.string().optional(),
  status: z.nativeEnum(DriverStatus).default(DriverStatus.AVAILABLE),
  payRatePerKm: z.coerce.number().min(0).default(0),
  payRateFlat: z.coerce.number().min(0).default(0),
});

export async function createDriver(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const data = schema.parse(Object.fromEntries(formData.entries()));
  const d = await prisma.driver.create({
    data: {
      orgId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      licenseNo: data.licenseNo,
      licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
      status: data.status,
      payRatePerKm: data.payRatePerKm,
      payRateFlat: data.payRateFlat,
    },
  });
  await audit({ action: "driver.create", entity: "Driver", entityId: d.id, orgId, userId: session.user.id });
  revalidatePath("/drivers");
  return { ok: true, id: d.id };
}
