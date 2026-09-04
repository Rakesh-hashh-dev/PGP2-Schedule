-- ============================================================
-- Admin XP controls: reduce as well as grant, per-user and cohort-wide.
--
-- granted_xp becomes a SIGNED adjustment. Reducing a student's XP by
-- deleting ledger entries would not work: the ledger is the idempotency
-- record, so a removed entry becomes payable again and the student simply
-- re-earns it on their next sync. Subtracting through granted_xp leaves
-- earned history intact and is fully reversible (set the adjustment back
-- to 0), which is also what makes "reset adjustments" a clean undo.
--
-- Every write here clamps so that base_xp + granted_xp + ledger >= 0, so
-- total XP can never go negative and the client never has to defend
-- against it.
-- ============================================================

-- granted_xp was created non-negative when it only ever held grants.
alter table public.pet_state drop constraint if exists pet_state_granted_xp_check;

comment on column public.pet_state.granted_xp is
  'Signed admin adjustment. Positive grants, negative penalises. Never '
  'written by the client (pinned by pet_state_touch); only the '
  'admin_*_pet_* RPCs may move it.';

-- ── Shared helper: what a student has actually earned ───────
-- base_xp (pruned history) + the surviving ledger. Excludes granted_xp by
-- definition — this is the floor an adjustment is measured against.
create or replace function public.pet_earned_xp(p_user_id text)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(ps.base_xp, 0) + coalesce((
    select sum(greatest(0, (e.value ->> 1)::int))
    from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
  ), 0)
  from public.pet_state ps
  where ps.user_id = p_user_id;
$$;

revoke all on function public.pet_earned_xp(text) from public, anon;
grant execute on function public.pet_earned_xp(text) to authenticated;

-- ── Per-user: adjust XP by a delta (positive or negative) ───
create or replace function public.admin_adjust_pet_xp(p_user_id text, p_delta int)
returns table (user_id text, pet_key text, level int, total_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned int;
  v_granted int;
  v_total int;
  v_level int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'A user is required' using errcode = '22023';
  end if;
  if p_delta is null then
    raise exception 'An amount is required' using errcode = '22023';
  end if;

  select ps.granted_xp into v_granted
  from public.pet_state ps
  where ps.user_id = p_user_id and ps.pet_key is not null
  for update;

  if not found then
    raise exception 'This student has not adopted a companion yet' using errcode = 'P0002';
  end if;

  v_earned := public.pet_earned_xp(p_user_id);
  -- Clamp so the total floors at 0 rather than going negative.
  v_granted := greatest(v_granted + p_delta, -v_earned);
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

revoke all on function public.admin_adjust_pet_xp(text, int) from public, anon;
grant execute on function public.admin_adjust_pet_xp(text, int) to authenticated;

-- ── Per-user: set to exactly a level (may raise OR lower) ───
-- admin_set_pet_level is deliberately left alone as the "at least" grant.
-- This is the destructive sibling: it pins the student to exactly p_level,
-- so someone who earned beyond it loses that lead.
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
  if p_level is null or p_level < 1 or p_level > 12 then
    raise exception 'Level must be between 1 and 12' using errcode = '22023';
  end if;

  perform 1 from public.pet_state ps
  where ps.user_id = p_user_id and ps.pet_key is not null
  for update;

  if not found then
    raise exception 'This student has not adopted a companion yet' using errcode = 'P0002';
  end if;

  v_earned := public.pet_earned_xp(p_user_id);
  v_target := (p_level - 1) * 100 + 50 * (p_level - 1) * (p_level - 2) / 2;
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

-- ── Cohort-wide operations ──────────────────────────────────
-- All three touch every adopted pet, so they return the affected count for
-- the caller to log and show back.

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
           (coalesce(ps.base_xp, 0) + coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0))::int as xp
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
           (coalesce(ps.base_xp, 0) + coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0))::int as xp
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

-- Clean undo: drop every adjustment so pets fall back to purely earned XP.
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
           (coalesce(ps.base_xp, 0) + coalesce((
             select sum(greatest(0, (e.value ->> 1)::int))
             from jsonb_each(coalesce(ps.awarded, '{}'::jsonb)) as e
           ), 0))::int as xp
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

-- ── Keep the merge RPC honest with signed adjustments ───────
-- Only the level line changes: clamp the total at 0 so a negative
-- adjustment can never feed a negative number into the curve.
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
      greatest(coalesce(p_base_xp, 0), 0),
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
      base_xp = greatest(coalesce(p_base_xp, 0), coalesce(v_old.base_xp, 0)),
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
  set level = public.pet_level_for(greatest(0, v_new.base_xp + v_new.granted_xp + v_ledger_xp))
  where user_id = v_uid
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) to authenticated;
