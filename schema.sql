-- =====================================================================
-- GROCERY E-COMMERCE PLATFORM — POSTGRES SCHEMA (Neon)
-- =====================================================================
-- Revised from the Supabase draft per your answers:
--  * Staying on Neon -> no Supabase Auth / auth.users / RLS via auth.uid().
--    Users and AdminUsers own their credentials directly (password_hash),
--    matching your existing lib/auth.ts / lib/customer-auth.ts pattern.
--    Access control stays at the Next.js session/middleware layer.
--  * Accounts are mandatory -> orders.user_id is NOT NULL, no guest path.
--  * Purchase history must persist server-side -> users are soft-deleted
--    (deleted_at) rather than hard-deleted, and orders.user_id uses
--    ON DELETE RESTRICT so an account can never be removed out from
--    under its own order history.
--  * Delivery fee depends on BOTH distance and order subtotal ->
--    delivery_fee_rules is a 2D lookup table (distance range x subtotal
--    range -> fee), and each order snapshots the distance it was billed
--    at, since a saved address (and therefore distance) can change later.
--  * Both delivery and pickup fulfillment kept.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type admin_role as enum ('owner', 'staff');
create type order_status as enum ('received', 'packed', 'dispatched', 'delivered', 'cancelled');
create type fulfillment_method as enum ('delivery', 'pickup');
create type variant_size_unit as enum ('g', 'kg', 'ml', 'l', 'pcs');

-- ---------------------------------------------------------------------
-- UTILITY: updated_at trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- PEOPLE: USERS (customers) / ADMIN USERS
-- =====================================================================
-- Accounts are mandatory for checkout, so this table is the anchor for
-- purchase history. deleted_at is a SOFT delete — never hard-delete a
-- user with order history (enforced below via ON DELETE RESTRICT too).
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

-- Separate credential set from customers, same as your current app.
-- Rows here are provisioned via direct SQL only (no self-service admin
-- creation), matching the OWNER/STAFF split you already run.
create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          admin_role not null default 'staff',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_admin_users_updated_at before update on admin_users
  for each row execute function set_updated_at();

-- lat/lng power the distance-based portion of the delivery fee calc.
-- Populate via a geocoding call (Google/Mapbox) when the address is saved.
create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text not null default 'Home',
  line1       text not null,
  line2       text,
  city        text not null,
  postal_code text not null,
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_addresses_user on addresses(user_id);

-- =====================================================================
-- CATALOG: CATEGORIES / PRODUCTS / VARIANTS
-- =====================================================================
create table categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references categories(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_categories_parent on categories(parent_id);

-- Master product: shared identity, no price/stock here
create table products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references categories(id) on delete set null,
  name         text not null,
  slug         text not null unique,
  description  text,
  image_url    text,
  badge        text,              -- e.g. "New", "Bestseller"
  unit_note    text,              -- display hint, e.g. "Sold per kg"
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_products_category on products(category_id);
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- Variant: the actual sellable unit — size, SKU, price, stock
create table product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  sku                 text not null unique,
  size_label          text not null,        -- "1kg", "500g", "6-pack"
  size_value          numeric(10,3),         -- 1.000 / 0.500 — for sorting/logic
  size_unit           variant_size_unit,
  price               numeric(10,2) not null,
  compare_at_price    numeric(10,2),
  stock_quantity      int not null default 0,
  low_stock_threshold int not null default 5,
  sort_order          int not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_variant_price_nonneg check (price >= 0),
  constraint chk_variant_stock_nonneg check (stock_quantity >= 0)
);
create index idx_variants_product on product_variants(product_id);
create trigger trg_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

