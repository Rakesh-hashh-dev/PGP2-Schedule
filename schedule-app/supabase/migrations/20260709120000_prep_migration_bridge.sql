-- ============================================================
-- PGP2 Dev → Prod migration PREP (run now, while on DEV Clerk)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe on a live app: additive only, no data rewrite, invisible to users.
-- ============================================================

-- 1. Concurrency guard for migrate-user: null → in_progress → done.
--    Lets the edge function atomically "claim" a user so two devices
--    logging in at once can't double-run the remap.
alter table _migration_map
  add column if not exists status text;   -- null = unclaimed

-- 2. Denormalize email onto the user's own profile row (insurance).
--    If _migration_map is ever lost, the bridge can be rebuilt from the
--    data itself (profiles.email → profiles.user_id).
alter table profiles
  add column if not exists email text;

-- Optional: index for the reconciliation report at cutover.
create index if not exists idx_profiles_email on profiles (lower(email));
