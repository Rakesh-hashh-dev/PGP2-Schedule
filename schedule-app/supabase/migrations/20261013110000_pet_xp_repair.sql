-- ============================================================
-- pet_xp_repair: stop and undo the XP-inflation bug.
--
-- The bug: the client folded ledger entries older than 30 days into base_xp
-- (prune), but pet_state_merge kept BOTH the greater base_xp and the unioned
-- ledger, so the folded entries survived on the server; the next sync restored
-- them, folded them again, and base_xp grew by the same amount every sync.
-- Prod: ledger XP p90 4,083 / max 4,648 (matches the xp model), yet total base_xp
-- is 314k and the max stored total 52k.
--
-- Decision: correct XP (= ledger + granted_xp, base_xp retired to 0) and keep
-- every unlock an inflated student already had, through a server-owned
-- legacy_xp floor (the pre-repair inflated total) that the client uses for
-- OWNERSHIP only (src/lib/pet.js unlockStanding).
--
-- Standalone: works against today's prod schema (cap 12, existing pet_level_for).
-- Apply BEFORE 20261013120000_pet_level_cap_20.sql, which preserves these
-- semantics. NOT applied yet.
--
-- ── Read-only pre-check (run first, then decide) ─────────────
-- A ledger that starts well after adoption means genuine pre-sync XP that only
-- base_xp held; zeroing base_xp would lose it. Expect ~0 rows.
--
--   select count(*) as rows_with_late_ledger_start
--   from (
--     select ps.user_id, ps.adopted_at,
--            (select min((e.value ->> 0)::date)
--               from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e) as first_day
--     from public.pet_state ps
--     where ps.pet_key is not null and ps.base_xp > 0
--   ) t
--   where t.first_day is null or t.first_day > t.adopted_at + 2;
--
--   -- and the rows themselves: same subquery, then
--   -- select user_id, adopted_at, first_day from (...) t
--   -- where t.first_day is null or t.first_day > t.adopted_at + 2 order by 3 desc;
-- ============================================================

-- One explicit transaction, so pasting this into the Supabase SQL editor (or
-- psql -f without -1) is all-or-nothing. The sanity block at the end raises, and
-- therefore rolls everything back, if the backfill did not land.
begin;

-- Pre-repair count, compared against legacy_xp at the end.
create temp table _pet_repair_pre on commit drop as
  select count(*) filter (where base_xp > 0)::int as with_base from public.pet_state;

alter table public.pet_state
  add column if not exists legacy_xp int not null default 0 check (legacy_xp >= 0);

comment on column public.pet_state.legacy_xp is
  'Pre-repair inflated XP total (base_xp + granted_xp + ledger). Server-owned '
  'unlock FLOOR for ownership only; never counted as XP, never lowered.';

-- Pin legacy_xp the same way granted_xp is pinned, and base_xp (retired, always
-- 0): only the admin path (pet.allow_grant = 1) may move the first two; nobody
-- through this path may write base_xp.
create or replace function public.pet_state_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if coalesce(current_setting('pet.allow_grant', true), '') <> '1' then
    if tg_op = 'UPDATE' then
      new.granted_xp = old.granted_xp;
      new.companion_enabled = old.companion_enabled;
      new.legacy_xp = old.legacy_xp;
    else
      new.granted_xp = 0;
      new.companion_enabled = true;
      new.legacy_xp = 0;
    end if;
    new.base_xp = 0;
  end if;
  return new;
end;
$$;

-- ── One-shot backfill ───────────────────────────────────────
-- legacy_xp keeps the inflated total for rows that had a base_xp; base_xp is
-- retired to 0; level is recomputed from the REAL XP (ledger + granted_xp).
-- granted_xp is left alone. Re-running is harmless: base_xp is already 0 then,
-- so legacy_xp is not recomputed.
--
-- Independent of transaction scope: the guard trigger is disabled around the
-- write instead of relying on a transaction-local set_config flag (which expires
-- between statements outside a transaction and would pin legacy_xp to 0 after
-- base_xp was zeroed). ONE statement writes legacy_xp and zeroes base_xp, so a
-- half-applied state is impossible.
alter table public.pet_state disable trigger pet_state_touch;

