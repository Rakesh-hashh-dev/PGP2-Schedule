-- ============================================================
-- Atomic pet merge + a single source of truth for the level curve.
--
-- Fixes two things the client-side read-merge-write could not:
--
--   1. THE WRITE RACE. Merging in JS leaves a gap between the read and the
--      upsert. Two devices open at once can interleave there and the later
--      writer drops ledger entries the earlier one added. Doing the union in
--      one statement closes the gap entirely — the row is locked for the
--      duration, so concurrent writers serialise instead of overwriting.
--
--   2. THE STALE LEVEL. `level` is the only column friends can read, and the
--      client rewrites it from the XP it knows about. A client that has not
--      re-synced since an admin grant does not know about granted_xp, so it
--      writes a level that is too low and friends briefly see the wrong
--      number. Computing it here — where granted_xp is always visible —
--      means the client can no longer get it wrong.
--
-- Merge semantics deliberately mirror mergePets() in lib/pet.js exactly:
-- ledger UNION, max on the monotonic counters, and identity/cosmetic fields
-- from whichever copy was touched more recently.
-- ============================================================

-- ── The level curve, defined once ───────────────────────────
-- Previously inlined in admin_set_pet_level and about to be needed here too.
-- Mirrors xpToReach/levelFor in lib/pet.js: level 1 costs 0, then 100, 150,
-- 200… KEEP IN SYNC with the XP/LEVEL_BASE/LEVEL_STEP block there.
create or replace function public.pet_level_for(p_xp int)
returns int
language sql
immutable
as $$
  select coalesce(max(l), 1)
  from generate_series(1, 12) as l
  where coalesce(p_xp, 0) >= (l - 1) * 100 + 50 * (l - 1) * (l - 2) / 2;
$$;

-- ── Atomic merge ────────────────────────────────────────────
-- SECURITY INVOKER (the default): RLS still applies, so a student can only
-- ever merge into their own row. The user id comes from the JWT rather than a
-- parameter so it cannot be spoofed.
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

  -- Locks the row for the rest of the transaction; a concurrent merge waits
  -- here rather than racing us. This is the whole point of the function.
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
    -- An un-adopted copy never wins on identity: adopting on one device must
    -- not be undone by a blank row syncing up from another.
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
      -- Earliest adoption date survives: it is a fact about the past.
      adopted_at = least(v_old.adopted_at, p_adopted_at),
      -- Monotonic counters: base_xp only grows through pruning, so the larger
      -- value is the copy that pruned further.
      base_xp = greatest(coalesce(p_base_xp, 0), coalesce(v_old.base_xp, 0)),
      last_seen = greatest(coalesce(p_last_seen, 0), coalesce(v_old.last_seen, 0)),
      -- THE LEDGER UNION. Keys are stable event ids and values are identical
      -- for a given key, so `||` is a true union and order does not matter.
      awarded = coalesce(v_old.awarded, '{}'::jsonb) || coalesce(p_awarded, '{}'::jsonb),
      -- Same day ⇒ the higher count wins, so two devices cannot spend the care
      -- budget twice. Different day ⇒ the more recent copy's counter stands.
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

  -- Level is derived here, never taken from the client, so granted_xp is
  -- always counted even when the caller has never seen it.
  select coalesce(sum(greatest(0, (e.value ->> 1)::int)), 0) into v_ledger_xp
  from jsonb_each(coalesce(v_new.awarded, '{}'::jsonb)) as e;

  update public.pet_state
  set level = public.pet_level_for(v_new.base_xp + v_new.granted_xp + v_ledger_xp)
  where user_id = v_uid
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.pet_state_merge(text, text, date, int, jsonb, jsonb, bigint, jsonb, jsonb) to authenticated;

revoke all on function public.pet_level_for(int) from public, anon;
grant execute on function public.pet_level_for(int) to authenticated;

-- ── Fold the curve duplication out of the admin RPC ─────────
-- Behaviour is unchanged; the inline while-loop is replaced by the shared
-- function so there is exactly one copy of the curve in SQL.
create or replace function public.admin_set_pet_level(p_user_id text, p_level int)
returns table (user_id text, pet_key text, level int, total_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded jsonb;
  v_base_xp int;
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

  select ps.awarded, ps.base_xp, ps.granted_xp
    into v_awarded, v_base_xp, v_granted_xp
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

  -- base_xp is the client's to own (it grows by pruning), so this function
  -- never writes it — it only tops up the separate, admin-owned granted_xp.
  -- A minimum, never a reduction: awards are never removed or made payable again.
  v_earned_xp := v_base_xp + v_ledger_xp;
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
