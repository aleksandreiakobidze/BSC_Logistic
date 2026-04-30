"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";

const generateSchema = z.object({
  driverId: z.string().min(1),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function generateSettlement(input: z.infer<typeof generateSchema>) {
  const { session, orgId } = await requireOrg();
  const data = generateSchema.parse(input);

  const driver = await prisma.driver.findFirst({
    where: { id: data.driverId, orgId },
    select: { id: true, payRatePerKm: true, payRateFlat: true },
  });
  if (!driver) {
    return { ok: false, error: "Driver not found" } as const;
  }

  const periodFrom = new Date(data.periodFrom);
  const periodTo = new Date(data.periodTo);
  if (periodTo < periodFrom) {
    return { ok: false, error: "Invalid period" } as const;
  }

  const inclusiveEnd = new Date(periodTo);
  inclusiveEnd.setHours(23, 59, 59, 999);

  const [shipments, deductionExpenses] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        orgId,
        driverId: data.driverId,
        completedAt: { gte: periodFrom, lte: inclusiveEnd },
      },
      select: {
        actualDistanceKm: true,
        plannedDistanceKm: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        orgId,
        driverId: data.driverId,
        incurredAt: { gte: periodFrom, lte: inclusiveEnd },
      },
      select: { amount: true },
    }),
  ]);

  const totalKm = shipments.reduce(
    (acc, s) =>
      acc + Number(s.actualDistanceKm ?? s.plannedDistanceKm ?? 0),
    0,
  );
  const ratePerKm = Number(driver.payRatePerKm);
  const flatPerShipment = Number(driver.payRateFlat);
  const grossRaw = totalKm * ratePerKm + flatPerShipment * shipments.length;
  const gross = Math.round(grossRaw * 100) / 100;

  const deductions = Math.round(
    deductionExpenses.reduce((acc, e) => acc + Number(e.amount), 0) * 100,
  ) / 100;

  const net = Math.max(0, Math.round((gross - deductions) * 100) / 100);

  const settlement = await prisma.settlement.create({
    data: {
      orgId,
      driverId: data.driverId,
      periodFrom,
      periodTo: inclusiveEnd,
      totalKm,
      gross,
      deductions,
      net,
      currency: "USD",
      notes: data.notes ?? null,
    },
  });

  await audit({
    action: "settlement.create",
    entity: "Settlement",
    entityId: settlement.id,
    orgId,
    userId: session.user.id,
    meta: { driverId: data.driverId, totalKm, gross, deductions, net },
  });

  revalidatePath("/drivers/settlements");
  revalidatePath(`/drivers/${data.driverId}`);
  return { ok: true as const, id: settlement.id, net };
}

export async function deleteSettlement(id: string) {
  const { session, orgId } = await requireOrg();
  const settlement = await prisma.settlement.findFirst({
    where: { id, orgId },
    select: { id: true, paidAt: true },
  });
  if (!settlement) return { ok: false, error: "Settlement not found" } as const;
  if (settlement.paidAt) {
    return { ok: false, error: "Cannot delete a paid settlement" } as const;
  }
  await prisma.settlement.delete({ where: { id } });
  await audit({
    action: "settlement.delete",
    entity: "Settlement",
    entityId: id,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/drivers/settlements");
  return { ok: true as const };
}
