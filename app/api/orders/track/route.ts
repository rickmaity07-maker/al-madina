// app/api/orders/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrderByNumber } from "@/lib/orders";

export async function POST(req: NextRequest) {
  const { orderNumber, email } = await req.json().catch(() => ({}));
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Order number and email are required." }, { status: 400 });
  }

  const order = await getOrderByNumber(orderNumber.trim().toUpperCase());

  if (!order || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: "No order found with that order number and email." }, { status: 404 });
  }

  return NextResponse.json(order);
}
