// app/api/account/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type OrderRow = {
  id: string;
  userId: string;
  orderNumber: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: string;
  deliveryFee: string;
  total: string;
  status: string;
  createdAt: string;
};

type ItemRow = { id: string; name: string; sizeLabel: string | null; price: string; qty: number };
type StatusEventRow = { status: string; createdAt: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;

  const orders = await prisma.$queryRaw<OrderRow[]>`
    select
      id, user_id as "userId", order_number as "orderNumber",
      upper(fulfillment_method::text) as "fulfillment",
      delivery_address_snapshot as "address", notes,
      subtotal, delivery_fee as "deliveryFee", total, status,
      created_at as "createdAt"
    from orders where id = ${id}::uuid
  `;
  const order = orders[0];

  if (!order || order.userId !== session.userId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const [items, statusEvents] = await Promise.all([
    prisma.$queryRaw<ItemRow[]>`
      select id, product_name_snapshot as "name", variant_label_snapshot as "sizeLabel",
             unit_price_snapshot as "price", quantity as "qty"
      from order_items where order_id = ${id}::uuid
    `,
    prisma.$queryRaw<StatusEventRow[]>`
      select status, created_at as "createdAt"
      from order_status_history where order_id = ${id}::uuid order by created_at asc
    `,
  ]);

  const { userId: _userId, ...orderWithoutUserId } = order;
  void _userId;

  return NextResponse.json({
    ...orderWithoutUserId,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    items: items.map((i) => ({ ...i, price: Number(i.price) })),
    statusEvents,
  });
}