import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

// Public: list products (storefront). Admins get inactive products too.
export async function GET() {
  const session = await getAdminSession();
  const products = await prisma.product.findMany({
    where: session ? undefined : { active: true },
    include: { sizes: { orderBy: { sortOrder: "asc" } }, reviews: { select: { rating: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Fold review rows into a simple average/count and drop the raw rows from the payload.
  const withRatings = products.map(({ reviews, ...product }) => {
    const count = reviews.length;
    const average = count === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / count;
    return { ...product, ratingAverage: Math.round(average * 10) / 10, ratingCount: count };
  });

  return NextResponse.json(withRatings);
}

// Admin only: create a product with its sizes.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const body = await req.json();
  const { name, category, description, image, badge, unitNote, active, sizes } = body;

  if (!name || !category || !image || !Array.isArray(sizes) || sizes.length === 0) {
    return NextResponse.json(
      { error: "name, category, image and at least one size are required." },
      { status: 400 }
    );
  }

  const product = await prisma.product.create({
    data: {
      name,
      category,
      description: description || null,
      image,
      badge: badge || null,
      unitNote: unitNote || null,
      active: active ?? true,
      sizes: {
        create: sizes.map((s: { label: string; price: number; oldPrice?: number; stock?: number }, i: number) => ({
          label: s.label,
          price: Number(s.price),
          oldPrice: s.oldPrice ? Number(s.oldPrice) : null,
          stock: s.stock ?? 999,
          sortOrder: i,
        })),
      },
    },
    include: { sizes: true },
  });

  return NextResponse.json(product, { status: 201 });
}
