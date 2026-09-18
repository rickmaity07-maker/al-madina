-- delivery_token holds crypto.randomBytes(16).toString("hex") — a plain
-- hex string, not a UUID — so the column needs to be text, not uuid.
begin;
alter table orders alter column delivery_token drop default;
alter table orders alter column delivery_token type text using delivery_token::text;
commit;
