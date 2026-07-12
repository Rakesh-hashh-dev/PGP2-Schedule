-- ============================================================
-- get_dev_user_ids() — interim helper for the admin dashboard
--
-- After the 2026-07-12 Clerk dev→prod cutover, `profiles` holds both the
-- migrated PROD rows and the original DEV ghost rows (kept as rollback
-- insurance and as the source data for migrate-user's on-login restore).
-- The admin dashboard uses this list to exclude dev ghosts from
-- Total Users / Active Today / User Directory.
--
-- _migration_map is service-role-only (RLS `using (false)`), hence
-- SECURITY DEFINER. Exposes only opaque, now-defunct dev user ids —
-- no emails, no prod ids.
--
-- DROP this function during Phase 2 cleanup when _migration_map is
-- dropped; the dashboard falls back gracefully (empty filter) if the
-- RPC is missing.
-- ============================================================

create or replace function public.get_dev_user_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select m.dev_user_id
  from _migration_map m
  where m.dev_user_id is not null;
$$;

revoke all on function public.get_dev_user_ids() from public, anon;
grant execute on function public.get_dev_user_ids() to authenticated;
