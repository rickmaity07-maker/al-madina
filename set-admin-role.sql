-- =====================================================================
-- Rebuild admin_users so an admin is simply a `users` row that also has
-- a matching admin_users row — one identity, one login, instead of a
-- separate email/password credential set. Safe to run: admin_users is
-- currently empty (never populated by any migration).
-- =====================================================================

begin;

drop table if exists admin_users cascade;
drop type if exists admin_role;

-- Uppercase to match the rest of the app (isOwner() checks role === "OWNER", etc.)
create type admin_role as enum ('OWNER', 'STAFF');

create table admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  role       admin_role not null default 'STAFF',
  created_at timestamptz not null default now()
);

commit;

-- =====================================================================
-- Now make your own account an admin. Register/log in on the site first
-- with the email you want to use, THEN run this with that email:
-- =====================================================================
-- insert into admin_users (user_id, role)
-- select id, 'OWNER' from users where email = 'your-email@example.com';
