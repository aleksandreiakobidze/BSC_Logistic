import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { staffRoles } from "@/lib/rbac";
import { Role } from "@/lib/enums";
import {
  subscribeToQuotation,
  type QuotationEvent,
  type ViewerRole,
} from "@/lib/quotation-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a single quotation. Both the admin page and
 * the customer portal subscribe here; the bus filters per `recipientRoles`
 * before each event is written to this connection so a customer never sees
 * staff-only payloads (and vice versa, when applicable).
 *
 * The route is auth-gated using the same rules as `postQuotationMessage`:
 * a `CUSTOMER` session must own the quotation, staff must share its `orgId`.
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

  const quote = await prisma.quotation.findUnique({
    where: { id },
    select: { id: true, orgId: true, customerId: true },
  });
  if (!quote) {
    return new Response("Not found", { status: 404 });
  }

  let viewerRole: ViewerRole;
  if (session.user.role === Role.CUSTOMER) {
    if (
      !session.user.customerId ||
      session.user.customerId !== quote.customerId
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    viewerRole = "CUSTOMER";
  } else if (staffRoles.includes(session.user.role as never)) {
    if (session.user.orgId !== quote.orgId) {
      return new Response("Forbidden", { status: 403 });
    }
    viewerRole = "ADMIN";
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

      // Initial comment so the client knows the stream is live, plus the
      // viewer role so chat panels can target unread state without another
      // round trip.
      safeEnqueue(": ready\n\n");
      safeEnqueue(`event: hello\ndata: ${JSON.stringify({ role: viewerRole })}\n\n`);

      const unsubscribe = subscribeToQuotation(id, (event: QuotationEvent) => {
        if (!event.recipientRoles.includes(viewerRole)) return;
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

      // Browser closed the tab / EventSource. Next.js exposes this on `req.signal`.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx (and similar) to never buffer this response.
      "X-Accel-Buffering": "no",
    },
  });
}
