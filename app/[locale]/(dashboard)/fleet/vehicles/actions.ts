"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { VehicleStatus, VehicleType } from "@/lib/enums";

const schema = z.object({
  plate: z.string().min(1),
  vin: z.string().optional(),
  type: z.nativeEnum(VehicleType).default(VehicleType.TRUCK),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  capacityKg: z.coerce.number().int().min(0).optional(),
  capacityM3: z.coerce.number().min(0).optional(),
  odometerKm: z.coerce.number().int().min(0).default(0),
  fuelType: z.string().optional(),
  notes: z.string().optional(),
});

export async function createVehicle(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = schema.parse(raw);

  const v = await prisma.vehicle.create({
    data: {
      orgId,
      plate: data.plate,
      vin: data.vin || null,
      type: data.type,
      status: data.status,
      make: data.make || null,
      model: data.model || null,
      year: data.year ?? null,
      capacityKg: data.capacityKg ?? null,
      capacityM3: data.capacityM3 ?? null,
      odometerKm: data.odometerKm,
      fuelType: data.fuelType || null,
      notes: data.notes || null,
    },
  });
  await audit({ action: "vehicle.create", entity: "Vehicle", entityId: v.id, orgId, userId: session.user.id });
  revalidatePath("/fleet/vehicles");
  return { ok: true, id: v.id };
}
