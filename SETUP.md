# Al-Madina Markt — Setup Guide

This is now a full-stack app: Next.js storefront + a real backend (database, admin
portal, order pipeline, email notifications). Payment is **cash only** — there is
no payment gateway anywhere in this project.

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

Uses **SQLite** — a single file (`dev.db`), no external database service to pay for
or manage. Perfect for one store. Create the tables and load demo products:

```bash
npx prisma db push
npm run db:seed
```

(If you ever want a bigger database like Postgres later — e.g. for multiple
stores — you only need to change `provider` and `DATABASE_URL` in
`prisma/schema.prisma`; nothing else in the app needs to change.)

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
  manage these in the admin Products page.
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
- SQLite's `dev.db` file needs to live on persistent disk — fine on a VPS or
  Docker volume; on purely serverless hosts (e.g. Vercel's default filesystem)
  you'd want to point `DATABASE_URL` at a hosted SQLite (e.g. Turso) or switch
  the Prisma provider to Postgres instead.
