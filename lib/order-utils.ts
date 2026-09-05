import crypto from "crypto";

/** Human-friendly order number, e.g. AM-20260905-4F2K */
export function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AM-${y}${m}${d}-${suffix}`;
}

/** Opaque, unguessable token used in the delivery-person link for one order. */
export function generateDeliveryToken() {
  return crypto.randomBytes(16).toString("hex");
}

export const ORDER_STATUSES = ["PLACED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "New order",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered / Picked up",
};

/** Which status can this order move to next (admin picks PACKED/OUT_FOR_DELIVERY, delivery person picks DELIVERED). */
export function nextStatuses(current: OrderStatus): OrderStatus[] {
  const idx = ORDER_STATUSES.indexOf(current);
  return ORDER_STATUSES.slice(idx + 1);
}
