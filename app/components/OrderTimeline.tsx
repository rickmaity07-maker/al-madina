"use client";

import { Check, Package, Truck, ClipboardList } from "lucide-react";
import { ORDER_STATUSES, OrderStatus } from "@/lib/order-utils";

type StatusEvent = { status: string; createdAt: string };
export type TrackableOrder = {
  orderNumber: string;
  status: string;
  fulfillment: string;
  total: number;
  createdAt: string;
  items: { id: string; name: string; sizeLabel: string | null; qty: number; price: number }[];
  statusEvents: StatusEvent[];
};

const STEP_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  PLACED: ClipboardList,
  PACKED: Package,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: Check,
};

const STEP_LABEL: Record<string, string> = {
  PLACED: "Order placed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export default function OrderTimeline({ order }: { order: TrackableOrder }) {
  // Pickup orders skip "out for delivery" — it doesn't apply.
  const steps: OrderStatus[] =
    order.fulfillment === "PICKUP" ? ORDER_STATUSES.filter((s): s is OrderStatus => s !== "OUT_FOR_DELIVERY") : [...ORDER_STATUSES];
  const currentIdx = steps.indexOf(order.status as OrderStatus);

  function timeFor(status: string) {
    return order.statusEvents.find((e) => e.status === status)?.createdAt;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 24 }}>
        {steps.map((step, i) => {
          const Icon = STEP_ICON[step] ?? Check;
          const done = i <= currentIdx;
          const time = timeFor(step);
          return (
            <div key={step} style={{ flex: 1, textAlign: "center", position: "relative" }}>
              {i > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 17,
                    left: "-50%",
                    width: "100%",
                    height: 2,
                    background: i <= currentIdx ? "#a12e3d" : "rgba(0,0,0,.1)",
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  margin: "0 auto 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? "#a12e3d" : "rgba(0,0,0,.06)",
                  color: done ? "#fff" : "rgba(0,0,0,.35)",
                }}
              >
                <Icon size={16} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? "#18201b" : "rgba(24,32,27,.4)" }}>
                {STEP_LABEL[step] ?? step}
              </div>
              {time && (
                <small style={{ color: "rgba(24,32,27,.5)" }}>
                  {new Date(time).toLocaleDateString()} {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </small>
              )}
            </div>
          );
        })}
      </div>

      <ul style={{ fontSize: 14, marginBottom: 10 }}>
        {order.items.map((it) => (
          <li key={it.id}>
            {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        <span>Total (cash)</span>
        <span>€{order.total.toFixed(2)}</span>
      </div>
    </div>
  );
}