update public.pet_state ps
set legacy_xp = case
      when ps.base_xp > 0 then greatest(0, ps.base_xp + ps.granted_xp + l.ledger)
      else ps.legacy_xp end,
    base_xp = 0,
    level = public.pet_level_for(greatest(0, ps.granted_xp + l.ledger))
from (
  select p.user_id,
         coalesce((
           select sum(greatest(0, (e.value ->> 1)::int))
           from jsonb_each(coalesce(p.awarded, '{}'::jsonb)) as e
         ), 0)::int as ledger
  from public.pet_state p
) l
where ps.user_id = l.user_id;

alter table public.pet_state enable trigger pet_state_touch;

-- ── Earned XP = ledger only (base_xp is retired) ────────────
create or replace function public.pet_earned_xp(p_user_id text)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce((
    select sum(greatest(0, (e.value ->> 1)::int))
    from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
  ), 0)::int
  from public.pet_state ps
  where ps.user_id = p_user_id;
$$;

revoke all on function public.pet_earned_xp(text) from public, anon;
grant execute on function public.pet_earned_xp(text) to authenticated;

-- ── The merge RPC: ignore p_base_xp, never lower legacy_xp ──
-- Same signature (old clients still send p_base_xp; it is accepted and ignored).
-- base_xp stays 0, legacy_xp is never written here, level comes from the real
-- XP (ledger + granted_xp).
create or replace function public.pet_state_merge(
  p_pet_key    text,
  p_name       text,
  p_adopted_at date,
  p_base_xp    int,
  p_awarded    jsonb,
  p_care       jsonb,
  p_last_seen  bigint,
  p_unlocked   jsonb,
  p_cosmetics  jsonb
)
returns public.pet_state
language plpgsql
set search_path = public
as $$
declare
  v_uid text := auth.jwt() ->> 'sub';
  v_old public.pet_state;
  v_new public.pet_state;
  v_incoming_newer boolean;
  v_ledger_xp int;
begin
  if v_uid is null or v_uid = '' then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_old from public.pet_state where user_id = v_uid for update;

  if not found then
    insert into public.pet_state (
      user_id, pet_key, name, adopted_at, base_xp,
      awarded, care, last_seen, unlocked, cosmetics, level
    ) values (
      v_uid, p_pet_key, nullif(btrim(coalesce(p_name, '')), ''), p_adopted_at,
      0,
      coalesce(p_awarded, '{}'::jsonb),
      coalesce(p_care, '{"day": null, "used": 0}'::jsonb),
      greatest(coalesce(p_last_seen, 0), 0),
      coalesce(p_unlocked, '[]'::jsonb),
      coalesce(p_cosmetics, '{"accessory": true}'::jsonb),
      1
    )
    returning * into v_new;
  else
    v_incoming_newer := coalesce(p_last_seen, 0) >= coalesce(v_old.last_seen, 0);
    if p_pet_key is null then
      v_incoming_newer := false;
    elsif v_old.pet_key is null then
      v_incoming_newer := true;
    end if;

    update public.pet_state set
      pet_key = case when v_incoming_newer then p_pet_key else v_old.pet_key end,
      name = case when v_incoming_newer
                  then nullif(btrim(coalesce(p_name, '')), '') else v_old.name end,
      cosmetics = case when v_incoming_newer
                       then coalesce(p_cosmetics, v_old.cosmetics) else v_old.cosmetics end,
      adopted_at = least(v_old.adopted_at, p_adopted_at),
      -- Retired: an old client's p_base_xp is ignored, so the fold-then-union
      -- loop cannot restart. legacy_xp is not touched (the trigger pins it).
      base_xp = 0,
      last_seen = greatest(coalesce(p_last_seen, 0), coalesce(v_old.last_seen, 0)),
      awarded = coalesce(v_old.awarded, '{}'::jsonb) || coalesce(p_awarded, '{}'::jsonb),
      care = case
        when coalesce(p_care ->> 'day', '') = coalesce(v_old.care ->> 'day', '')
          then jsonb_build_object(
            'day', p_care -> 'day',
            'used', greatest(coalesce((p_care ->> 'used')::int, 0),
                             coalesce((v_old.care ->> 'used')::int, 0)))
        when v_incoming_newer then coalesce(p_care, v_old.care)
        else v_old.care
      end,
      unlocked = (
        select coalesce(jsonb_agg(distinct k), '[]'::jsonb)
        from (
          select jsonb_array_elements(coalesce(v_old.unlocked, '[]'::jsonb)) as k
          union
          select jsonb_array_elements(coalesce(p_unlocked, '[]'::jsonb)) as k
        ) u
      )
    where user_id = v_uid
    returning * into v_new;
  end if;

  select coalesce(sum(greatest(0, (e.value ->> 1)::int)), 0) into v_ledger_xp
  from jsonb_each(coalesce(v_new.awarded, '{}'::jsonb)) as e;

  update public.pet_state
  set level = public.pet_level_for(greatest(0, v_new.granted_xp + v_ledger_xp))
  where user_id = v_uid
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) to authenticated;

