import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { staffRoles } from "@/lib/rbac";
import { Role } from "@/lib/enums";
import {
  subscribeToShipment,
  type ShipmentEventPayload,
} from "@/lib/shipment-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a single shipment. The customer portal
 * shipment-detail page subscribes here for live status / checkpoint
 * updates pushed by `publishShipmentEvent` (server actions, driver actions,
 * AfterShip webhook).
 *
 * Auth: CUSTOMER may view a shipment only if at least one of its orders
 * belongs to them; staff users must share the shipment's `orgId`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      orderLinks: { select: { order: { select: { customerId: true } } } },
    },
  });
  if (!shipment) {
    return new Response("Not found", { status: 404 });
  }

  if (session.user.role === Role.CUSTOMER) {
    const customerId = session.user.customerId;
    const owns =
      !!customerId &&
      shipment.orderLinks.some((l) => l.order.customerId === customerId);
    if (!owns) {
      return new Response("Forbidden", { status: 403 });
    }
  } else if (staffRoles.includes(session.user.role as never)) {
    if (session.user.orgId !== shipment.orgId) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(": ready\n\n");
      safeEnqueue(`event: hello\ndata: ${JSON.stringify({ shipmentId: id })}\n\n`);

      const unsubscribe = subscribeToShipment(id, (event: ShipmentEventPayload) => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(": ping\n\n");
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
