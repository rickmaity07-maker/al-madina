// app/components/VariantSelector.tsx
"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export type Variant = {
  id: string;
  sku: string;
  size_label: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
};

export function VariantSelector({ variants }: { variants: Variant[] }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const outOfStock = selected.stock_quantity <= 0;

  function selectVariant(id: string) {
    setSelectedId(id);
    setQuantity(1);
    setStatus("idle");
  }

  async function handleAddToCart() {
    setStatus("adding");
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selected.id, quantity }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          const isOut = v.stock_quantity <= 0;
          return (
            <button
              key={v.id}
              type="button"
              disabled={isOut}
              onClick={() => selectVariant(v.id)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                isSelected
                  ? "border-(--green) bg-(--green)-white"
                  : "border-(--line)hite text-(--ink) hover:border-(--green)",
                isOut ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {v.size_label}
              {isOut ? " (out of stock)" : ""}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-(--green)">
          {formatCurrency(selected.price)}
        </span>
        {selected.compare_at_price && (
          <span className="text-sm text-(--muted) line-through">
            {formatCurrency(selected.compare_at_price)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-(--line)">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg text-(--ink)"
            aria-label="Decrease quantity"
          >
            –
          </button>
          <span className="min-w-[2ch] text-center text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(selected.stock_quantity, q + 1))}
            className="px-3 py-2 text-lg text-(--ink)"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={outOfStock || status === "adding"}
          className="btn-primary flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outOfStock
            ? "Out of stock"
            : status === "added"
              ? "Added"
              : status === "adding"
                ? "Adding…"
                : "Add to cart"}
        </button>
      </div>

      {status === "error" && (
        <p className="text-sm text-[#b3261e]">Couldn't add that to your cart — try again.</p>
      )}

      {selected.stock_quantity > 0 && selected.stock_quantity <= 5 && (
        <p className="text-sm text-(--lime)">Only {selected.stock_quantity} left</p>
      )}
    </div>
  );
}