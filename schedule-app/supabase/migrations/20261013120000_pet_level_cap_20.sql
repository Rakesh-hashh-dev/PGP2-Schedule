-- ============================================================
-- Pet level cap 12 -> 20.
--
-- APPLIED to prod 2026-10-13, after 20261013110000_pet_xp_repair.sql (which it
-- requires). SERVER_LEVEL_CAP in lib/pet.js was raised to 20 alongside it.
--
-- Everything below is the LATEST definition of each function with only the cap
-- changed (12 -> 20), starting from the post-REPAIR versions: base_xp is retired
-- (never read, earned XP is the ledger alone), and pet_state_merge /
-- pet_earned_xp / the trigger from the repair are NOT recreated here, so
-- p_base_xp stays ignored and legacy_xp is never lowered. Sources:
--   pet_level_for                        20260904160000_pet_state_merge.sql
--   admin_set_pet_level,
--   admin_bulk_set_pet_level             20261013110000_pet_xp_repair.sql
--   admin_set_pet_level_exact            20260904170000_pet_xp_admin.sql
-- (admin_set_pet_level's older `v_actual_level < 12` loop in 20260904143000 was
-- already replaced by pet_level_for.) pet_state_merge and the other admin RPCs
-- derive level through pet_level_for, so they pick the new cap up automatically.
-- ============================================================

-- One explicit transaction, so a paste into the SQL editor is all-or-nothing.
begin;

-- Don't assume the inline check's name: find every check on pet_state that
-- references the level column, drop it, then add the new one.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pet_state'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~ '\mlevel\M'
  loop
    execute format('alter table public.pet_state drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.pet_state add constraint pet_state_level_check
  check (level between 1 and 20);

-- Mirrors xpToReach/levelFor in lib/pet.js, a PIECEWISE curve:
--   levels 1-12:  (l-1)*100 + 50*(l-1)*(l-2)/2
--   levels 13-20: 3850 + k*140 + 10*k*(k-1)/2, k = l - 12
-- Cumulative XP to reach each level (pet.test.js asserts the same table):
--   1:0 2:100 3:250 4:450 5:700 6:1000 7:1350 8:1750 9:2200 10:2700 11:3250
--   12:3850 13:3990 14:4140 15:4300 16:4470 17:4650 18:4840 19:5040 20:5250
create or replace function public.pet_xp_to_reach(p_level int)
returns int
language sql
immutable
as $$
  select case
    when p_level <= 12 then (p_level - 1) * 100 + 50 * (p_level - 1) * (p_level - 2) / 2
    else 3850 + (p_level - 12) * 140 + 10 * (p_level - 12) * (p_level - 13) / 2
  end;
$$;

revoke all on function public.pet_xp_to_reach(int) from public, anon;
grant execute on function public.pet_xp_to_reach(int) to authenticated;

create or replace function public.pet_level_for(p_xp int)
returns int
language sql
immutable
as $$
  select coalesce(max(l), 1)
  from generate_series(1, 20) as l
  where coalesce(p_xp, 0) >= public.pet_xp_to_reach(l);
$$;

revoke all on function public.pet_level_for(int) from public, anon;
grant execute on function public.pet_level_for(int) to authenticated;

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
  if p_level is null or p_level < 1 or p_level > 20 then
    raise exception 'Level must be between 1 and 20' using errcode = '22023';
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

  v_target_xp := public.pet_xp_to_reach(p_level);

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

create or replace function public.admin_set_pet_level_exact(p_user_id text, p_level int)
returns table (user_id text, pet_key text, level int, total_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned int;
  v_target int;
  v_granted int;
  v_total int;
  v_level int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_level is null or p_level < 1 or p_level > 20 then
    raise exception 'Level must be between 1 and 20' using errcode = '22023';
  end if;

  perform 1 from public.pet_state ps
  where ps.user_id = p_user_id and ps.pet_key is not null
  for update;

  if not found then
    raise exception 'This student has not adopted a companion yet' using errcode = 'P0002';
  end if;

  v_earned := public.pet_earned_xp(p_user_id);
  v_target := public.pet_xp_to_reach(p_level);
  v_granted := greatest(v_target - v_earned, -v_earned);
  v_total := v_earned + v_granted;
  v_level := public.pet_level_for(v_total);

  perform set_config('pet.allow_grant', '1', true);
  update public.pet_state ps
  set granted_xp = v_granted, level = v_level
  where ps.user_id = p_user_id;
  perform set_config('pet.allow_grant', '0', true);

  return query
  select p_user_id,
         (select ps.pet_key from public.pet_state ps where ps.user_id = p_user_id),
         v_level, v_total;
end;
$$;

revoke all on function public.admin_set_pet_level_exact(text, int) from public, anon;
grant execute on function public.admin_set_pet_level_exact(text, int) to authenticated;

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
  if p_level is null or p_level < 1 or p_level > 20 then
    raise exception 'Level must be between 1 and 20' using errcode = '22023';
  end if;

  v_target := public.pet_xp_to_reach(p_level);

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

-- Refresh stored levels under the new cap (the repair left them capped at 12).
update public.pet_state ps
set level = public.pet_level_for(greatest(0, ps.granted_xp + coalesce((
  select sum(greatest(0, (e.value ->> 1)::int))
  from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
), 0)::int))
where ps.pet_key is not null;

commit;
