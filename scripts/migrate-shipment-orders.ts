/**
 * Backfill the ShipmentOrder join table from the legacy Shipment.orderId column.
 * Safe to run multiple times — uses upsert keyed on (shipmentId, orderId).
 *
 * Run BEFORE removing Shipment.orderId from the schema.
 */
import { prisma } from "../lib/db";

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; orderId: string | null }[]>(
    `SELECT id, orderId FROM Shipment WHERE orderId IS NOT NULL`,
  );
  console.log(`Found ${rows.length} legacy shipment->order rows to backfill.`);

  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r.orderId) {
      skipped++;
      continue;
    }
    try {
      await prisma.shipmentOrder.upsert({
        where: { shipmentId_orderId: { shipmentId: r.id, orderId: r.orderId } },
        update: {},
        create: { shipmentId: r.id, orderId: r.orderId, sortOrder: 0 },
      });
      inserted++;
    } catch (e) {
      console.error(`Failed to backfill shipment ${r.id} order ${r.orderId}:`, e);
    }
  }

  console.log(`Done. Upserted ${inserted}, skipped ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
