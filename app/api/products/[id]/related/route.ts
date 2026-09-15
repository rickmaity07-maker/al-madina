import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: "customers who bought this also bought" — derived from real order history,
// not a separate recommendation model. Falls back to same-category products if this
// item has no order history yet (e.g. it's brand new).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  // Orders that contained this product.
  const coOrderedItems = await prisma.orderItem.findMany({
    where: { productId: id, order: { items: { some: { productId: id } } } },
    select: { orderId: true },
  });
  const orderIds = [...new Set(coOrderedItems.map((i) => i.orderId))];

  let related: { id: string; name: string; image: string; category: string }[] = [];

  if (orderIds.length > 0) {
    const otherItems = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, productId: { not: id } },
      select: { productId: true },
    });
    const counts = new Map<string, number>();
    for (const it of otherItems) {
      if (!it.productId) continue;
      counts.set(it.productId, (counts.get(it.productId) ?? 0) + 1);
    }
    const topIds = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([productId]) => productId);

    if (topIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: topIds }, active: true },
        select: { id: true, name: true, image: true, category: true },
      });
      // Keep the "most frequently bought together" ordering.
      related = topIds.map((pid) => products.find((p) => p.id === pid)).filter(Boolean) as typeof related;
    }
  }

  if (related.length === 0) {
    related = await prisma.product.findMany({
      where: { category: product.category, id: { not: id }, active: true },
      select: { id: true, name: true, image: true, category: true },
      take: 6,
    });
  }

  return NextResponse.json(related);
}
