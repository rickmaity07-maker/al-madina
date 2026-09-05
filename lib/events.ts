import { EventEmitter } from "events";

// A simple in-process event bus used to push "new order" / "order updated"
// events to any open admin dashboard tabs over Server-Sent Events (SSE).
//
// NOTE: this works great for a single-server deployment (a VPS, a small
// Docker container, `next start` on one machine) which is the normal setup
// for a single grocery store. If this is ever deployed across multiple
// serverless instances at once, swap this for a small Redis pub/sub channel
// instead — the SSE route (app/api/orders/stream/route.ts) is the only place
// that would need to change.
const globalForEvents = globalThis as unknown as { orderEvents?: EventEmitter };

export const orderEvents = globalForEvents.orderEvents ?? new EventEmitter();
orderEvents.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.orderEvents = orderEvents;
}

export type OrderEvent =
  | { type: "new_order"; orderId: string; orderNumber: string }
  | { type: "order_updated"; orderId: string; status: string };

export function broadcastOrderEvent(event: OrderEvent) {
  orderEvents.emit("event", event);
}
