import nodemailer from "nodemailer";

// A structural subset of lib/orders.ts's FullOrder — only the fields these
// templates actually use, so callers don't need to supply statusEvents etc.
type OrderItem = { name: string; sizeLabel: string | null; price: number; qty: number };
type OrderWithItems = {
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
  status: string;
  items: OrderItem[];
};

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

// These templates interpolate customer-supplied text (name, address, notes,
// item names) straight into HTML emails. Without escaping, a malicious order
// (e.g. name = "<img src=x onerror=...>" or a note containing a fake link)
// would inject arbitrary markup into the store owner's / customer's inbox.
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
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
            <td style="padding:6px 4px">${escapeHtml(it.name)}</td>
            <td style="padding:6px 4px">${escapeHtml(it.sizeLabel ?? "-")}</td>
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
    : `<p><b>Home delivery</b> to: ${escapeHtml(order.address ?? "")}</p>`;
}

/** Email sent to the customer confirming their order. */
export async function sendCustomerConfirmationEmail(order: OrderWithItems) {
  const transport = getTransport();
  const html = baseWrapper(
    `Thank you, ${escapeHtml(order.customerName)}!`,
    `
    <p>We've received your order <b>#${escapeHtml(order.orderNumber)}</b>.</p>
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
    `New order #${escapeHtml(order.orderNumber)}`,
    `
    <p><b>${escapeHtml(order.customerName)}</b> · ${escapeHtml(order.customerPhone)} · ${escapeHtml(order.customerEmail)}</p>
    ${fulfillmentLine(order)}
    ${order.notes ? `<p><b>Note:</b> ${escapeHtml(order.notes)}</p>` : ""}
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
    `<p>Order <b>#${escapeHtml(order.orderNumber)}</b> — total ${money(order.total)} (cash on ${
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

/** Email sent to the store owner when a product size drops to/below the low-stock threshold. */
export async function sendLowStockAlert(items: { productName: string; sizeLabel: string; stock: number }[]) {
  const transport = getTransport();
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin/products`;

  if (items.length === 0) return { sent: false, reason: "Nothing to report" };

  const html = baseWrapper(
    "Low stock alert",
    `
    <p>The following items are running low:</p>
    <ul style="font-size:14px">
      ${items.map((i) => `<li><b>${escapeHtml(i.productName)}</b> (${escapeHtml(i.sizeLabel)}) — ${i.stock} left</li>`).join("")}
    </ul>
    <p><a href="${adminUrl}" style="display:inline-block;margin-top:12px;background:#a12e3d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Manage products</a></p>
    `
  );

  if (!transport || !storeEmail) {
    console.warn("[mailer] SMTP or STORE_NOTIFICATION_EMAIL not configured — skipping low-stock email");
    return { sent: false, reason: "SMTP or store email not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: storeEmail,
    subject: `⚠️ Low stock: ${items.map((i) => i.productName).join(", ")}`,
    html,
  });
  return { sent: true };
}

/** Email sent on registration (and on resend) with the one-time code to verify the account's email. */
export async function sendVerificationEmail(email: string, name: string, code: string) {
  const transport = getTransport();
  const html = baseWrapper(
    "Confirm your email",
    `
    <p>Hi ${escapeHtml(name)}, use this code to confirm your email address:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;margin:20px 0;color:#a12e3d">${escapeHtml(code)}</p>
    <p style="font-size:12px;color:#8a918c">This code expires in 15 minutes. You need to confirm your email before you can place an order.</p>
    <p style="font-size:12px;color:#8a918c">If you didn't try to create an account, you can ignore this email.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping verification email");
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Your verification code: ${code}`,
    html,
  });
  return { sent: true };
}
