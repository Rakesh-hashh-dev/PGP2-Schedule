-- ============================================================
-- Admin tools roadmap — Phase 0 + item 8 steps 1-2.
-- See docs/ADMIN_TOOLS_ENHANCEMENTS.md.
--
-- Two problems, one migration, because they share the same root cause:
-- everything admin lives in ONE world-readable JSONB blob
-- (system_config.flags, id='global', public SELECT by design — the whole
-- app reads config on every load).
--
-- 1. ROLE ENFORCEMENT WAS COSMETIC. `flags.adminRoles[id] === "monitor"`
--    gated saving with a client-side alert(), while is_admin() treated
--    ANY key in that map as a full admin. A "monitor" could open devtools
--    and write system_config directly. Roles now live on public.admins,
--    are read by can_write_config(), and are enforced in the UPDATE policy.
--
-- 2. THE ROLE MAP WAS PUBLIC. adminRoles sat in the public-read blob, so
--    the admin roster was world-readable. It moves to public.admins
--    (admin-gated SELECT) and is stripped from flags at the end of this
--    migration — the data is copied first, nothing is lost.
--
-- 3. ADMIN-ONLY STORES. schedule_drafts / schedule_versions /
--    schedule_templates unblock roadmap items 1, 3 and 4. They are
--    separate tables specifically so drafts are NOT visible to students
--    and do NOT inflate the config payload every user downloads on cold
--    start. flags.classOverrides (the PUBLISHED map) deliberately stays
--    exactly where it is, so the student app, class-reminders and
--    schedule-diff keep reading what they read today — no synchronised
--    redeploy needed.
--
-- Edge functions use the service-role key and bypass RLS entirely, so
-- they are unaffected by every policy change below.
-- ============================================================

-- ── 1. Roles on the admin registry ──────────────────────────
-- Default 'superadmin': every pre-existing row was created when the only
-- notion of admin was "full access", so preserving that is the
-- non-breaking read of the old data.
alter table public.admins add column if not exists role text not null default 'superadmin';

alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check
  check (role in ('monitor', 'superadmin'));

comment on column public.admins.role is
  'monitor = read-only admin (cannot write system_config or the draft '
  'stores); superadmin = full access incl. role management. Enforced by '
  'can_write_config(), not by the client.';

-- ── 2. Carry the existing role map over before dropping it ──
-- Runs before the strip in step 8. On a re-run the blob no longer has
-- adminRoles, so this selects nothing and is a no-op.
insert into public.admins (user_id, role, added_by)
select
  e.key,
  case when e.value #>> '{}' = 'monitor' then 'monitor' else 'superadmin' end,
  'seed:adminRoles'
from public.system_config sc,
     lateral jsonb_each(coalesce(sc.flags -> 'adminRoles', '{}'::jsonb)) as e
where sc.id = 'global'
on conflict (user_id) do update set role = excluded.role;

-- ── 3. Role-aware helpers ───────────────────────────────────
-- The caller's role, or null when they are not a registered admin.
create or replace function public.admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admins where user_id = auth.jwt()->>'sub';
$$;

revoke all on function public.admin_role() from public, anon;
grant execute on function public.admin_role() to authenticated;

-- is_admin() = "may read admin surfaces". Redefined to DROP the old
-- third clause that read flags->'adminRoles': that map is going away, and
-- sourcing authority from a world-readable field was the bug.
-- The bootstrap escape hatch stays: with an empty roster the app keeps
-- working exactly as it does today. It closes by itself the moment step 2
-- seeds a single admin, which in production it does.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (select 1 from public.admins)
    or (auth.jwt()->>'sub') in (select user_id from public.admins);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- The gate that actually has teeth: admin AND not read-only. The coalesce
-- keeps the bootstrap case (empty roster, admin_role() null) writable.
create or replace function public.can_write_config()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() and coalesce(public.admin_role(), 'superadmin') <> 'monitor';
$$;

revoke all on function public.can_write_config() from public, anon;
grant execute on function public.can_write_config() to authenticated;

