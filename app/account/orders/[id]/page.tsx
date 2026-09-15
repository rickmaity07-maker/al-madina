"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import OrderTimeline, { TrackableOrder } from "@/app/components/OrderTimeline";

export default function AccountOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<TrackableOrder | null | undefined>(undefined);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    fetch(`/api/account/orders/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setOrder);
  }, [params.id]);

  function reorder() {
    setReordering(true);
    router.push(`/?reorder=${params.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/account" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to order history
        </Link>

        {order === undefined && <p>Loading…</p>}
        {order === null && <p>Order not found.</p>}

        {order && (
          <div className="checkout-modal" style={{ position: "static", boxShadow: "none", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <span className="eyebrow">Order</span>
                <h1 style={{ fontSize: 26 }}>#{order.orderNumber}</h1>
              </div>
              <button className="primary-btn" onClick={reorder} disabled={reordering}>
                <RefreshCw size={16} /> Reorder
              </button>
            </div>

            <OrderTimeline order={order} />
          </div>
        )}
      </div>
    </main>
  );
}
