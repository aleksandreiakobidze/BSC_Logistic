import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ShipmentStatus } from "@/lib/enums";
import {
  mapAftershipTagToStatus,
  verifyAftershipWebhookSignature,
  type AftershipCheckpoint,
} from "@/lib/aftership";
import { publishShipmentEvent } from "@/lib/shipment-events";

/**
 * AfterShip webhook receiver.
 *
 * AfterShip POSTs a JSON envelope when carrier checkpoints update. We:
 *   1. Verify the HMAC signature.
 *   2. Look up our local Shipment by `externalTrackingId`.
 *   3. Insert any new checkpoints as `ShipmentEvent` rows
 *      (idempotent on `(shipmentId, type, note, createdAt)`).
 *   4. If the canonical AfterShip `tag` maps to a different
 *      `ShipmentStatus` than the current row, advance status and emit a
 *      `STATUS_CHANGE` event.
 *   5. Publish to the SSE channel + revalidate portal pages.
 *
 * The handler always returns 2xx for accepted-but-unknown shipments so
 * AfterShip doesn't keep retrying forever.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("aftership-hmac-sha256") ??
    req.headers.get("x-aftership-hmac-sha256") ??
    null;

  if (!verifyAftershipWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: {
    msg?: { tracking?: AftershipTrackingPayload };
    tracking?: AftershipTrackingPayload;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[aftership webhook] invalid JSON", err);
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const tracking = payload.msg?.tracking ?? payload.tracking;
  if (!tracking?.id) {
    return NextResponse.json({ ok: true, ignored: "no-tracking-id" });
  }

  const shipment = await prisma.shipment.findFirst({
    where: { externalTrackingId: tracking.id },
    select: { id: true, status: true, trackingCode: true, completedAt: true, startedAt: true },
  });
  if (!shipment) {
    // Unknown tracking - acknowledge so AfterShip stops retrying.
    return NextResponse.json({ ok: true, ignored: "unknown-shipment" });
  }

  const checkpoints = tracking.checkpoints ?? [];
  // Insert checkpoints as ShipmentEvent rows. We keep this idempotent by
  // including the checkpoint timestamp in the event note - re-deliveries
  // won't double up because we filter them server-side first.
  if (checkpoints.length > 0) {
    const existing = await prisma.shipmentEvent.findMany({
      where: { shipmentId: shipment.id, type: "EXTERNAL_TRACKING" },
      select: { note: true },
    });
    const seen = new Set(existing.map((e) => e.note));

    const fresh = checkpoints.filter((c) => {
      const key = checkpointKey(c);
      return !seen.has(key);
    });

    if (fresh.length > 0) {
      await prisma.shipmentEvent.createMany({
        data: fresh.map((c) => {
          const lat =
            Array.isArray(c.coordinates) && c.coordinates.length === 2
              ? c.coordinates[1]
              : null;
          const lng =
            Array.isArray(c.coordinates) && c.coordinates.length === 2
              ? c.coordinates[0]
              : null;
          return {
            shipmentId: shipment.id,
            type: "EXTERNAL_TRACKING",
            note: checkpointKey(c),
            lat: lat ?? null,
            lng: lng ?? null,
            meta: JSON.stringify(c),
          };
        }),
      });
    }
  }

  // Possibly advance status from the canonical tag.
  const nextStatus = mapAftershipTagToStatus(tracking.tag);
  if (nextStatus && nextStatus !== (shipment.status as ShipmentStatus)) {
    const data: {
      status: ShipmentStatus;
      startedAt?: Date | null;
      completedAt?: Date | null;
    } = { status: nextStatus };

    if (
      (nextStatus === ShipmentStatus.PICKED_UP ||
        nextStatus === ShipmentStatus.IN_TRANSIT) &&
      !shipment.startedAt
    ) {
      data.startedAt = new Date();
    }
    if (
      (nextStatus === ShipmentStatus.DELIVERED ||
        nextStatus === ShipmentStatus.FAILED ||
        nextStatus === ShipmentStatus.CANCELLED) &&
      !shipment.completedAt
    ) {
      data.completedAt = new Date();
    }

    await prisma.shipment.update({ where: { id: shipment.id }, data });
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        type: "STATUS_CHANGE",
        note: `${nextStatus}: AfterShip tag=${tracking.tag}`,
      },
    });
  }

  publishShipmentEvent(shipment.id, {
    type: "EXTERNAL_TRACKING",
    note: tracking.tag ?? undefined,
  });

  revalidatePath(`/shipments/${shipment.id}`);
  revalidatePath(`/portal/shipments/${shipment.id}`);
  revalidatePath(`/portal/track/${shipment.trackingCode}`);

  return NextResponse.json({ ok: true });
}

interface AftershipTrackingPayload {
  id: string;
  tag?: string;
  checkpoints?: AftershipCheckpoint[];
}

function checkpointKey(c: AftershipCheckpoint): string {
  // Timestamp + tag is enough for de-duplication; we keep the human
  // message in the event row's `meta` JSON for the timeline.
  return `${c.checkpoint_time ?? ""}|${c.tag ?? ""}|${c.message ?? ""}`;
}