-- ── 3b. Fix the self-referential policy on admins ───────────
-- The lockdown migration wrote:
--   using (auth.jwt()->>'sub' in (select user_id from public.admins))
-- i.e. a policy ON admins that SELECTs admins. Any client-role access to
-- the table raises "infinite recursion detected in policy for relation
-- admins", so the roster is effectively unreadable from the app today.
-- is_admin() is SECURITY DEFINER and therefore reads the table without
-- re-entering RLS, which breaks the cycle.
drop policy if exists "Admins can read admins" on public.admins;
create policy "Admins can read admins" on public.admins
  for select using (public.is_admin());

-- ── 4. system_config writes now require a writing role ──────
-- Public read still stays: the whole app reads config on every load.
--
-- The 2026-08-01 lockdown migration added admin-gated policies to this
-- table but never enabled row security on it, and a policy is inert until
-- it is — so those policies may never have been enforcing anything.
--
-- Enabling row security is therefore the change that finally makes the
-- write gate real. But it is also the single most dangerous statement in
-- this file: no repo migration has ever created a SELECT policy here, and
-- with row security on and no SELECT policy, EVERY student's app stops
-- reading config — a total outage. So state the public read explicitly
-- FIRST. If a dashboard-created read policy already exists in production,
-- this one is simply redundant (policies are OR'd); if none exists, this
-- is what keeps the app alive when row security switches on.
grant select on public.system_config to anon, authenticated;

drop policy if exists "Public can read system_config" on public.system_config;
create policy "Public can read system_config" on public.system_config
  for select using (true);

alter table public.system_config enable row level security;

drop policy if exists "Admins can insert system_config" on public.system_config;
create policy "Admins can insert system_config" on public.system_config
  for insert with check (public.can_write_config());

drop policy if exists "Admins can update system_config" on public.system_config;
create policy "Admins can update system_config" on public.system_config
  for update using (public.can_write_config()) with check (public.can_write_config());

-- ── 5. Role management RPCs ─────────────────────────────────
-- public.admins has no client INSERT/UPDATE/DELETE policy on purpose, so
-- role changes go through these SECURITY DEFINER functions, which is also
-- where the "don't lock everyone out" guard lives.
create or replace function public.admin_list_roles()
returns table (user_id text, role text, added_at timestamptz, added_by text)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.role, a.added_at, a.added_by
  from public.admins a
  where public.is_admin()
  order by a.role, a.added_at;
$$;

revoke all on function public.admin_list_roles() from public, anon;
grant execute on function public.admin_list_roles() to authenticated;

create or replace function public.admin_set_role(p_user_id text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.jwt()->>'sub';
begin
  -- Bootstrap (empty roster) is allowed through so the first admin can be
  -- created; after that only a superadmin may hand out roles.
  if exists (select 1 from public.admins)
     and coalesce(public.admin_role(), '') <> 'superadmin' then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'A user id is required' using errcode = '22023';
  end if;
  if p_role not in ('monitor', 'superadmin') then
    raise exception 'Unknown role: %', p_role using errcode = '22023';
  end if;

  -- Demoting yourself when you are the only superadmin locks the whole
  -- team out of config writes with no way back through the UI.
  if p_role = 'monitor'
     and exists (select 1 from public.admins where user_id = p_user_id and role = 'superadmin')
     and (select count(*) from public.admins where role = 'superadmin') <= 1 then
    raise exception 'Cannot demote the last superadmin' using errcode = '23514';
  end if;

  insert into public.admins (user_id, role, added_by)
  values (p_user_id, p_role, coalesce(v_caller, 'unknown'))
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.admin_set_role(text, text) from public, anon;
grant execute on function public.admin_set_role(text, text) to authenticated;

create or replace function public.admin_remove_role(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.admins)
     and coalesce(public.admin_role(), '') <> 'superadmin' then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id and role = 'superadmin')
     and (select count(*) from public.admins where role = 'superadmin') <= 1 then
    raise exception 'Cannot remove the last superadmin' using errcode = '23514';
  end if;

  delete from public.admins where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_remove_role(text) from public, anon;
grant execute on function public.admin_remove_role(text) to authenticated;

-- ── 6. Phase 0 stores — admin-only, off the public blob ─────
create table if not exists public.schedule_drafts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Untitled draft',
  status          text not null default 'draft' check (status in ('draft', 'published', 'discarded')),
  -- The override map this draft proposes, same shape as
  -- flags.classOverrides: { [date]: { [key]: override } }.
  payload         jsonb not null default '{}'::jsonb,
  -- system_config.updated_at the draft was branched from, so a publish can
  -- tell "still current" from "the config moved under me".
  base_updated_at timestamptz,
  note            text,
  created_by      text not null default coalesce(auth.jwt()->>'sub', 'unknown'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz,
  published_by    text
);

comment on table public.schedule_drafts is
  'Unpublished class-override changes. Deliberately NOT in '
  'system_config.flags: that row is world-readable, so a draft stored '
  'there would be visible to every student before publication.';

create index if not exists schedule_drafts_status_idx
  on public.schedule_drafts (status, updated_at desc);

create table if not exists public.schedule_versions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  summary    text,
  -- Full flags snapshot, history keys already stripped by the client.
  flags      jsonb not null,
  created_by text not null default coalesce(auth.jwt()->>'sub', 'unknown'),
  created_at timestamptz not null default now()
);

