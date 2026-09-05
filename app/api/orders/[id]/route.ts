import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";

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

  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: { items: true },
  });

  broadcastOrderEvent({ type: "order_updated", orderId: order.id, status: order.status });
  sendStatusUpdateEmail(order).catch((e: unknown) => console.error("[mailer] status email failed", e));

  return NextResponse.json(order);
}
