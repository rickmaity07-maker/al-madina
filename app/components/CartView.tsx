// app/components/CartView.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import type { Cart } from "@/lib/cart";

export function CartView({ initialCart, cartMinimum }: { initialCart: Cart; cartMinimum: number }) {
  const [cart, setCart] = useState(initialCart);
  const [isPending, startTransition] = useTransition();

  async function updateQuantity(itemId: string, quantity: number) {
    const res = await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity }),
    });
    if (res.ok) setCart(await res.json());
  }

  async function removeItem(itemId: string) {
    const res = await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) setCart(await res.json());
  }

  const belowMinimum = cart.subtotal < cartMinimum;

  if (cart.items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--line)] py-16 text-center">
        <p className="text-[var(--muted)]">Your cart is empty.</p>
        <Link href="/" className="btn-primary">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className={`mt-8 flex flex-col gap-6 ${isPending ? "opacity-60 transition-opacity" : ""}`}>
      <ul className="flex flex-col divide-y divide-[var(--line)]">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 py-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--cream)]">
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.product_name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex-1">
              <Link href={`/products/${item.product_slug}`} className="font-medium text-[var(--ink)]">
                {item.product_name}
              </Link>
              <p className="text-sm text-[var(--muted)]">{item.size_label}</p>
            </div>

            <div className="flex items-center rounded-full border border-[var(--line)]">
              <button
                type="button"
                onClick={() => startTransition(() => updateQuantity(item.id, item.quantity - 1))}
                className="px-3 py-1 text-lg"
                aria-label="Decrease quantity"
              >
                –
              </button>
              <span className="min-w-[2ch] text-center text-sm">{item.quantity}</span>
              <button
                type="button"
                onClick={() => startTransition(() => updateQuantity(item.id, item.quantity + 1))}
                disabled={item.quantity >= item.stock_quantity}
                className="px-3 py-1 text-lg disabled:opacity-30"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <span className="w-20 text-right font-semibold text-[var(--ink)]">
              {formatCurrency(item.price * item.quantity)}
            </span>

            <button
              type="button"
              onClick={() => startTransition(() => removeItem(item.id))}
              className="text-sm text-[var(--muted)] hover:text-[#b3261e]"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5">
        <div className="flex items-center justify-between text-lg">
          <span className="text-[var(--ink)]">Subtotal</span>
          <span className="font-semibold text-[var(--green)]">{formatCurrency(cart.subtotal)}</span>
        </div>

        {belowMinimum && (
          <p className="text-sm text-[#b3261e]">
            Add {formatCurrency(cartMinimum - cart.subtotal)} more to reach the{" "}
            {formatCurrency(cartMinimum)} order minimum.
          </p>
        )}

        <Link
          href="/checkout"
          aria-disabled={belowMinimum}
          className={`btn-primary justify-center ${belowMinimum ? "pointer-events-none opacity-50" : ""}`}
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