comment on table public.schedule_versions is
  'Named schedule snapshots. Extends the existing flags.configHistory '
  '(15 unlabelled entries) rather than replacing it — history stays where '
  'it is so the Restore Version dropdown keeps working.';

create index if not exists schedule_versions_created_idx
  on public.schedule_versions (created_at desc);

create table if not exists public.schedule_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'custom',
  payload    jsonb not null default '{}'::jsonb,
  -- Sections the template was authored against. Section structure is
  -- hardwired and known to shift across term rollovers, so application
  -- must re-validate against current data instead of trusting this.
  sections   text[] not null default '{}',
  created_by text not null default coalesce(auth.jwt()->>'sub', 'unknown'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.schedule_templates is
  'Reusable schedule operations (makeup classes, exam weeks, holidays). '
  'Re-validate `sections` against live section data at apply time.';

-- ── 7. RLS: admins read, writing roles write ────────────────
alter table public.schedule_drafts    enable row level security;
alter table public.schedule_versions  enable row level security;
alter table public.schedule_templates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['schedule_drafts', 'schedule_versions', 'schedule_templates'] loop
    execute format('drop policy if exists "Admins read %1$s" on public.%1$I', t);
    execute format(
      'create policy "Admins read %1$s" on public.%1$I for select using (public.is_admin())', t);

    execute format('drop policy if exists "Writers insert %1$s" on public.%1$I', t);
    execute format(
      'create policy "Writers insert %1$s" on public.%1$I for insert with check (public.can_write_config())', t);

    execute format('drop policy if exists "Writers update %1$s" on public.%1$I', t);
    execute format(
      'create policy "Writers update %1$s" on public.%1$I for update using (public.can_write_config()) with check (public.can_write_config())', t);

    execute format('drop policy if exists "Writers delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "Writers delete %1$s" on public.%1$I for delete using (public.can_write_config())', t);
  end loop;
end;
$$;

-- ── 7b. Refuse to lock everyone out ─────────────────────────
-- Everything above is one transaction, so raising here rolls the whole
-- migration back. Step 2 assigns roles from the old map; if that map
-- somehow contained no superadmin, this migration would hand the roster
-- nothing but read-only accounts and no one could ever deploy config
-- again. Fail loudly instead, with the state that caused it.
do $$
declare
  v_supers int;
  v_total  int;
begin
  select count(*) filter (where role = 'superadmin'), count(*)
    into v_supers, v_total
  from public.admins;

  if v_total > 0 and v_supers = 0 then
    raise exception
      'Refusing to apply: this would leave 0 superadmins out of % admins. '
      'Grant one superadmin before re-running.', v_total;
  end if;
end;
$$;

-- ── 8. Retire the public role map ───────────────────────────
-- Last, so every read above still saw it. Roles were copied to
-- public.admins in step 2; this only removes the world-readable copy.
update public.system_config
set flags = flags - 'adminRoles'
where id = 'global' and flags ? 'adminRoles';
