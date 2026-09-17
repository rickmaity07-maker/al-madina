// app/api/account/orders/route.ts
//
// Response shape is aliased to match what app/account/page.tsx already
// expects (orderNumber, fulfillment, createdAt, items[].name/sizeLabel/
// price/qty) EXCEPT `status`: the new lifecycle is received/packed/
// dispatched/delivered/cancelled, replacing the old PLACED/PACKED/
// OUT_FOR_DELIVERY/DELIVERED. Update STATUS_LABEL in the account page to
// match — happy to do that pass next.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type OrderRow = {
  id: string;
  orderNumber: string;
  fulfillment: string;
  status: string;
  total: string;
  createdAt: string;
  items: { id: string; name: string; sizeLabel: string | null; price: string; qty: number }[];
};

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const orders = await prisma.$queryRaw<OrderRow[]>`
    select
      o.id,
      o.order_number as "orderNumber",
      upper(o.fulfillment_method::text) as "fulfillment",
      o.status,
      o.total,
      o.created_at as "createdAt",
      coalesce(
        json_agg(
          json_build_object(
            'id', oi.id,
            'name', oi.product_name_snapshot,
            'sizeLabel', oi.variant_label_snapshot,
            'price', oi.unit_price_snapshot,
            'qty', oi.quantity
          ) order by oi.id
        ) filter (where oi.id is not null), '[]'
      ) as items
    from orders o
    left join order_items oi on oi.order_id = o.id
    where o.user_id = ${session.userId}::uuid
    group by o.id
    order by o.created_at desc
  `;

  return NextResponse.json(
    orders.map((o) => ({
      ...o,
      total: Number(o.total),
      items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
    }))
  );
}