-- =====================================================================
-- ENGAGEMENT: WISHLIST / REVIEWS
-- =====================================================================
create table wishlists (
  user_id     uuid not null references users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  title       text,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create trigger trg_reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

-- =====================================================================
-- DELIVERY SLOTS, STORE SETTINGS & FEE RULES
-- =====================================================================
create table delivery_slots (
  id          uuid primary key default gen_random_uuid(),
  slot_date   date not null,
  start_time  time not null,
  end_time    time not null,
  capacity    int not null default 20,   -- max orders bookable in this slot
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint chk_slot_time_order check (end_time > start_time),
  unique (slot_date, start_time, end_time)
);
create index idx_delivery_slots_date on delivery_slots(slot_date);

-- Small key/value config table: store origin coordinates, cart minimum,
-- max delivery radius, etc. Keeps operational constants editable by the
-- Owner without a deploy.
create table store_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated_at before update on store_settings
  for each row execute function set_updated_at();

-- Seed examples (adjust values to taste):
-- insert into store_settings (key, value, description) values
--   ('store_location', '{"lat":50.0489,"lng":10.2280}', 'Store origin for distance calc (Schweinfurt)'),
--   ('max_delivery_distance_km', '15', 'Reject checkout beyond this radius'),
--   ('cart_minimum_amount', '15.00', 'Minimum order subtotal to check out');

-- Two-dimensional fee lookup: distance bracket x subtotal bracket -> fee.
-- App computes distance (haversine, using store_location + the chosen
-- address's lat/lng) and the cart subtotal, then picks the active rule
-- whose ranges contain both values (lowest `priority` wins on overlap —
-- e.g. a high-subtotal "free delivery" rule can take priority over a
-- long-distance rule).
create table delivery_fee_rules (
  id              uuid primary key default gen_random_uuid(),
  min_distance_km numeric(6,2) not null default 0,
  max_distance_km numeric(6,2),              -- null = no upper bound
  min_subtotal    numeric(10,2) not null default 0,
  max_subtotal    numeric(10,2),              -- null = no upper bound
  fee             numeric(10,2) not null,
  priority        int not null default 0,     -- lower = evaluated first
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint chk_distance_range check (max_distance_km is null or max_distance_km > min_distance_km),
  constraint chk_subtotal_range check (max_subtotal is null or max_subtotal > min_subtotal)
);
create index idx_fee_rules_priority on delivery_fee_rules(priority) where is_active;

-- Example rows:
-- insert into delivery_fee_rules (min_distance_km, max_distance_km, min_subtotal, max_subtotal, fee, priority) values
--   (0,  5,  0,   40,  4.99, 10),
--   (0,  5,  40,  null, 1.99, 5),
--   (5,  15, 0,   40,  7.99, 10),
--   (5,  15, 40,  null, 3.99, 5),
--   (0,  null, 75, null, 0.00, 0);   -- free delivery over 75, any distance, checked first

-- =====================================================================
-- CART (persistent, server-side — accounts are mandatory so every cart
-- has an owner from the start)
-- =====================================================================
create table carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_carts_updated_at before update on carts
  for each row execute function set_updated_at();

create table cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references carts(id) on delete cascade,
  variant_id  uuid not null references product_variants(id) on delete cascade,
  quantity    int not null check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index idx_cart_items_cart on cart_items(cart_id);

-- =====================================================================
-- ORDERS — the durable purchase-history record
-- =====================================================================
create table orders (
  id                         uuid primary key default gen_random_uuid(),
  order_number               text not null unique,
  user_id                    uuid not null references users(id) on delete restrict,
  customer_name              text not null,     -- snapshot at order time
  customer_email             text not null,
  customer_phone             text not null,
  fulfillment_method         fulfillment_method not null default 'delivery',
  delivery_address_id        uuid references addresses(id) on delete set null,
  delivery_address_snapshot  text,               -- frozen copy in case the address is later edited
  delivery_distance_km       numeric(6,2),        -- snapshot: distance used for the fee calc
  delivery_slot_id           uuid references delivery_slots(id) on delete set null,
  notes                      text,
  subtotal                   numeric(10,2) not null,
  delivery_fee               numeric(10,2) not null default 0,
  total                      numeric(10,2) not null,
  status                     order_status not null default 'received',
  delivery_token             uuid not null default gen_random_uuid() unique,  -- tracking/confirmation links
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint chk_delivery_requires_address check (
    fulfillment_method = 'pickup' or delivery_address_id is not null
  )
);
create index idx_orders_user on orders(user_id);
create index idx_orders_status on orders(status);
create index idx_orders_slot on orders(delivery_slot_id);
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references orders(id) on delete cascade,
  variant_id              uuid references product_variants(id) on delete set null,
  product_name_snapshot   text not null,   -- frozen so later catalog edits don't rewrite history
  variant_label_snapshot  text,
  unit_price_snapshot     numeric(10,2) not null,
  quantity                int not null check (quantity > 0),
  line_subtotal           numeric(10,2) not null
);
create index idx_order_items_order on order_items(order_id);

-- Audit trail for Received -> Packed -> Dispatched -> Delivered
create table order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  status      order_status not null,
  changed_by  uuid references admin_users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_status_history_order on order_status_history(order_id);

-- =====================================================================
-- ACCESS CONTROL NOTE
-- =====================================================================
-- Neon has no Supabase-style auth.uid()/RLS integration, so authorization
-- is enforced at the application layer — same pattern as your current
-- middleware.ts + lib/auth.ts (admin session) + lib/customer-auth.ts
-- (customer session), extended to the new tables. Every API route reading
-- users/orders/addresses/cart data must scope its query by the session's
-- user_id (customers) or check an admin_users row (admin routes).
