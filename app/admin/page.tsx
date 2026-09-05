"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "./components/AdminShell";
import { Check, ChevronRight, Copy, MapPin, Package, Phone, Store, Truck, Mail } from "lucide-react";

type OrderItem = { id: string; name: string; sizeLabel: string | null; price: number; qty: number };
type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string | null;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: "PLACED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  deliveryToken: string;
  createdAt: string;
  items: OrderItem[];
};

const TABS: { key: string; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "PLACED", label: "New" },
  { key: "PACKED", label: "Packed" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Completed" },
];

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-amber-100 text-amber-800",
  PACKED: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onNew = () => load();
    const onUpdated = () => load();
    window.addEventListener("almadina:new-order", onNew);
    window.addEventListener("almadina:order-updated", onUpdated);
    return () => {
      window.removeEventListener("almadina:new-order", onNew);
      window.removeEventListener("almadina:order-updated", onUpdated);
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === "ACTIVE") return orders.filter((o) => o.status !== "DELIVERED");
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  async function advanceStatus(order: Order, status: string) {
    setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, status: status as Order["status"] } : o)));
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">Orders</h1>
          <p className="text-black/50 text-sm mt-1">Cash on delivery / pickup — no online payment is processed.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${
              tab === t.key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "border-black/10 text-black/60 bg-white"
            }`}
          >
            {t.label}
            {t.key !== "ACTIVE" && t.key !== "DELIVERED" && (
              <span className="ml-1.5 text-xs opacity-70">{orders.filter((o) => o.status === t.key).length}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="text-black/40 text-sm">Loading orders…</div>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">No orders here yet.</div>
      )}

      <div className="grid gap-4">
        {filtered.map((order) => (
          <OrderCard key={order.id} order={order} onAdvance={advanceStatus} />
        ))}
      </div>
    </AdminShell>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (o: Order, status: string) => void }) {
  const [copied, setCopied] = useState(false);
  const deliverUrl = typeof window !== "undefined" ? `${window.location.origin}/deliver/${order.deliveryToken}` : "";

  function copyLink() {
    navigator.clipboard.writeText(deliverUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">#{order.orderNumber}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}>
              {order.status.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/60 flex items-center gap-1">
              {order.fulfillment === "PICKUP" ? <Store size={11} /> : <Truck size={11} />}
              {order.fulfillment === "PICKUP" ? "Pickup" : "Delivery"}
            </span>
          </div>
          <div className="text-xs text-black/40 mt-1">{new Date(order.createdAt).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-serif font-medium">€{order.total.toFixed(2)}</div>
          <div className="text-[11px] text-black/40">cash {order.fulfillment === "PICKUP" ? "on pickup" : "on delivery"}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-5">
        <div className="text-sm space-y-1.5">
          <div className="font-semibold">{order.customerName}</div>
          <div className="flex items-center gap-1.5 text-black/60"><Phone size={13} /> {order.customerPhone}</div>
          <div className="flex items-center gap-1.5 text-black/60"><Mail size={13} /> {order.customerEmail}</div>
          {order.fulfillment === "DELIVERY" && (
            <div className="flex items-start gap-1.5 text-black/60"><MapPin size={13} className="mt-0.5" /> {order.address}</div>
          )}
          {order.notes && <div className="text-black/50 italic mt-1">“{order.notes}”</div>}
        </div>

        <div>
          <table className="w-full text-sm">
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-black/5 last:border-0">
                  <td className="py-1.5">
                    {it.name} {it.sizeLabel && <span className="text-black/40">· {it.sizeLabel}</span>}
                  </td>
                  <td className="py-1.5 text-center text-black/50">×{it.qty}</td>
                  <td className="py-1.5 text-right">€{(it.price * it.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/5">
        {order.status === "PLACED" && (
          <button onClick={() => onAdvance(order, "PACKED")} className="btn-primary">
            <Package size={14} /> Mark packed <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "DELIVERY" && (
          <button onClick={() => onAdvance(order, "OUT_FOR_DELIVERY")} className="btn-primary">
            <Truck size={14} /> Mark out for delivery <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "PICKUP" && (
          <span className="text-xs text-black/50 bg-black/5 rounded-full px-3 py-2">
            Ready for pickup — customer taps the pickup link, or you can mark received below.
          </span>
        )}
        {(order.status === "OUT_FOR_DELIVERY" || (order.status === "PACKED" && order.fulfillment === "PICKUP")) && (
          <>
            <button onClick={copyLink} className="btn-outline">
              <Copy size={14} /> {copied ? "Link copied!" : order.fulfillment === "PICKUP" ? "Copy pickup-confirm link" : "Copy delivery link"}
            </button>
            <button onClick={() => onAdvance(order, "DELIVERED")} className="btn-outline">
              <Check size={14} /> Mark {order.fulfillment === "PICKUP" ? "picked up" : "delivered"} (override)
            </button>
          </>
        )}
        {order.status === "DELIVERED" && (
          <span className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-2 flex items-center gap-1">
            <Check size={13} /> {order.fulfillment === "PICKUP" ? "Picked up" : "Delivered"}
          </span>
        )}
      </div>
    </div>
  );
}
