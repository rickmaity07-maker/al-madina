"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "./components/AdminShell";
import { Check, ChevronRight, Copy, MapPin, Package, Phone, Store, Truck, Mail } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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

const TABS: { key: string; label: [string, string] }[] = [
  { key: "ACTIVE", label: ["Aktiv", "Active"] },
  { key: "PLACED", label: ["Neu", "New"] },
  { key: "PACKED", label: ["Gepackt", "Packed"] },
  { key: "OUT_FOR_DELIVERY", label: ["Unterwegs", "Out for delivery"] },
  { key: "DELIVERED", label: ["Abgeschlossen", "Completed"] },
];

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-amber-100 text-amber-800",
  PACKED: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
};

const STATUS_LABEL: Record<string, [string, string]> = {
  PLACED: ["Neu", "New"],
  PACKED: ["Gepackt", "Packed"],
  OUT_FOR_DELIVERY: ["Unterwegs", "Out for delivery"],
  DELIVERED: ["Zugestellt", "Delivered"],
};

export default function AdminOrdersPage() {
  const { t } = useLanguage();
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
          <h1 className="font-serif text-3xl">{t("Bestellungen", "Orders")}</h1>
          <p className="text-black/50 text-sm mt-1">{t("Barzahlung bei Lieferung/Abholung — es wird keine Online-Zahlung verarbeitet.", "Cash on delivery / pickup — no online payment is processed.")}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 scroll-x-hide">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border shrink-0 whitespace-nowrap ${
              tab === tabDef.key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "border-black/10 text-black/60 bg-white"
            }`}
          >
            {t(tabDef.label[0], tabDef.label[1])}
            {tabDef.key !== "ACTIVE" && tabDef.key !== "DELIVERED" && (
              <span className="ml-1.5 text-xs opacity-70">{orders.filter((o) => o.status === tabDef.key).length}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="text-black/40 text-sm">{t("Bestellungen werden geladen…", "Loading orders…")}</div>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">{t("Noch keine Bestellungen.", "No orders here yet.")}</div>
      )}

      <div className="grid gap-4">
        {filtered.map((order) => (
          <OrderCard key={order.id} order={order} onAdvance={advanceStatus} t={t} />
        ))}
      </div>
    </AdminShell>
  );
}

function OrderCard({
  order,
  onAdvance,
  t,
}: {
  order: Order;
  onAdvance: (o: Order, status: string) => void;
  t: (de: string, en: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const deliverUrl = typeof window !== "undefined" ? `${window.location.origin}/deliver/${order.deliveryToken}` : "";

  function copyLink() {
    navigator.clipboard.writeText(deliverUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const statusLabel = STATUS_LABEL[order.status];

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">#{order.orderNumber}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}>
              {statusLabel ? t(statusLabel[0], statusLabel[1]) : order.status}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/60 flex items-center gap-1">
              {order.fulfillment === "PICKUP" ? <Store size={11} /> : <Truck size={11} />}
              {order.fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}
            </span>
          </div>
          <div className="text-xs text-black/40 mt-1">{new Date(order.createdAt).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-serif font-medium">€{order.total.toFixed(2)}</div>
          <div className="text-[11px] text-black/40">{order.fulfillment === "PICKUP" ? t("bar bei Abholung", "cash on pickup") : t("bar bei Lieferung", "cash on delivery")}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-5">
        <div className="text-sm space-y-1.5">
          <div className="font-semibold">{order.customerName}</div>
          <div className="flex items-center gap-1.5 text-black/60"><Phone size={13} /> {order.customerPhone}</div>
          <div className="flex items-start gap-1.5 text-black/60"><Mail size={13} className="mt-0.5 shrink-0" /> <span className="break-all">{order.customerEmail}</span></div>
          {order.fulfillment === "DELIVERY" && (
            <div className="flex items-start gap-1.5 text-black/60"><MapPin size={13} className="mt-0.5 shrink-0" /> {order.address}</div>
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
            <Package size={14} /> {t("Als gepackt markieren", "Mark packed")} <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "DELIVERY" && (
          <button onClick={() => onAdvance(order, "OUT_FOR_DELIVERY")} className="btn-primary">
            <Truck size={14} /> {t("Als unterwegs markieren", "Mark out for delivery")} <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "PICKUP" && (
          <span className="text-xs text-black/50 bg-black/5 rounded-full px-3 py-2">
            {t("Bereit zur Abholung — der Kunde nutzt den Abholungslink, oder Sie markieren es unten manuell.", "Ready for pickup — customer taps the pickup link, or you can mark received below.")}
          </span>
        )}
        {(order.status === "OUT_FOR_DELIVERY" || (order.status === "PACKED" && order.fulfillment === "PICKUP")) && (
          <>
            <button onClick={copyLink} className="btn-outline">
              <Copy size={14} />{" "}
              {copied
                ? t("Link kopiert!", "Link copied!")
                : order.fulfillment === "PICKUP"
                  ? t("Abholungs-Link kopieren", "Copy pickup-confirm link")
                  : t("Lieferlink kopieren", "Copy delivery link")}
            </button>
            <button onClick={() => onAdvance(order, "DELIVERED")} className="btn-outline">
              <Check size={14} />{" "}
              {order.fulfillment === "PICKUP"
                ? t("Als abgeholt markieren (manuell)", "Mark picked up (override)")
                : t("Als zugestellt markieren (manuell)", "Mark delivered (override)")}
            </button>
          </>
        )}
        {order.status === "DELIVERED" && (
          <span className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-2 flex items-center gap-1">
            <Check size={13} /> {order.fulfillment === "PICKUP" ? t("Abgeholt", "Picked up") : t("Zugestellt", "Delivered")}
          </span>
        )}
      </div>
    </div>
  );
}
