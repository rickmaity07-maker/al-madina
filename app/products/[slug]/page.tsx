// app/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/app/components/StarRating";
import { VariantSelector, type Variant } from "@/app/components/VariantSelector";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  unit_note: string | null;
  category_name: string | null;
};

type VariantRow = {
  id: string;
  sku: string;
  size_label: string;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
};

type ReviewStatsRow = { average: string | null; count: string };

async function getProduct(slug: string): Promise<ProductRow | null> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    select p.id, p.name, p.slug, p.description, p.image_url, p.unit_note,
           c.name as category_name
    from products p
    left join categories c on c.id = p.category_id
    where p.slug = ${slug} and p.is_active = true
    limit 1
  `;
  return rows[0] ?? null;
}

async function getVariants(productId: string): Promise<Variant[]> {
  const rows = await prisma.$queryRaw<VariantRow[]>`
    select id, sku, size_label, price, compare_at_price, stock_quantity
    from product_variants
    where product_id = ${productId}::uuid and is_active = true
    order by sort_order asc, size_value asc nulls last
  `;

  return rows.map((v) => ({
    ...v,
    price: Number(v.price),
    compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
  }));
}

async function getReviewStats(productId: string) {
  const rows = await prisma.$queryRaw<ReviewStatsRow[]>`
    select avg(rating) as average, count(*) as count from reviews where product_id = ${productId}::uuid
  `;
  return { average: Number(rows[0]?.average ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [variants, reviewStats] = await Promise.all([getVariants(product.id), getReviewStats(product.id)]);
  if (variants.length === 0) notFound();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center py-12 px-4 md:px-8">
      <div className="w-full max-w-xl bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to shop
        </Link>

        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: "100%", borderRadius: 14, marginBottom: 16, maxHeight: 280, objectFit: "cover" }}
          />
        )}

        {product.category_name && <span className="eyebrow">{product.category_name}</span>}
        <h1 style={{ fontSize: 30, margin: "8px 0 0" }}>{product.name}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 14px" }}>
          <StarRating value={reviewStats.average} size={16} />
          <span style={{ fontSize: 14, color: "rgba(24,32,27,.65)" }}>
            {reviewStats.count > 0
              ? `${reviewStats.average.toFixed(1)} · ${reviewStats.count} ${reviewStats.count === 1 ? "review" : "reviews"}`
              : "No reviews yet"}
          </span>
        </div>

        {product.unit_note && <p style={{ color: "#6d766f", fontSize: 13, marginBottom: 6 }}>{product.unit_note}</p>}
        {product.description && <p style={{ marginBottom: 4 }}>{product.description}</p>}

        <VariantSelector variants={variants} />
      </div>
    </main>
  );
}
