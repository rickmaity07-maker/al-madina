import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// Public: list products (storefront). Admins get inactive products too.
export async function GET() {
  const session = await getAdminSession();
  const products = await prisma.product.findMany({
    where: session ? undefined : { active: true },
    include: { sizes: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(products);
}

// Admin only: create a product with its sizes.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
