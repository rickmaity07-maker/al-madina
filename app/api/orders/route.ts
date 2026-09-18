import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { getVerifiedCustomerSession } from "@/lib/customer-auth";
import { generateOrderNumber, generateDeliveryToken, LOW_STOCK_THRESHOLD } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendCustomerConfirmationEmail, sendStoreNotificationEmail, sendLowStockAlert } from "@/lib/mailer";
import { isEmailVerified } from "@/lib/email-verification";
import { isDisposableEmail } from "@/lib/disposable-email";
import { isPlausiblePhoneNumber } from "@/lib/phone";

const FREE_DELIVERY_THRESHOLD = 40;
const DELIVERY_FEE = 3.99;

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
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  size_label: string;
  price: string | number;
  stock_quantity: number;
  product_name: string;
  product_active: boolean;
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

// Admin only: list all orders, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ordersRaw = await prisma.$queryRaw<OrderRow[]>`
      select id, order_number, customer_name, customer_email, customer_phone,
             fulfillment, address, notes, subtotal, delivery_fee,
             total, delivery_token, user_id, status, created_at
      from orders
      order by created_at desc
    `;

    const orders = await Promise.all(
      ordersRaw.map(async (o) => {
        const items = await prisma.$queryRaw<ItemRow[]>`
          select id, order_id, product_id, variant_id,
                 name, size_label, price, qty
          from order_items
          where order_id = ${o.id}::uuid
        `;
        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          customerEmail: o.customer_email,
          customerPhone: o.customer_phone,
          fulfillment: o.fulfillment,
          address: o.address,
          notes: o.notes,
          subtotal: Number(o.subtotal),
          deliveryFee: Number(o.delivery_fee),
          total: Number(o.total),
          deliveryToken: o.delivery_token,
          userId: o.user_id,
          status: o.status,
          createdAt: o.created_at,
          updatedAt: o.created_at,
          items: items.map((it) => ({
            id: it.id,
            orderId: it.order_id,
            productId: it.product_id,
            variantId: it.variant_id,
            sizeId: it.variant_id,
            name: it.name,
            sizeLabel: it.size_label,
            price: Number(it.price),
            qty: it.qty,
          })),
        };
      })
    );

    return NextResponse.json(orders);
  } catch (err) {
    console.error("[orders GET] failed", err);
    return NextResponse.json(
      { error: "Bestellungen konnten nicht geladen werden.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Customer only (accounts are mandatory): place a new order. Cash only — no payment is processed here at all.
export async function POST(req: NextRequest) {
  try {
    const customerSession = await getVerifiedCustomerSession();
    if (!customerSession?.userId) {
      return NextResponse.json({ error: "Bitte melden Sie sich an, um eine Bestellung aufzugeben." }, { status: 401 });
    }
    if (!(await isEmailVerified(customerSession.userId))) {
      return NextResponse.json(
        { error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse, bevor Sie eine Bestellung aufgeben.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { customerName, customerEmail, customerPhone, fulfillment, address, notes, items } = body;

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json({ error: "Name, email and phone are required." }, { status: 400 });
    }
    if (isDisposableEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Please use a permanent email address — temporary/disposable inboxes aren't accepted." },
        { status: 400 }
      );
    }
    if (!isPlausiblePhoneNumber(customerPhone)) {
      return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
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

    const variantIds = items
      .map((it: { sizeId?: string; variantId?: string }) => it.sizeId || it.variantId)
      .filter(Boolean);

    if (variantIds.length === 0) {
      return NextResponse.json({ error: "Invalid items in basket." }, { status: 400 });
    }

    const variants = await prisma.$queryRaw<VariantRow[]>`
      select v.id, v.product_id, v.sku, v.size_label, v.price, v.stock_quantity,
             p.name as product_name, p.is_active as product_active
      from product_variants v
      join products p on p.id = v.product_id
      where v.id = ANY(${variantIds}::uuid[])
    `;

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const orderItemsData: {
      productId: string;
      variantId: string;
      name: string;
      sizeLabel: string;
      price: number;
      qty: number;
    }[] = [];

    for (const it of items) {
      const vId = it.sizeId || it.variantId;
      const variant = variantMap.get(vId);
      if (!variant || !variant.product_active) {
        return NextResponse.json(
          { error: "One of the items in your basket is no longer available." },
          { status: 400 }
        );
      }
      const qty = Math.max(1, Math.min(50, Number(it.qty) || 1));
      if (variant.stock_quantity < qty) {
        return NextResponse.json(
          { error: `Only ${variant.stock_quantity} of "${variant.product_name}" (${variant.size_label}) left in stock.` },
          { status: 400 }
        );
      }
      orderItemsData.push({
        productId: variant.product_id,
        variantId: variant.id,
        name: variant.product_name,
        sizeLabel: variant.size_label,
        price: Number(variant.price),
        qty,
      });
    }

    const subtotal = orderItemsData.reduce((sum, it) => sum + it.price * it.qty, 0);
    const deliveryFee = fulfillment === "PICKUP" ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const total = subtotal + deliveryFee;

    const orderNumber = generateOrderNumber();
    const deliveryToken = generateDeliveryToken();

    const orderId = await prisma.$transaction(async (tx) => {
      const orderInsert = await tx.$queryRaw<{ id: string }[]>`
        insert into orders (
          order_number, customer_name, customer_email, customer_phone,
          fulfillment, address, notes, subtotal, delivery_fee, total,
          delivery_token, user_id, status
        ) values (
          ${orderNumber}, ${customerName}, ${customerEmail}, ${customerPhone},
          ${fulfillment}, ${fulfillment === "DELIVERY" ? address : null}, ${notes || null},
          ${subtotal}, ${deliveryFee}, ${total}, ${deliveryToken},
          ${customerSession.userId}::uuid, 'PLACED'
        )
        returning id
      `;
      const newOrderId = orderInsert[0].id;

      for (const it of orderItemsData) {
        await tx.$executeRaw`
          insert into order_items (order_id, product_id, variant_id, name, size_label, price, qty)
          values (${newOrderId}::uuid, ${it.productId}::uuid, ${it.variantId}::uuid, ${it.name}, ${it.sizeLabel}, ${it.price}, ${it.qty})
        `;
        await tx.$executeRaw`
          update product_variants
          set stock_quantity = stock_quantity - ${it.qty}
          where id = ${it.variantId}::uuid
        `;
      }

      await tx.$executeRaw`
        insert into order_status_history (order_id, status)
        values (${newOrderId}::uuid, 'PLACED')
      `;

      return newOrderId;
    });

    const createdOrders = await prisma.$queryRaw<OrderRow[]>`
      select id, order_number, customer_name, customer_email, customer_phone,
             fulfillment, address, notes, subtotal, delivery_fee,
             total, delivery_token, user_id, status, created_at
      from orders
      where id = ${orderId}::uuid
      limit 1
    `;
    const orderRecord = createdOrders[0];
    const itemsRecord = await prisma.$queryRaw<ItemRow[]>`
      select id, order_id, product_id, variant_id,
             name, size_label, price, qty
      from order_items
      where order_id = ${orderId}::uuid
    `;

    const fullOrder = {
      id: orderRecord.id,
      orderNumber: orderRecord.order_number,
      customerName: orderRecord.customer_name,
      customerEmail: orderRecord.customer_email,
      customerPhone: orderRecord.customer_phone,
      fulfillment: orderRecord.fulfillment,
      address: orderRecord.address,
      notes: orderRecord.notes,
      subtotal: Number(orderRecord.subtotal),
      deliveryFee: Number(orderRecord.delivery_fee),
      total: Number(orderRecord.total),
      deliveryToken: orderRecord.delivery_token,
      userId: orderRecord.user_id,
      status: orderRecord.status,
      createdAt: orderRecord.created_at,
      updatedAt: orderRecord.created_at,
      items: itemsRecord.map((it) => ({
        id: it.id,
        orderId: it.order_id,
        productId: it.product_id,
        variantId: it.variant_id,
        sizeId: it.variant_id,
        name: it.name,
        sizeLabel: it.size_label,
        price: Number(it.price),
        qty: it.qty,
      })),
    };

    broadcastOrderEvent({ type: "new_order", orderId: fullOrder.id, orderNumber: fullOrder.orderNumber });

    // Everything below is fire-and-forget (emails, low-stock check) and must
    // not delay the response to the customer. On Vercel, an un-awaited
    // promise can get cut off the instant the response is sent — after()
    // (Next.js 15+) schedules this to run once the response goes out, but
    // keeps the function alive until it actually finishes, so the emails
    // reliably send instead of silently vanishing.
    const variantIdsToCheck = orderItemsData.map((it) => it.variantId);

    after(async () => {
      await Promise.all([
        sendCustomerConfirmationEmail(fullOrder).catch((e: unknown) =>
          console.error("[mailer] customer email failed", e)
        ),
        sendStoreNotificationEmail(fullOrder).catch((e: unknown) =>
          console.error("[mailer] store email failed", e)
        ),
      ]);

      const updatedVariants = await prisma.$queryRaw<
        { id: string; stock: number; label: string; product_name: string }[]
      >`
        select v.id, v.stock_quantity as stock, v.size_label as label, p.name as product_name
        from product_variants v
        join products p on p.id = v.product_id
        where v.id = ANY(${variantIdsToCheck}::uuid[]) and v.stock_quantity <= ${LOW_STOCK_THRESHOLD}
      `;

      if (updatedVariants.length > 0) {
        broadcastOrderEvent({ type: "low_stock", orderId: fullOrder.id, orderNumber: fullOrder.orderNumber });
        await sendLowStockAlert(
          updatedVariants.map((s) => ({ productName: s.product_name, sizeLabel: s.label, stock: s.stock }))
        ).catch((e: unknown) => console.error("[mailer] low stock email failed", e));
      }
    });

    return NextResponse.json(fullOrder, { status: 201 });
  } catch (err) {
    // This is the important part: instead of an unhandled exception producing
    // an HTML 500 page (which crashes res.json() on the frontend and shows
    // the generic "Verbindungsfehler"), every failure now comes back as JSON
    // with the real Postgres/Prisma error message — check the Network tab's
    // Response body next time this happens instead of guessing blind.
    console.error("[orders POST] failed", err);
    return NextResponse.json(
      { error: "Bestellung konnte nicht aufgegeben werden.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
