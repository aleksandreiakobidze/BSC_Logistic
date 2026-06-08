import crypto from "node:crypto";
import { ShipmentStatus } from "@/lib/enums";

/**
 * Thin wrapper around the AfterShip REST API + webhook signature
 * verification. Used to register newly created shipments for automatic
 * carrier polling and to translate inbound webhook payloads into our local
 * `ShipmentStatus` + `ShipmentEvent` rows.
 *
 * The AfterShip integration is deliberately optional: every code path here
 * checks `isAftershipConfigured()` first so a missing API key never breaks
 * shipment creation - it just disables external tracking.
 *
 * Reference docs: https://docs.aftership.com/
 */

const AFTERSHIP_BASE_URL = "https://api.aftership.com/v4";

export interface AftershipTracking {
  id: string;
  slug: string;
  tracking_number: string;
  tag?: string;
  expected_delivery?: string | null;
  checkpoints?: AftershipCheckpoint[];
}

export interface AftershipCheckpoint {
  message?: string;
  tag?: string;
  subtag?: string;
  checkpoint_time?: string;
  city?: string;
  country_iso3?: string;
  coordinates?: [number, number]; // [lng, lat]
  raw_tag?: string;
  location?: string;
}

export function isAftershipConfigured(): boolean {
  return Boolean(process.env.AFTERSHIP_API_KEY?.trim());
}

/**
 * Register a new tracking number with AfterShip. Returns the created
 * tracking object - persist `id` as `Shipment.externalTrackingId` so the
 * webhook handler can match incoming events back to the local row.
 */
export async function registerAftershipTracking(input: {
  slug: string;
  trackingNumber: string;
  title?: string;
}): Promise<AftershipTracking | null> {
  if (!isAftershipConfigured()) return null;
  const apiKey = process.env.AFTERSHIP_API_KEY!.trim();

  const res = await fetch(`${AFTERSHIP_BASE_URL}/trackings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "aftership-api-key": apiKey,
    },
    body: JSON.stringify({
      tracking: {
        slug: input.slug,
        tracking_number: input.trackingNumber,
        title: input.title,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AfterShip create-tracking failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    data?: { tracking?: AftershipTracking };
  };
  return json.data?.tracking ?? null;
}

export async function getAftershipTracking(
  trackingId: string,
): Promise<AftershipTracking | null> {
  if (!isAftershipConfigured()) return null;
  const apiKey = process.env.AFTERSHIP_API_KEY!.trim();

  const res = await fetch(`${AFTERSHIP_BASE_URL}/trackings/${trackingId}`, {
    headers: { "aftership-api-key": apiKey },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AfterShip get-tracking failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    data?: { tracking?: AftershipTracking };
  };
  return json.data?.tracking ?? null;
}

/**
 * Verify the HMAC-SHA256 signature on an inbound webhook. AfterShip signs
 * the raw request body with the shared `AFTERSHIP_WEBHOOK_SECRET` and sends
 * the digest in the `aftership-hmac-sha256` request header.
 */
export function verifyAftershipWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.AFTERSHIP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[aftership] AFTERSHIP_WEBHOOK_SECRET is unset; rejecting webhook",
    );
    return false;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // AfterShip uses base64; constant-time compare to avoid timing attacks.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Translate an AfterShip "tag" (their canonical status) into our internal
 * `ShipmentStatus`. Anything we don't recognise returns `null` so the
 * webhook handler can still record a checkpoint without flipping status.
 *
 * AfterShip tag reference:
 * https://www.aftership.com/docs/tracking/api-status-and-substatus
 */
export function mapAftershipTagToStatus(
  tag: string | undefined | null,
): ShipmentStatus | null {
  if (!tag) return null;
  switch (tag) {
    case "Pending":
    case "InfoReceived":
      return ShipmentStatus.PLANNED;
    case "InTransit":
    case "OutForDelivery":
    case "AvailableForPickup":
      return ShipmentStatus.IN_TRANSIT;
    case "Delivered":
      return ShipmentStatus.DELIVERED;
    case "Exception":
    case "AttemptFail":
    case "Expired":
      return ShipmentStatus.FAILED;
    default:
      return null;
  }
}
