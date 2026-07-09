-- ============================================================
-- PGP2 Dev → Prod Migration Map
-- Run this in: Supabase Dashboard → SQL Editor
-- Run BEFORE switching Clerk to production instance
-- ============================================================

create table if not exists _migration_map (
  email        text primary key,
  dev_user_id  text not null,
  prod_user_id text,
  migrated_at  timestamptz,
  created_at   timestamptz default now()
);

-- Only the Edge Function (service_role) can access this table.
-- No public or authenticated access allowed.
alter table _migration_map enable row level security;

create policy "no public access"
  on _migration_map
  for all
  using (false);
