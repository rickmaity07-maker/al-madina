import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";

// No admin login here on purpose: the delivery person opens a link with a
// long random token in it (printed on the packing slip / sent by SMS/WhatsApp).
// The token is what protects this, the same way a parcel tracking link works.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await prisma.order.findUnique({ where: { deliveryToken: token }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json(order);
}

// The delivery person taps "Mark as received" — this is the only action this endpoint allows.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const existing = await prisma.order.findUnique({ where: { deliveryToken: token } });
  if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const order = await prisma.order.update({
    where: { deliveryToken: token },
    data: { status: "DELIVERED" },
    include: { items: true },
  });

  broadcastOrderEvent({ type: "order_updated", orderId: order.id, status: order.status });
  sendStatusUpdateEmail(order).catch((e: unknown) => console.error("[mailer] status email failed", e));

  return NextResponse.json(order);
}
