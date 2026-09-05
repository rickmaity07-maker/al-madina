import nodemailer from "nodemailer";
import type { Order, OrderItem } from "@prisma/client";

type OrderWithItems = Order & { items: OrderItem[] };

// ---------------------------------------------------------------------------
// SMTP transport. Reads its settings from environment variables — see
// .env.example for exactly which ones to fill in and where to get them
// (Gmail App Password, Resend, Brevo, SendGrid, Mailgun, or your host's SMTP).
// ---------------------------------------------------------------------------
function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null; // Not configured yet — caller should log instead of throwing.
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
    auth: { user, pass },
  });
}

function money(n: number) {
  return `€${n.toFixed(2)}`;
}

function itemsTable(items: OrderItem[]) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <thead>
        <tr style="text-align:left;border-bottom:2px solid #a12e3d">
          <th style="padding:6px 4px">Item</th>
          <th style="padding:6px 4px">Size</th>
          <th style="padding:6px 4px;text-align:center">Qty</th>
          <th style="padding:6px 4px;text-align:right">Price</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it) => `
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:6px 4px">${it.name}</td>
            <td style="padding:6px 4px">${it.sizeLabel ?? "-"}</td>
            <td style="padding:6px 4px;text-align:center">${it.qty}</td>
            <td style="padding:6px 4px;text-align:right">${money(it.price * it.qty)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function baseWrapper(title: string, bodyHtml: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8f7f3;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
      <div style="background:linear-gradient(135deg,#a12e3d,#7a1a26);color:#fff;padding:20px 24px">
        <div style="font-size:20px;font-weight:bold;letter-spacing:-0.02em">Al-Madina Markt</div>
        <div style="font-size:12px;opacity:.85;margin-top:2px">Halal Grocery · Schweinfurt</div>
      </div>
      <div style="padding:24px;color:#222">
        <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#f8f7f3;color:#999;font-size:11px">
        This is an automated message from al-madina-markt.de
      </div>
    </div>
  </div>`;
}

function fulfillmentLine(order: OrderWithItems) {
  return order.fulfillment === "PICKUP"
    ? `<p><b>Pickup in store</b> — it will be packed and ready for you to collect from Al-Madina Markt.</p>`
    : `<p><b>Home delivery</b> to: ${order.address ?? ""}</p>`;
}

/** Email sent to the customer confirming their order. */
export async function sendCustomerConfirmationEmail(order: OrderWithItems) {
  const transport = getTransport();
  const html = baseWrapper(
    `Thank you, ${order.customerName}!`,
    `
    <p>We've received your order <b>#${order.orderNumber}</b>.</p>
    ${fulfillmentLine(order)}
    ${itemsTable(order.items)}
    <table style="width:100%;font-size:14px">
      <tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>
      <tr><td>${order.fulfillment === "PICKUP" ? "Pickup" : "Delivery"}</td><td style="text-align:right">${
      order.deliveryFee === 0 ? "Free" : money(order.deliveryFee)
    }</td></tr>
      <tr style="font-weight:bold;font-size:16px"><td style="padding-top:8px">Total (Cash)</td><td style="text-align:right;padding-top:8px">${money(
        order.total
      )}</td></tr>
    </table>
    <p style="margin-top:16px">Payment is <b>cash on ${
      order.fulfillment === "PICKUP" ? "pickup" : "delivery"
    }</b> — please have the exact amount ready if possible.</p>
    <p>We'll let you know as your order moves from packed → ${
      order.fulfillment === "PICKUP" ? "ready for pickup" : "out for delivery"
    }.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping customer email for order", order.orderNumber);
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: order.customerEmail,
    subject: `Your Al-Madina Markt order #${order.orderNumber}`,
    html,
  });
  return { sent: true };
}

/** Email sent to the store owner when a new order comes in. */
export async function sendStoreNotificationEmail(order: OrderWithItems) {
  const transport = getTransport();
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`;

  const html = baseWrapper(
    `New order #${order.orderNumber}`,
    `
    <p><b>${order.customerName}</b> · ${order.customerPhone} · ${order.customerEmail}</p>
    ${fulfillmentLine(order)}
    ${order.notes ? `<p><b>Note:</b> ${order.notes}</p>` : ""}
    ${itemsTable(order.items)}
    <p style="font-size:16px;font-weight:bold">Total to collect (cash): ${money(order.total)}</p>
    <p><a href="${adminUrl}" style="display:inline-block;margin-top:12px;background:#a12e3d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open admin portal</a></p>
    `
  );

  if (!transport || !storeEmail) {
    console.warn("[mailer] SMTP or STORE_NOTIFICATION_EMAIL not configured — skipping store email for order", order.orderNumber);
    return { sent: false, reason: "SMTP or store email not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: storeEmail,
    subject: `🛒 New order #${order.orderNumber} — ${money(order.total)} cash`,
    html,
  });
  return { sent: true };
}

/** Email sent to the customer when their order status changes. */
export async function sendStatusUpdateEmail(order: OrderWithItems) {
  const transport = getTransport();
  const statusText: Record<string, string> = {
    PACKED: "Your order has been packed",
    OUT_FOR_DELIVERY: "Your order is out for delivery",
    DELIVERED: order.fulfillment === "PICKUP" ? "Your order was picked up" : "Your order was delivered",
  };
  const label = statusText[order.status];
  if (!label) return { sent: false, reason: "No email for this status" };

  const html = baseWrapper(
    label,
    `<p>Order <b>#${order.orderNumber}</b> — total ${money(order.total)} (cash on ${
      order.fulfillment === "PICKUP" ? "pickup" : "delivery"
    }).</p>`
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping status email for order", order.orderNumber);
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: order.customerEmail,
    subject: `Order #${order.orderNumber}: ${label}`,
    html,
  });
  return { sent: true };
}
