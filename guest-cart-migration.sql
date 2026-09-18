-- Allow carts to belong to either a logged-in user OR an anonymous guest
-- (identified by a long random token in a cookie) — same pattern Amazon
-- uses: add to cart freely as a guest, it becomes your account's cart
-- the moment you log in.

begin;

alter table carts alter column user_id drop not null;
alter table carts add column if not exists guest_token text unique;
alter table carts add constraint chk_cart_owner
  check ((user_id is not null)::int + (guest_token is not null)::int = 1);

commit;
