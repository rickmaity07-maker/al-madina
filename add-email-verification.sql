-- =====================================================================
-- EMAIL VERIFICATION: adds users.email_verified_at plus a table of
-- short-lived, hashed OTP codes sent by email. Checkout is blocked until
-- the account's email is verified (see app/api/orders/route.ts).
-- =====================================================================

begin;

alter table users add column if not exists email_verified_at timestamptz;

create table if not exists email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_email_verifications_user on email_verifications(user_id);

commit;
