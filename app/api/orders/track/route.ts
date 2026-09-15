import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { orderNumber, email } = await req.json().catch(() => ({}));
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Order number and email are required." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.trim().toUpperCase() },
    include: { items: true, statusEvents: { orderBy: { createdAt: "asc" } } },
  });

  if (!order || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: "No order found with that order number and email." }, { status: 404 });
  }

  return NextResponse.json(order);
}
