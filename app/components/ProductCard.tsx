// app/components/ProductCard.tsx
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type ProductCardProps = {
  slug: string;
  name: string;
  imageUrl: string | null;
  badge: string | null;
  unitNote: string | null;
  fromPrice: number;
  variantCount: number;
};

export function ProductCard({
  slug,
  name,
  imageUrl,
  badge,
  unitNote,
  fromPrice,
  variantCount,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-(--line) bg-white transition-shadow hover:shadow-[0_8px_24px_rgba(161,46,61,0.12)]"
    >
      <div className="relative aspect-square bg-(--cream)">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-(--muted)">
            No image
          </div>
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-(--lime) px-3 py-1 text-xs font-semibold text-(--deep)">
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-serif text-lg leading-tight text-(--ink)">{name}</h3>
        {unitNote && <p className="text-sm text-(--muted)">{unitNote}</p>}

        <div className="mt-auto flex items-baseline gap-1 pt-3">
          {variantCount > 1 && <span className="text-xs text-(--muted)">from</span>}
          <span className="text-lg font-semibold text-(--green)">
            {formatCurrency(fromPrice)}
          </span>
        </div>
      </div>
    </Link>
  );
}