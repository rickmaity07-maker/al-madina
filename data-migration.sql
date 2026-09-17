-- =====================================================================
-- DATA MIGRATION: legacy Prisma tables -> new schema
-- =====================================================================
-- Run this AFTER schema.sql has been applied. It adds temporary
-- legacy_id columns to correlate old cuid IDs with newly generated
-- uuid IDs (old and new PK types are incompatible), copies every row
-- across, then leaves the legacy_id columns in place until you've
-- verified counts — drop them at the very bottom once you're happy.
--
-- Run via the Neon SQL Editor, or:
--   npx prisma db execute --file ./data-migration.sql --schema ./prisma/schema.prisma
-- =====================================================================

begin;

-- ---- 1. Temporary mapping columns ----
alter table products         add column if not exists legacy_id text unique;
alter table product_variants add column if not exists legacy_id text unique;
alter table users             add column if not exists legacy_id text unique;
alter table addresses         add column if not exists legacy_id text unique;
alter table orders            add column if not exists legacy_id text unique;

-- ---- 2. Categories: derived from distinct Product.category strings ----
insert into categories (name, slug, is_active)
select distinct
  "category",
  lower(regexp_replace(trim("category"), '[^a-zA-Z0-9]+', '-', 'g')),
  true
from "Product"
where "category" is not null and trim("category") <> ''
on conflict (slug) do nothing;

-- ---- 3. Products (master) ----
insert into products (legacy_id, category_id, name, slug, description, image_url, badge, unit_note, is_active, sort_order, created_at, updated_at)
select
  p."id",
  c.id,
  p."name",
  lower(regexp_replace(trim(p."name"), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(p."id", 1, 6),
  p."description",
  p."image",
  p."badge",
  p."unitNote",
  p."active",
  p."sortOrder",
  p."createdAt",
  p."updatedAt"
from "Product" p
left join categories c on c.name = p."category"
on conflict (legacy_id) do nothing;

-- ---- 4. Product variants (from ProductSize) ----
-- SKUs are generated placeholders — replace with real SKUs when you have them.
insert into product_variants (legacy_id, product_id, sku, size_label, price, compare_at_price, stock_quantity, sort_order, is_active, created_at, updated_at)
select
  ps."id",
  pr.id,
  'SKU-' || upper(substr(ps."id", 1, 10)),
  ps."label",
  ps."price",
  ps."oldPrice",
  ps."stock",
  ps."sortOrder",
  true,
  now(),
  now()
from "ProductSize" ps
join products pr on pr.legacy_id = ps."productId"
on conflict (legacy_id) do nothing;

-- ---- 5. Customers ----
insert into users (legacy_id, email, password_hash, full_name, phone, created_at, updated_at)
select "id", "email", "passwordHash", "name", "phone", "createdAt", "updatedAt"
from "User"
on conflict (legacy_id) do nothing;

-- ---- 6. Admins ----
insert into admin_users (email, password_hash, full_name, role, created_at, updated_at)
select
  "email", "passwordHash", "name",
  case "role" when 'OWNER' then 'owner'::admin_role else 'staff'::admin_role end,
  "createdAt", "updatedAt"
from "AdminUser"
on conflict (email) do nothing;

-- ---- 7. Addresses ----
-- Old schema stored one free-text field; city/postal_code and lat/lng are
-- left blank/null here since they don't exist in the source data. See the
-- caveat below the script — distance-based delivery fees won't work for
-- these until they're backfilled.
insert into addresses (legacy_id, user_id, label, line1, city, postal_code, is_default, created_at)
select
  a."id",
  u.id,
  a."label",
  a."address",
  '',
  '',
  a."isDefault",
  a."createdAt"
from "Address" a
join users u on u.legacy_id = a."userId"
on conflict (legacy_id) do nothing;

-- ---- 8. Wishlists (Prisma implicit many-to-many join table) ----
insert into wishlists (user_id, product_id, created_at)
select u.id, p.id, now()
from "_Wishlist" w
join users u on u.legacy_id = w."B"
join products p on p.legacy_id = w."A"
on conflict do nothing;

-- ---- 9. Reviews ----
insert into reviews (product_id, user_id, rating, title, comment, created_at, updated_at)
select p.id, u.id, r."rating", r."title", r."comment", r."createdAt", r."updatedAt"
from "Review" r
join products p on p.legacy_id = r."productId"
join users u on u.legacy_id = r."userId"
on conflict (product_id, user_id) do nothing;

-- ---- 10. Orders ----
-- NOTE: orders.user_id is NOT NULL in the new schema (accounts are now
-- mandatory). The old Order.userId was nullable (guest checkout was
-- allowed), so any guest orders are skipped by this INNER JOIN. See the
-- caveat below the script for how to check and handle those.
-- NOTE: run this AFTER alter-orders-compat.sql. Column names/status values
-- below match the compat schema (fulfillment/address, PLACED/PACKED/...),
-- which happen to be identical to the old data's own values — no mapping
-- needed anymore.
insert into orders (
  legacy_id, order_number, user_id, customer_name, customer_email, customer_phone,
  fulfillment, address, notes, subtotal, delivery_fee, total,
  status, delivery_token, created_at, updated_at
)
select
  o."id",
  o."orderNumber",
  u.id,
  o."customerName", o."customerEmail", o."customerPhone",
  o."fulfillment",
  o."address",
  o."notes",
  o."subtotal", o."deliveryFee", o."total",
  o."status",
  gen_random_uuid(),
  o."createdAt", o."updatedAt"
from "Order" o
join users u on u.legacy_id = o."userId"
on conflict (legacy_id) do nothing;

-- ---- 11. Order items ----
insert into order_items (order_id, product_id, variant_id, name, size_label, price, qty)
select
  ord.id,
  pr.id,
  pv.id,
  oi."name",
  oi."sizeLabel",
  oi."price",
  oi."qty"
from "OrderItem" oi
join orders ord on ord.legacy_id = oi."orderId"
left join product_variants pv on pv.legacy_id = oi."sizeId"
left join products pr on pr.legacy_id = oi."productId";

-- ---- 12. Order status history ----
insert into order_status_history (order_id, status, created_at)
select ord.id, ose."status", ose."createdAt"
from "OrderStatusEvent" ose
join orders ord on ord.legacy_id = ose."orderId";

commit;

-- =====================================================================
-- VERIFY, THEN CLEAN UP
-- =====================================================================
-- Compare row counts before dropping the mapping columns, e.g.:
--   select count(*) from "Product"; select count(*) from products;
--   select count(*) from "Order";   select count(*) from orders;
--
-- Check for skipped guest orders (Order.userId was null):
--   select count(*) from "Order" where "userId" is null;
--
-- Once counts reconcile:
-- alter table products         drop column legacy_id;
-- alter table product_variants drop column legacy_id;
-- alter table users             drop column legacy_id;
-- alter table addresses         drop column legacy_id;
-- alter table orders            drop column legacy_id;
