// lib/orders.ts
//
// Shared "load a full order with its items + status history" logic for the
// new orders/order_items/order_status_history tables. Every order-related
// route (admin, tracking, delivery link, account history) goes through this
// so the object shape handed to the mailer and the frontend is defined once.
//
// Depends on the compat migration (alter-orders-compat.sql) having been run,
// which renames orders.fulfillment_method -> fulfillment,
// orders.delivery_address_snapshot -> address, and the order_items snapshot
// columns to name/size_label/price/qty, and converts the status columns from
// enums to plain text using PLACED/PACKED/OUT_FOR_DELIVERY/DELIVERED.

import { prisma } from "./prisma";

export type StatusEvent = { status: string; createdAt: Date };

export type FullOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryToken: string;
  userId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    orderId: string;
    productId: string | null;
    sizeId: string | null;
    name: string;
    sizeLabel: string | null;
    price: number;
    qty: number;
  }[];
  statusEvents: StatusEvent[];
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: string | number;
  delivery_fee: string | number;
  total: string | number;
  delivery_token: string;
  user_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  size_label: string | null;
  price: string | number;
  qty: number;
};

async function assemble(order: OrderRow): Promise<FullOrder> {
  const [items, events] = await Promise.all([
    prisma.$queryRaw<ItemRow[]>`
      select id, order_id, product_id, variant_id, name, size_label, price, qty
      from order_items where order_id = ${order.id}::uuid
    `,
    prisma.$queryRaw<{ status: string; created_at: Date }[]>`
      select status, created_at from order_status_history
      where order_id = ${order.id}::uuid order by created_at asc
    `,
  ]);

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    fulfillment: order.fulfillment,
    address: order.address,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
    deliveryToken: order.delivery_token,
    userId: order.user_id,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((it) => ({
      id: it.id,
      orderId: it.order_id,
      productId: it.product_id,
      sizeId: it.variant_id,
      name: it.name,
      sizeLabel: it.size_label,
      price: Number(it.price),
      qty: it.qty,
    })),
    statusEvents: events.map((e) => ({ status: e.status, createdAt: e.created_at })),
  };
}

export async function getOrderById(id: string): Promise<FullOrder | null> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select id, order_number, customer_name, customer_email, customer_phone,
           fulfillment, address, notes, subtotal, delivery_fee, total,
           delivery_token, user_id, status, created_at, updated_at
    from orders where id = ${id}::uuid
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function getOrderByNumber(orderNumber: string): Promise<FullOrder | null> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select id, order_number, customer_name, customer_email, customer_phone,
           fulfillment, address, notes, subtotal, delivery_fee, total,
           delivery_token, user_id, status, created_at, updated_at
    from orders where order_number = ${orderNumber}
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function getOrderByToken(token: string): Promise<FullOrder | null> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select id, order_number, customer_name, customer_email, customer_phone,
           fulfillment, address, notes, subtotal, delivery_fee, total,
           delivery_token, user_id, status, created_at, updated_at
    from orders where delivery_token = ${token}
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function setOrderStatus(id: string, status: string): Promise<void> {
  await prisma.$executeRaw`update orders set status = ${status} where id = ${id}::uuid`;
  await prisma.$executeRaw`insert into order_status_history (order_id, status) values (${id}::uuid, ${status})`;
}

/** A logged-in customer's own order history, newest first. */
export async function getOrdersByUserId(userId: string): Promise<FullOrder[]> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select id, order_number, customer_name, customer_email, customer_phone,
           fulfillment, address, notes, subtotal, delivery_fee, total,
           delivery_token, user_id, status, created_at, updated_at
    from orders where user_id = ${userId}::uuid
    order by created_at desc
  `;
  return Promise.all(rows.map(assemble));
}