-- ── Admin RPCs that read base_xp: treat it as 0 ─────────────
-- admin_set_pet_level (latest: 20260904160000)
create or replace function public.admin_set_pet_level(p_user_id text, p_level int)
returns table (user_id text, pet_key text, level int, total_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded jsonb;
  v_granted_xp int;
  v_ledger_xp int;
  v_earned_xp int;
  v_target_xp int;
  v_total_xp int;
  v_actual_level int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'A user is required' using errcode = '22023';
  end if;
  if p_level is null or p_level < 1 or p_level > 12 then
    raise exception 'Level must be between 1 and 12' using errcode = '22023';
  end if;

  select ps.awarded, ps.granted_xp
    into v_awarded, v_granted_xp
  from public.pet_state ps
  where ps.user_id = p_user_id and ps.pet_key is not null
  for update;

  if not found then
    raise exception 'This student has not adopted a companion yet' using errcode = 'P0002';
  end if;

  select coalesce(sum(greatest(0, (entry.value ->> 1)::int)), 0)
  into v_ledger_xp
  from jsonb_each(coalesce(v_awarded, '{}'::jsonb)) as entry;

  v_target_xp := (p_level - 1) * 100 + 50 * (p_level - 1) * (p_level - 2) / 2;

  -- base_xp is retired (always 0): earned XP is the ledger alone. A minimum,
  -- never a reduction: awards are never removed or made payable again.
  v_earned_xp := v_ledger_xp;
  v_granted_xp := greatest(v_granted_xp, v_target_xp - v_earned_xp, 0);
  v_total_xp := v_earned_xp + v_granted_xp;
  v_actual_level := public.pet_level_for(v_total_xp);

  perform set_config('pet.allow_grant', '1', true);

  update public.pet_state ps
  set granted_xp = v_granted_xp,
      level = v_actual_level
  where ps.user_id = p_user_id;

  perform set_config('pet.allow_grant', '0', true);

  return query
  select p_user_id, (select ps.pet_key from public.pet_state ps where ps.user_id = p_user_id),
         v_actual_level, v_total_xp;
end;
$$;

revoke all on function public.admin_set_pet_level(text, int) from public, anon;
grant execute on function public.admin_set_pet_level(text, int) to authenticated;

-- admin_bulk_adjust_pet_xp (latest: 20260904170000)
create or replace function public.admin_bulk_adjust_pet_xp(p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_delta is null then
    raise exception 'An amount is required' using errcode = '22023';
  end if;

  perform set_config('pet.allow_grant', '1', true);
  with earned as (
    select ps.user_id,
           -- sum() yields bigint; cast back or pet_level_for(int) won't match.
           coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0)::int as xp
    from public.pet_state ps
    where ps.pet_key is not null
  ), adjusted as (
    select e.user_id, greatest(ps.granted_xp + p_delta, -e.xp) as granted, e.xp
    from earned e join public.pet_state ps on ps.user_id = e.user_id
  )
  update public.pet_state ps
  set granted_xp = a.granted,
      level = public.pet_level_for(a.xp + a.granted)
  from adjusted a
  where ps.user_id = a.user_id;
  get diagnostics v_count = row_count;
  perform set_config('pet.allow_grant', '0', true);

  return v_count;
end;
$$;

revoke all on function public.admin_bulk_adjust_pet_xp(int) from public, anon;
grant execute on function public.admin_bulk_adjust_pet_xp(int) to authenticated;

-- admin_bulk_set_pet_level (latest: 20260904170000)
create or replace function public.admin_bulk_set_pet_level(p_level int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_target int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_level is null or p_level < 1 or p_level > 12 then
    raise exception 'Level must be between 1 and 12' using errcode = '22023';
  end if;

  v_target := (p_level - 1) * 100 + 50 * (p_level - 1) * (p_level - 2) / 2;

  perform set_config('pet.allow_grant', '1', true);
  with earned as (
    select ps.user_id,
           -- sum() yields bigint; cast back or pet_level_for(int) won't match.
           coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0)::int as xp
    from public.pet_state ps
    where ps.pet_key is not null
  )
  update public.pet_state ps
  set granted_xp = greatest(v_target - e.xp, -e.xp),
      level = public.pet_level_for(e.xp + greatest(v_target - e.xp, -e.xp))
  from earned e
  where ps.user_id = e.user_id;
  get diagnostics v_count = row_count;
  perform set_config('pet.allow_grant', '0', true);

  return v_count;
end;
$$;

revoke all on function public.admin_bulk_set_pet_level(int) from public, anon;
grant execute on function public.admin_bulk_set_pet_level(int) to authenticated;

-- admin_bulk_reset_pet_adjustments (latest: 20260904170000)
create or replace function public.admin_bulk_reset_pet_adjustments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  perform set_config('pet.allow_grant', '1', true);
  with earned as (
    select ps.user_id,
           -- sum() yields bigint; cast back or pet_level_for(int) won't match.
           coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0)::int as xp
    from public.pet_state ps
    where ps.pet_key is not null and ps.granted_xp <> 0
  )
  update public.pet_state ps
  set granted_xp = 0, level = public.pet_level_for(e.xp)
  from earned e
  where ps.user_id = e.user_id;
  get diagnostics v_count = row_count;
  perform set_config('pet.allow_grant', '0', true);

  return v_count;
end;
$$;

revoke all on function public.admin_bulk_reset_pet_adjustments() from public, anon;
grant execute on function public.admin_bulk_reset_pet_adjustments() to authenticated;

-- get_friend_pets needs no change: it projects the hat/neck/coat/title the owner
-- chose (cosmetics jsonb) and never validated ownership server-side, so the
-- legacy floor already keeps what friends see. Only `level` there is now the
-- real (recounted) level.

-- ── Sanity check: roll everything back if the repair did not land ──
do $$
declare
  v_pre int;
  v_legacy int;
  v_left int;
begin
  select with_base into v_pre from _pet_repair_pre;
  select count(*) filter (where legacy_xp > 0), count(*) filter (where base_xp > 0)
    into v_legacy, v_left
  from public.pet_state;
  if v_left > 0 then
    raise exception 'pet_xp_repair: % rows still have base_xp > 0', v_left;
  end if;
  -- ">" (not "<>") so a harmless re-run, where the pre-count is already 0, passes.
  if v_pre > v_legacy then
    raise exception 'pet_xp_repair: % rows had base_xp > 0 but only % have legacy_xp > 0', v_pre, v_legacy;
  end if;
end $$;

commit;
