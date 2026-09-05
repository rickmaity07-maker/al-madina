import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// Admin only: update a product and fully replace its size list
// (simplest, most predictable way to keep sizes in sync with the admin form).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, category, description, image, badge, unitNote, active, sizes } = body;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const product = await prisma.$transaction(async (tx) => {
    if (Array.isArray(sizes)) {
      await tx.productSize.deleteMany({ where: { productId: id } });
    }
    return tx.product.update({
      where: { id },
      data: {
        name,
        category,
        description: description ?? null,
        image,
        badge: badge ?? null,
        unitNote: unitNote ?? null,
        active: active ?? true,
        ...(Array.isArray(sizes)
          ? {
              sizes: {
                create: sizes.map((s: { label: string; price: number; oldPrice?: number; stock?: number }, i: number) => ({
                  label: s.label,
                  price: Number(s.price),
                  oldPrice: s.oldPrice ? Number(s.oldPrice) : null,
                  stock: s.stock ?? 999,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
      include: { sizes: true },
    });
  });

  return NextResponse.json(product);
}

// Admin only: delete a product.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.product.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
