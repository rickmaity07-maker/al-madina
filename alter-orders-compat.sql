-- =====================================================================
-- COMPAT MIGRATION: align the new orders/order_items schema with the
-- naming and status vocabulary your app already uses everywhere
-- (admin dashboard, account page, OrderTimeline, mailer, deliver page).
-- =====================================================================
-- Root cause of "Verbindungsfehler" in production: app/api/orders/route.ts
-- (which you rewrote) inserts/selects columns named `fulfillment`, `address`,
-- `name`, `size_label`, `price`, `qty`, and a status value of 'PLACED' — but
-- schema.sql created `fulfillment_method` (enum), `delivery_address_snapshot`,
-- `product_name_snapshot`, `variant_label_snapshot`, `unit_price_snapshot`,
-- `quantity`, and an `order_status` enum with lowercase values. Every query
-- was hitting "column does not exist" / "invalid input value for enum",
-- which Next.js turns into a 500 HTML page — and the frontend's
-- `await res.json()` throws trying to parse that, landing in the generic
-- catch block as "Connection error."
--
-- This migration renames the new columns to match what your code (and the
-- rest of the app: admin/page.tsx, account/page.tsx, OrderTimeline.tsx,
-- lib/mailer.ts, deliver/[token]/page.tsx) already expects, rather than
-- rewriting all of those instead. Safe to run as-is because the new tables
-- are still empty — verify that first:
--
--   select count(*) from orders;         -- should be 0
--   select count(*) from order_items;    -- should be 0
--
-- If either is non-zero, stop and tell me before running this — it would
-- need value-mapping (e.g. 'received' -> 'PLACED') instead of a straight
-- rename.
-- =====================================================================

begin;

-- ---- orders ----
alter table orders drop constraint if exists chk_delivery_requires_address;

alter table orders rename column delivery_address_snapshot to address;
alter table orders alter column address drop not null;

alter table orders rename column fulfillment_method to fulfillment;
alter table orders alter column fulfillment drop default;
alter table orders alter column fulfillment type text using fulfillment::text;
alter table orders alter column fulfillment set default 'DELIVERY';
alter table orders add constraint chk_fulfillment_values check (fulfillment in ('DELIVERY', 'PICKUP'));

alter table orders alter column status drop default;
alter table orders alter column status type text using status::text;
alter table orders alter column status set default 'PLACED';
alter table orders add constraint chk_order_status_values
  check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'));

-- ---- order_status_history ----
alter table order_status_history alter column status type text using status::text;
alter table order_status_history add constraint chk_status_history_values
  check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'));

-- Both enum types are now unused — safe to drop.
drop type if exists fulfillment_method;
drop type if exists order_status;

-- ---- order_items ----
alter table order_items rename column product_name_snapshot to name;
alter table order_items rename column variant_label_snapshot to size_label;
alter table order_items rename column unit_price_snapshot to price;
alter table order_items rename column quantity to qty;
alter table order_items add column if not exists product_id uuid references products(id) on delete set null;

-- NOT NULL with no default, and never supplied by the insert in your rewritten
-- app/api/orders/route.ts — this would have been the *next* error right after
-- the enum one. Nothing reads it; every consumer computes price * qty inline
-- (same as the old app), so it's dead weight rather than something to fix.
alter table order_items drop column if exists line_subtotal;

commit;
