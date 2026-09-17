// app/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  price: string; // numeric -> string over the wire
  compare_at_price: string | null;
  stock_quantity: number;
};

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
    where product_id = ${productId} and is_active = true
    order by sort_order asc, size_value asc nulls last
  `;

  return rows.map((v) => ({
    ...v,
    price: Number(v.price),
    compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
  }));
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const variants = await getVariants(product.id);
  if (variants.length === 0) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      {product.category_name && (
        <p className="text-sm text-[var(--muted)]">{product.category_name}</p>
      )}

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-[var(--cream)]">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="font-serif text-4xl leading-tight text-[var(--ink)]">{product.name}</h1>
          {product.unit_note && <p className="text-[var(--muted)]">{product.unit_note}</p>}
          {product.description && (
            <p className="leading-relaxed text-[var(--ink)]/80">{product.description}</p>
          )}

          <VariantSelector variants={variants} />
        </div>
      </div>
    </main>
  );
}
