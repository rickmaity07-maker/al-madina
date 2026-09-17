import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/order-utils";

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [orders, lowStockSizes, orderCountByStatus] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productSize.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      include: { product: true },
      orderBy: { stock: "asc" },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Revenue + order count per day, last 30 days.
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0 };
    entry.revenue += o.total;
    entry.orders += 1;
    byDay.set(day, entry);
  }
  const revenueByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Top products by quantity sold, last 30 days.
  const qtyByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.productId ?? it.name;
      const entry = qtyByProduct.get(key) ?? { name: it.name, qty: 0, revenue: 0 };
      entry.qty += it.qty;
      entry.revenue += it.price * it.qty;
      qtyByProduct.set(key, entry);
    }
  }
  const topProducts = Array.from(qtyByProduct.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  return NextResponse.json({
    totalRevenue30d: totalRevenue,
    totalOrders30d: orders.length,
    averageOrderValue30d: orders.length ? totalRevenue / orders.length : 0,
    ordersByStatus: orderCountByStatus.map((s) => ({ status: s.status, count: s._count._all })),
    revenueByDay,
    topProducts,
    lowStock: lowStockSizes.map((s) => ({
      id: s.id,
      productName: s.product.name,
      sizeLabel: s.label,
      stock: s.stock,
    })),
  });
}
