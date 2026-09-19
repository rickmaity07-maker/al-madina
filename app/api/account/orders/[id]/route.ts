// app/api/account/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { getOrderById } from "@/lib/orders";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order || order.userId !== session.userId) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(order);
}
