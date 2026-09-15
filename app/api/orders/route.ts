import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { generateOrderNumber, generateDeliveryToken, LOW_STOCK_THRESHOLD } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendCustomerConfirmationEmail, sendStoreNotificationEmail, sendLowStockAlert } from "@/lib/mailer";

const FREE_DELIVERY_THRESHOLD = 40;
const DELIVERY_FEE = 3.99;

// Admin only: list all orders, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

// Public: place a new order. Cash only — no payment is processed here at all.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, fulfillment, address, notes, items } = body;

  if (!customerName || !customerEmail || !customerPhone) {
    return NextResponse.json({ error: "Name, email and phone are required." }, { status: 400 });
  }
  if (fulfillment !== "DELIVERY" && fulfillment !== "PICKUP") {
    return NextResponse.json({ error: "fulfillment must be DELIVERY or PICKUP." }, { status: 400 });
  }
  if (fulfillment === "DELIVERY" && !address) {
    return NextResponse.json({ error: "Address is required for delivery." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
  }

  // Re-price every line server-side from the database — never trust prices sent by the client.
  const sizeIds = items.map((it: { sizeId: string }) => it.sizeId);
  const sizes = await prisma.productSize.findMany({
    where: { id: { in: sizeIds } },
    include: { product: true },
  });
  const sizeMap = new Map(sizes.map((s) => [s.id, s]));

  const orderItemsData: {
    productId: string;
    sizeId: string;
    name: string;
    sizeLabel: string;
    price: number;
    qty: number;
  }[] = [];

  for (const it of items) {
    const size = sizeMap.get(it.sizeId);
    if (!size || !size.product.active) {
      return NextResponse.json({ error: "One of the items in your basket is no longer available." }, { status: 400 });
    }
    const qty = Math.max(1, Math.min(50, Number(it.qty) || 1));
    if (size.stock < qty) {
      return NextResponse.json(
        { error: `Only ${size.stock} of "${size.product.name}" (${size.label}) left in stock.` },
        { status: 400 }
      );
    }
    orderItemsData.push({
      productId: size.productId,
      sizeId: size.id,
      name: size.product.name,
      sizeLabel: size.label,
      price: size.price,
      qty,
    });
  }

  const subtotal = orderItemsData.reduce((sum, it) => sum + it.price * it.qty, 0);
  const deliveryFee = fulfillment === "PICKUP" ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  // If the customer is logged in, link the order to their account for order history.
  const customerSession = await getCustomerSession();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerEmail,
        customerPhone,
        fulfillment,
        address: fulfillment === "DELIVERY" ? address : null,
        notes: notes || null,
        subtotal,
        deliveryFee,
        total,
        deliveryToken: generateDeliveryToken(),
        userId: customerSession?.userId,
        items: { create: orderItemsData },
        statusEvents: { create: { status: "PLACED" } },
      },
      include: { items: true },
    });

    // Decrement stock for each line. Uses `decrement` so concurrent orders stay consistent.
    for (const it of orderItemsData) {
      await tx.productSize.update({ where: { id: it.sizeId }, data: { stock: { decrement: it.qty } } });
    }

    return created;
  });

  // Notify the admin dashboard in real time (plays the sound alert there).
  broadcastOrderEvent({ type: "new_order", orderId: order.id, orderNumber: order.orderNumber });

  // Fire off both emails. We don't want a slow/broken mail server to break checkout,
  // so failures here are logged, not thrown back at the customer.
  sendCustomerConfirmationEmail(order).catch((e: unknown) => console.error("[mailer] customer email failed", e));
  sendStoreNotificationEmail(order).catch((e: unknown) => console.error("[mailer] store email failed", e));

  // Check whether any of the sizes just sold dropped to/below the low-stock threshold.
  const updatedSizes = await prisma.productSize.findMany({
    where: { id: { in: orderItemsData.map((it) => it.sizeId) }, stock: { lte: LOW_STOCK_THRESHOLD } },
    include: { product: true },
  });
  if (updatedSizes.length > 0) {
    broadcastOrderEvent({ type: "low_stock", orderId: order.id, orderNumber: order.orderNumber });
    sendLowStockAlert(
      updatedSizes.map((s) => ({ productName: s.product.name, sizeLabel: s.label, stock: s.stock }))
    ).catch((e: unknown) => console.error("[mailer] low stock email failed", e));
  }

  return NextResponse.json(order, { status: 201 });
}
