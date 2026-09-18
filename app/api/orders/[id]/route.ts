// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";
import { getOrderById, setOrderStatus } from "@/lib/orders";

// Admin only: move an order to PACKED or OUT_FOR_DELIVERY.
// (Marking DELIVERED is done by the delivery person via the /deliver/[token] link, not here —
// but an admin can also do it from the dashboard if needed.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const existing = await getOrderById(id);
  if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  await setOrderStatus(id, status);
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  broadcastOrderEvent({ type: "order_updated", orderId: order.id, status: order.status });

  // See app/api/orders/route.ts for why this is wrapped in after() rather
  // than a bare fire-and-forget .catch() — same Vercel timing issue applies here.
  after(async () => {
    await sendStatusUpdateEmail(order).catch((e: unknown) => console.error("[mailer] status email failed", e));
  });

  return NextResponse.json(order);
}
