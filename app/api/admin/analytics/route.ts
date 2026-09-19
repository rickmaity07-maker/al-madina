import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/order-utils";

// Reads the live orders/order_items/product_variants schema — the same one
// checkout and the admin orders dashboard use. (Previously this read the old
// Order/ProductSize Prisma tables, which only hold stale pre-migration data.)

type OrderRow = { id: string; total: string; created_at: Date };
type ItemRow = { order_id: string; product_id: string | null; name: string; price: string; qty: number };
type LowStockRow = { id: string; productName: string; sizeLabel: string; stock: number };
type StatusCountRow = { status: string; count: bigint };

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [orders, items, lowStock, orderCountByStatus] = await Promise.all([
    prisma.$queryRaw<OrderRow[]>`
      select id, total, created_at from orders where created_at >= ${thirtyDaysAgo} order by created_at asc
    `,
    prisma.$queryRaw<ItemRow[]>`
      select oi.order_id, oi.product_id, oi.name, oi.price, oi.qty
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.created_at >= ${thirtyDaysAgo}
    `,
    prisma.$queryRaw<LowStockRow[]>`
      select pv.id, p.name as "productName", pv.size_label as "sizeLabel", pv.stock_quantity as stock
      from product_variants pv
      join products p on p.id = pv.product_id
      where pv.stock_quantity <= ${LOW_STOCK_THRESHOLD} and pv.is_active = true
      order by pv.stock_quantity asc
    `,
    // All-time status breakdown (not scoped to 30 days), matching the tabs on the orders dashboard.
    prisma.$queryRaw<StatusCountRow[]>`
      select status, count(*) as count from orders group by status
    `,
  ]);

  // Revenue + order count per day, last 30 days.
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const day = o.created_at.toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0 };
    entry.revenue += Number(o.total);
    entry.orders += 1;
    byDay.set(day, entry);
  }
  const revenueByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Top products by quantity sold, last 30 days.
  const qtyByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const key = it.product_id ?? it.name;
    const entry = qtyByProduct.get(key) ?? { name: it.name, qty: 0, revenue: 0 };
    entry.qty += it.qty;
    entry.revenue += Number(it.price) * it.qty;
    qtyByProduct.set(key, entry);
  }
  const topProducts = Array.from(qtyByProduct.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

  return NextResponse.json({
    totalRevenue30d: totalRevenue,
    totalOrders30d: orders.length,
    averageOrderValue30d: orders.length ? totalRevenue / orders.length : 0,
    ordersByStatus: orderCountByStatus.map((s) => ({ status: s.status, count: Number(s.count) })),
    revenueByDay,
    topProducts,
    lowStock: lowStock.map((s) => ({ id: s.id, productName: s.productName, sizeLabel: s.sizeLabel, stock: s.stock })),
  });
}
