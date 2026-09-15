"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import OrderTimeline, { TrackableOrder } from "@/app/components/OrderTimeline";

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackableOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not find that order.");
      } else {
        setOrder(data);
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="mx-auto max-w-lg px-5 py-10">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to shop
        </Link>

        <span className="eyebrow">Order tracking</span>
        <h1 style={{ fontSize: 30, marginBottom: 18 }}>Track your order</h1>

        {!order && (
          <form onSubmit={submit} className="checkout-fields">
            <input
              required
              placeholder="Order number (e.g. AM-20260905-4F2K)"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
            <input required type="email" placeholder="Email used at checkout" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="checkout-error">{error}</div>}
            <button className="primary-btn full" disabled={loading}>
              <Search size={16} /> {loading ? "Searching…" : "Track order"}
            </button>
          </form>
        )}

        {order && (
          <div className="checkout-modal" style={{ position: "static", boxShadow: "none", padding: 0 }}>
            <h2 style={{ fontSize: 22, marginBottom: 16 }}>#{order.orderNumber}</h2>
            <OrderTimeline order={order} />
            <button className="text-btn" style={{ marginTop: 16 }} onClick={() => setOrder(null)}>
              Track another order
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
