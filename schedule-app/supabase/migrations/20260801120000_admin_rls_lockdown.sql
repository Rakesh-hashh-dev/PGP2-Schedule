-- ============================================================
-- Admin RLS lockdown — gate system_config + admin_audit_logs writes
-- to real admins, server-side.
--
-- BEFORE this migration the policies were literally:
--   "Authenticated users can insert/update system_config"
-- i.e. ANY signed-in student could open devtools and, with the public
-- anon key + their Clerk session, upsert system_config — flip
-- maintenanceMode, add bannedUsers, inject class overrides, etc. The
-- admin gate was purely client-side (ADMIN_EMAILS in App.jsx). This
-- moves the gate into Postgres.
--
-- Admins are identified by Clerk user id (auth.jwt()->>'sub'), matching
-- every other policy in this project. The set of admin ids lives in a new
-- `admins` table.
--
-- BOOTSTRAP SAFETY — this migration can NOT lock anyone out:
--   * It self-seeds `admins` from (a) the keys of
--     system_config.flags.adminRoles and (b) every distinct admin_id that
--     has ever written an audit log. Whoever has been administering the
--     app therefore keeps access with zero manual steps.
--   * is_admin() is OPEN while the admins table is empty (bootstrap
--     escape hatch), so even if both seed sources are empty the app keeps
--     working exactly as it does today until an admin is added via the
--     existing Admin Roles editor. The lockdown only "arms" once at least
--     one admin exists.
--
-- Edge functions (apply-scheduled-config, send-push, health-monitor) use
-- the service-role key, which bypasses RLS entirely — they are unaffected.
-- ============================================================

-- 1. Admin registry (Clerk user ids) ------------------------------------
create table if not exists public.admins (
  user_id  text primary key,
  added_at timestamptz not null default now(),
  added_by text
);

alter table public.admins enable row level security;

-- Admins can see the roster; nobody can mutate it via the client
-- (managed through the service-role-backed Admin Roles flow / migrations).
drop policy if exists "Admins can read admins" on public.admins;
create policy "Admins can read admins" on public.admins
  for select using (auth.jwt()->>'sub' in (select user_id from public.admins));

-- 2. Self-seed from existing signals ------------------------------------
insert into public.admins (user_id, added_by)
select k, 'seed:adminRoles'
from system_config sc,
     lateral jsonb_object_keys(coalesce(sc.flags->'adminRoles', '{}'::jsonb)) as k
where sc.id = 'global'
on conflict (user_id) do nothing;

insert into public.admins (user_id, added_by)
select distinct admin_id, 'seed:auditLog'
from admin_audit_logs
where admin_id is not null and admin_id <> ''
on conflict (user_id) do nothing;

-- 3. is_admin() helper ---------------------------------------------------
-- SECURITY DEFINER so the membership check can read `admins` regardless of
-- the caller's own RLS. STABLE — evaluated once per statement.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- bootstrap: no admins defined yet → stay open (no worse than today)
    not exists (select 1 from public.admins)
    -- registered in the admins table (seed / migration-managed)
    or (auth.jwt()->>'sub') in (select user_id from public.admins)
    -- OR granted live via the Admin Roles editor (flags.adminRoles keys).
    -- This lets the existing dashboard UI manage admins with no extra
    -- client code: whoever Deploys adminRoles is already an admin, and the
    -- people they add gain write access as soon as that Deploy commits.
    or (auth.jwt()->>'sub') in (
      select jsonb_object_keys(coalesce(flags->'adminRoles', '{}'::jsonb))
      from public.system_config where id = 'global'
    );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 4. system_config — swap permissive policies for admin-gated writes -----
-- Public read stays (the whole app reads config on every load).
drop policy if exists "Authenticated users can insert system_config" on public.system_config;
drop policy if exists "Authenticated users can update system_config" on public.system_config;

drop policy if exists "Admins can insert system_config" on public.system_config;
create policy "Admins can insert system_config" on public.system_config
  for insert with check (public.is_admin());

drop policy if exists "Admins can update system_config" on public.system_config;
create policy "Admins can update system_config" on public.system_config
  for update using (public.is_admin()) with check (public.is_admin());

-- 5. admin_audit_logs — only admins may write/read the trail -------------
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Authenticated users can insert admin_audit_logs" on public.admin_audit_logs;
drop policy if exists "Authenticated can read admin_audit_logs" on public.admin_audit_logs;
drop policy if exists "Public can read admin_audit_logs" on public.admin_audit_logs;

drop policy if exists "Admins can read admin_audit_logs" on public.admin_audit_logs;
create policy "Admins can read admin_audit_logs" on public.admin_audit_logs
  for select using (public.is_admin());

drop policy if exists "Admins can write admin_audit_logs" on public.admin_audit_logs;
create policy "Admins can write admin_audit_logs" on public.admin_audit_logs
  for insert with check (public.is_admin());
