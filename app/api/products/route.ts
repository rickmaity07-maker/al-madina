// app/api/products/route.ts
//
// GET now reads from the new schema (products/product_variants/categories/
// reviews) so the IDs the storefront hands to checkout are real
// product_variants.id uuids that /api/orders can actually look up — this
// is the piece that was still pointed at the old Product/ProductSize
// tables, causing an ID mismatch with the new checkout.
//
// POST (admin "add product") still writes to the OLD Product/ProductSize
// tables via Prisma — a product created through the current admin UI will
// NOT show up here until that's rewritten too. Flagging this rather than
// leaving it silently broken: the next piece of work is an admin
// products page against the new schema.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  badge: string | null;
  unitNote: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  sizes: {
    id: string;
    productId: string;
    label: string;
    price: number;
    oldPrice: number | null;
    stock: number;
    sortOrder: number;
  }[];
  ratingAverage: string | number;
  ratingCount: string | number;
};

// Public: list products (storefront). Admins get inactive products too.
export async function GET() {
  const session = await getAdminSession();
  const whereClause = session ? Prisma.empty : Prisma.sql`where p.is_active = true`;

  const rows = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
    with variant_agg as (
      select
        product_id,
        json_agg(
          json_build_object(
            'id', id, 'productId', product_id, 'label', size_label,
            'price', price, 'oldPrice', compare_at_price,
            'stock', stock_quantity, 'sortOrder', sort_order
          ) order by sort_order asc
        ) as sizes
      from product_variants
      where is_active = true
      group by product_id
    ),
    review_agg as (
      select product_id, avg(rating) as rating_average, count(*) as rating_count
      from reviews
      group by product_id
    )
    select
      p.id, p.name, c.name as category, p.description, p.image_url as image,
      p.badge, p.unit_note as "unitNote", p.is_active as active, p.sort_order as "sortOrder",
      p.created_at as "createdAt", p.updated_at as "updatedAt",
      coalesce(va.sizes, '[]'::json) as sizes,
      coalesce(ra.rating_average, 0) as "ratingAverage",
      coalesce(ra.rating_count, 0) as "ratingCount"
    from products p
    left join categories c on c.id = p.category_id
    left join variant_agg va on va.product_id = p.id
    left join review_agg ra on ra.product_id = p.id
    ${whereClause}
    order by p.sort_order asc, p.created_at desc
  `);

  const products = rows.map((p) => ({
    ...p,
    ratingAverage: Math.round(Number(p.ratingAverage) * 10) / 10,
    ratingCount: Number(p.ratingCount),
  }));

  return NextResponse.json(products);
}

// Admin only: create a product with its sizes.
// NOTE: still writes to the OLD Product/ProductSize tables — see the file-level
// comment above. This means products created here won't appear in the GET
// above until this is rewritten against products/product_variants too.
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
