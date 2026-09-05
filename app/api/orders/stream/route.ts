import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { orderEvents, type OrderEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// Admin only: Server-Sent Events stream. The admin dashboard keeps this
// connection open; the moment a new order is placed, an event is pushed
// down the wire and the dashboard plays the notification sound + refreshes.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  let onEvent: (event: OrderEvent) => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n`));

      onEvent = (event: OrderEvent) => {
        controller.enqueue(encoder.encode(`event: order\ndata: ${JSON.stringify(event)}\n\n`));
      };
      orderEvents.on("event", onEvent);

      // Keep the connection alive through proxies/load balancers.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25000);
    },
    cancel() {
      orderEvents.off("event", onEvent);
      clearInterval(heartbeat);
    },
  });

  req.signal.addEventListener("abort", () => {
    orderEvents.off("event", onEvent);
    clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
