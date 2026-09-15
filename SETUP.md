# Al-Madina Markt — Setup Guide

This is a full-stack app: Next.js storefront + a real backend (Postgres database,
admin portal, customer accounts, product reviews, order pipeline, email
notifications). Payment is **cash only** — there is no payment gateway anywhere
in this project.

## What's new since the mockup

- **Customer accounts** — sign in / register at `/account`. Logged-in customers
  get their name/email/phone pre-filled at checkout and can see their order
  history.
- **Product reviews & ratings** — any signed-in customer can leave a 1–5 star
  review (one per product) from the product detail popup on the storefront.
  Average rating + review count show on every product card, and a "Top rated"
  rail surfaces the best-reviewed products.
- **Better search & sorting** — search now matches product name, category, and
  description; a sort control lets shoppers order results by price or rating.
- **Wishlist** — the heart icon on any product (card or detail popup) saves it
  to the signed-in customer's wishlist, visible on `/account`.
- **Recently viewed & "frequently bought together"** — recently viewed
  products are tracked locally per device and shown as a rail on the
  storefront; each product's detail popup shows other items commonly ordered
  alongside it (derived from real order history, with a same-category
  fallback for new products with no order history yet).
- **Saved addresses & reorder** — customers can save delivery addresses on
  `/account` and pick one at checkout instead of retyping it. Every past order
  has a "Reorder" button that refills the basket with the same items (skipping
  anything no longer available).
- **Order tracking** — every order gets a status timeline (Placed → Packed →
  Out for delivery/Pickup ready → Delivered), visible to the signed-in owner
  at `/account/orders/[id]` or to anyone at `/track` via order number + email
  (no login needed — for guest checkouts).
- **Admin analytics** (`/admin/analytics`) — 30-day revenue, order count,
  average order value, a daily revenue chart, top products by units sold, and
  a low-stock list.
- **Inventory tracking** — each product size has a `stock` count (already
  existed) that now actually decrements on checkout, inside the same database
  transaction as order creation. Orders are rejected if stock is insufficient.
  When a size's stock drops to 5 or below (`LOW_STOCK_THRESHOLD` in
  `lib/order-utils.ts`), the admin dashboard flags it and an email alert goes
  to `STORE_NOTIFICATION_EMAIL`.
- **Postgres** — the database is now Postgres (via Prisma), not SQLite.

## 1. Install & configure

```bash
npm install
cp .env.example .env      # already done for you — just edit the values in .env
```

Open `.env` and fill in:

| Variable | What it is |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Login for `/admin`. Change these before going live. |
| `JWT_SECRET` | Random string that signs admin login sessions. Generate with `openssl rand -base64 48`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Your email sending account (see "Email" below). |
| `STORE_NOTIFICATION_EMAIL` | Your client's inbox — where new-order alerts go. |
| `NEXT_PUBLIC_SITE_URL` | The live URL once deployed (e.g. `https://al-madina-markt.de`). |

## 2. Database

Uses **Postgres**, via Prisma. Set `DATABASE_URL` (and `DIRECT_URL`, if your
provider gives you a separate non-pooled connection string — Neon and similar
providers do) in `.env`, then push the schema and load demo products:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

`db push` creates the `Product`, `ProductSize`, `Order`, `OrderItem`, `User`
and `Review` tables from `prisma/schema.prisma`. Re-run it whenever the schema
changes.

## 3. Run it

```bash
npm run dev
```

- Storefront: http://localhost:3000
- Admin portal: http://localhost:3000/admin (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`)

## 4. Email — which API client, and where to put real credentials

Emails are sent with **Nodemailer** over standard SMTP (`lib/mailer.ts`). This isn't
tied to one company — you plug in any SMTP provider by filling in `.env`:

- **Easiest for a small business:** [Brevo](https://www.brevo.com) (free tier,
  300 emails/day) or [Resend](https://resend.com) (free tier, generous limits).
  Both give you an SMTP host/username/password to paste straight into `.env`.
- **Already have Gmail/Google Workspace:** create an
  [App Password](https://myaccount.google.com/apppasswords) and use:
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`,
  `SMTP_PASSWORD=<the app password>`.
- **Your web host already gives you email:** ask them for their SMTP settings —
  same fields.

No code changes needed — just fill in `.env` and restart the server. Until SMTP is
configured, the app still works completely; emails are just logged to the server
console instead of sent (see `lib/mailer.ts`), so nothing breaks during setup.

## 5. What each part of the site does

- **Storefront (`/`)** — Shop tab now loads products from the database. Each
  product can have multiple sizes (e.g. 500g / 1kg), each with its own price —
  manage these in the admin Products page. Clicking a product opens a detail
  popup with its description, star rating, and reviews.
- **Customer accounts (`/account`)** — sign in / register. Logged-in customers
  see their past orders and get checkout pre-filled. Accounts are separate
  from the admin login and use their own session cookie
  (`almadina_customer_session`).
- **Reviews** — any signed-in customer can leave one review per product
  (`POST /api/reviews`). Reviews are public and shown on the product popup;
  customers can delete their own, and admins can delete any (moderation only
  — there's no separate "flag" workflow yet).
- **Checkout** — cash only. No Stripe, no card fields, nothing online. The
  customer picks **Delivery** or **Pickup in store**, enters name/email/phone
  (+address for delivery), and sees the total to pay in cash. Placing the order:
  1. Saves it to the database.
  2. Emails the customer a confirmation.
  3. Emails your client (`STORE_NOTIFICATION_EMAIL`) with the order details.
  4. Instantly pushes the order to the admin dashboard and **plays a sound**.
- **Admin portal (`/admin`)** — protected by login.
  - **Orders tab** — see every order live (new orders arrive without refreshing,
    with a sound + screen flash). Buttons move an order **New → Packed → Out for
    delivery**. Each order has a copyable one-time link.
  - **Products tab** — add/edit/delete products, including their size options
    and prices, and show/hide items from the shop.
- **Delivery confirmation (`/deliver/[token]`)** — the link mentioned above.
  Send it to the delivery person (SMS/WhatsApp) for that specific order. They
  open it — no login needed — see the order and cash amount to collect, and tap
  one button to mark it **received/delivered**. That's the "delivery person
  clicks received" step. For pickup orders, the same link/button works to
  confirm the customer picked it up.

## 6. Deploying for real

This runs on any Node.js host (a small VPS, Railway, Render, etc.). A couple of
notes:
- The **live "new order" sound** in the admin dashboard uses a persistent
  connection (Server-Sent Events) and an in-memory event bus — this works great
  on a single server process, which is the normal setup for one store. If you
  ever scale to multiple server instances behind a load balancer, swap
  `lib/events.ts` for a small Redis pub/sub channel (only that one file would
  change).
- Since the database is already Postgres (a separate hosted service, not a
  local file), this deploys cleanly to serverless hosts like Vercel too — no
  persistent-disk requirement the way SQLite had.
