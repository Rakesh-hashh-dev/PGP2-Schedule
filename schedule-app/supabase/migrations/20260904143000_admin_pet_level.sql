-- ============================================================
-- Admin companion level control
--
-- Raises an adopted student's progress to a chosen level without deleting
-- their idempotency ledger. The client may call this only through the Admin
-- Users inspector; authorization is enforced here, not by that UI.
-- ============================================================

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
  v_actual_level int := 1;
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

  -- Same curve as lib/pet.js (XP / LEVEL_BASE / LEVEL_STEP): level 1 costs 0,
  -- then 100, 150, 200… XP. KEEP IN SYNC — retuning the curve there without
  -- editing here makes a granted "Level 5" mean something different from the
  -- Level 5 the client renders.
  v_target_xp := (p_level - 1) * 100 + 50 * (p_level - 1) * (p_level - 2) / 2;

  -- What the student actually earned. base_xp is the client's to own (it grows
  -- by pruning), so this function never writes it — it only tops up the
  -- separate, admin-owned granted_xp. That top-up is a minimum, never a
  -- reduction: awards are never removed and never become payable again.
  v_earned_xp := v_base_xp + v_ledger_xp;
  v_granted_xp := greatest(v_granted_xp, v_target_xp - v_earned_xp, 0);
  v_total_xp := v_earned_xp + v_granted_xp;
  while v_actual_level < 12
    and v_total_xp >= v_actual_level * 100 + 50 * v_actual_level * (v_actual_level - 1) / 2
  loop
    v_actual_level := v_actual_level + 1;
  end loop;

  -- Opt in to the pet_state_touch guard that otherwise pins granted_xp.
  -- Transaction-local, so it cannot leak past this call.
  perform set_config('pet.allow_grant', '1', true);

  update public.pet_state ps
  set granted_xp = v_granted_xp,
      level = v_actual_level
  where ps.user_id = p_user_id
  returning ps.base_xp + ps.granted_xp + v_ledger_xp into v_total_xp;

  perform set_config('pet.allow_grant', '0', true);

  return query
  select p_user_id, (select ps.pet_key from public.pet_state ps where ps.user_id = p_user_id),
         v_actual_level, v_total_xp;
end;
$$;

revoke all on function public.admin_set_pet_level(text, int) from public, anon;
grant execute on function public.admin_set_pet_level(text, int) to authenticated;
