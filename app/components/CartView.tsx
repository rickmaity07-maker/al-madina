// app/components/CartView.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
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

  const belowMinimum = cart.subtotal < cartMinimum;

  if (cart.items.length === 0) {
    return (
      <div className="empty-cart" style={{ minHeight: 320 }}>
        <ShoppingBag size={42} />
        <h3>Your basket is waiting.</h3>
        <p>Add a few favourites — they'll show up here.</p>
        <Link href="/" className="primary-btn">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity .2s" }}>
      <div className="cart-items" style={{ overflow: "visible" }}>
        {cart.items.map((item) => (
          <div className="cart-item" key={item.id}>
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt={item.product_name} />
            ) : (
              <div style={{ width: 75, height: 75, borderRadius: 12, background: "#eee" }} />
            )}
            <div>
              <Link href={`/products/${item.product_slug}`}>
                <b>{item.product_name}</b>
              </Link>
              <span>
                {item.size_label} · {formatCurrency(item.price)}
              </span>
              <div className="qty">
                <button
                  onClick={() => startTransition(() => updateQuantity(item.id, item.quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={13} />
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => startTransition(() => updateQuantity(item.id, item.quantity + 1))}
                  disabled={item.quantity >= item.stock_quantity}
                  aria-label="Increase quantity"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div>
          <span>Subtotal</span>
          <b>{formatCurrency(cart.subtotal)}</b>
        </div>
        {belowMinimum ? (
          <small style={{ textAlign: "left", color: "#b3261e" }}>
            Add {formatCurrency(cartMinimum - cart.subtotal)} more to reach the {formatCurrency(cartMinimum)} order
            minimum.
          </small>
        ) : (
          <small style={{ textAlign: "left" }}>Delivery fee / pickup option is chosen at checkout.</small>
        )}
        <Link
          href="/?checkout=1"
          className="primary-btn full"
          style={belowMinimum ? { pointerEvents: "none", opacity: 0.5 } : undefined}
        >
          Go to checkout
        </Link>
        <small>Cash payment on delivery or pickup</small>
      </div>
    </div>
  );
}
