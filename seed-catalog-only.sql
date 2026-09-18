-- =====================================================================
-- MINIMAL CATALOG SEED: just categories/products/product_variants from
-- your 6 real products. Skips users/addresses/wishlists/reviews/orders
-- entirely — not needed to test checkout, and each one was a chance for
-- the whole transaction to roll back. Run this AFTER alter-orders-compat.sql.
-- =====================================================================

begin;

alter table products         add column if not exists legacy_id text unique;
alter table product_variants add column if not exists legacy_id text unique;

insert into categories (name, slug, is_active)
select distinct
  "category",
  lower(regexp_replace(trim("category"), '[^a-zA-Z0-9]+', '-', 'g')),
  true
from "Product"
where "category" is not null and trim("category") <> ''
on conflict (slug) do nothing;

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

commit;

-- Verify, then optionally clean up the mapping columns:
--   select count(*) from products;          -- should be 6
--   select count(*) from product_variants;  -- should be > 0
-- alter table products drop column legacy_id;
-- alter table product_variants drop column legacy_id;
