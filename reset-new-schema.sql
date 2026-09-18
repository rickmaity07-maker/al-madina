-- =====================================================================
-- CLEAN RESET: drops every table/type from the new schema so it can be
-- recreated fresh from schema.sql. Safe to run — nothing here holds real
-- data yet (orders/products/variants are all empty; your 2 test accounts
-- in `users` will be lost, but they were just test registrations).
-- Does NOT touch any of the old capitalized Prisma tables (Product,
-- Order, User, etc.) — those are untouched by this.
-- =====================================================================

begin;

drop table if exists order_status_history cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists cart_items cascade;
drop table if exists carts cascade;
drop table if exists delivery_fee_rules cascade;
drop table if exists store_settings cascade;
drop table if exists delivery_slots cascade;
drop table if exists reviews cascade;
drop table if exists wishlists cascade;
drop table if exists product_variants cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists addresses cascade;
drop table if exists admin_users cascade;
drop table if exists users cascade;

drop function if exists set_updated_at() cascade;
drop function if exists is_admin() cascade;

drop type if exists admin_role;
drop type if exists order_status;
drop type if exists fulfillment_method;
drop type if exists variant_size_unit;

commit;
