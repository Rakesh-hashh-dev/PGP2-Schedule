-- ============================================================
-- Per-student companion admin tools.
--
-- Adds the things the Users inspector could not do:
--   * READ a student's companion at all. pet_state is self-only under RLS,
--     so the admin client genuinely cannot see another student's row — every
--     button in that panel was fire-and-forget with no way to confirm it
--     landed. admin_get_pet_state is the definer-side window.
--   * Clear an abusive pet name. `name` is student-controlled free text that
--     get_friend_pets exposes to peers, and nothing filtered it, so there was
--     no remedy for a name shown on other people's friend cards.
--   * Undo one student's adjustment without hand-computing the inverse.
--   * Un-adopt, grant a companion, reset the care budget, and switch the
--     feature off for a single student.
--
-- companion_enabled is pinned by the same trigger that guards granted_xp:
-- RLS lets a student write their own row, so without that an admin's
-- switch-off would be undone by the student's next save — or by hand.
-- ============================================================

alter table public.pet_state
  add column if not exists companion_enabled boolean not null default true;

comment on column public.pet_state.companion_enabled is
  'Per-student kill switch. Server-owned like granted_xp; only the admin RPCs '
  'may move it. ANDed with the cohort-wide flags.greetingPets.companion.';

-- Extend the existing guard to cover the new server-owned column.
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
    else
      new.granted_xp = 0;
      new.companion_enabled = true;
    end if;
  end if;
  return new;
end;
$$;

-- ── Read one student's companion ────────────────────────────
-- Returns the earned/adjustment split explicitly: an admin needs to see that
-- "300 XP" is "700 earned, −400 adjustment" before deciding what to do next.
create or replace function public.admin_get_pet_state(p_user_id text)
returns table (
  user_id text, pet_key text, name text, level int,
  earned_xp int, granted_xp int, total_xp int,
  adopted_at date, last_seen bigint, unlocked jsonb,
  care jsonb, companion_enabled boolean, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select ps.user_id, ps.pet_key, ps.name, ps.level,
         public.pet_earned_xp(ps.user_id),
         ps.granted_xp,
         greatest(0, public.pet_earned_xp(ps.user_id) + ps.granted_xp),
         ps.adopted_at, ps.last_seen, ps.unlocked,
         ps.care, ps.companion_enabled, ps.updated_at
  from public.pet_state ps
  where ps.user_id = p_user_id;
end;
$$;

revoke all on function public.admin_get_pet_state(text) from public, anon;
grant execute on function public.admin_get_pet_state(text) to authenticated;

-- ── Moderation: clear an abusive pet name ───────────────────
-- Blanking rather than renaming: the client falls back to the species label
-- ("Fox"), so the pet stays usable and the student can rename it themselves.
create or replace function public.admin_clear_pet_name(p_user_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select ps.name into v_old from public.pet_state ps
  where ps.user_id = p_user_id for update;
  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;

  update public.pet_state set name = null where user_id = p_user_id;
  return v_old;
end;
$$;

revoke all on function public.admin_clear_pet_name(text) from public, anon;
grant execute on function public.admin_clear_pet_name(text) to authenticated;

-- ── Undo one student's adjustment ───────────────────────────
create or replace function public.admin_reset_pet_adjustment(p_user_id text)
returns table (user_id text, level int, total_xp int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned int;
  v_level int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  perform 1 from public.pet_state ps where ps.user_id = p_user_id for update;
  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;

  v_earned := public.pet_earned_xp(p_user_id);
  v_level := public.pet_level_for(v_earned);

  perform set_config('pet.allow_grant', '1', true);
  update public.pet_state set granted_xp = 0, level = v_level
  where pet_state.user_id = p_user_id;
  perform set_config('pet.allow_grant', '0', true);

  return query select p_user_id, v_level, v_earned;
end;
$$;

revoke all on function public.admin_reset_pet_adjustment(text) from public, anon;
grant execute on function public.admin_reset_pet_adjustment(text) to authenticated;

-- ── Un-adopt: send the student back to the adoption prompt ──
-- Earned XP and the ledger SURVIVE on purpose. XP lives on the account, not
-- the animal (switching pets has always been free), and wiping the ledger
-- would make every past event payable again — the student would simply
-- re-earn it on the next sync, so the reset would not even stick.
create or replace function public.admin_reset_pet(p_user_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_key text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select ps.pet_key into v_old_key from public.pet_state ps
  where ps.user_id = p_user_id for update;
  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;

  perform set_config('pet.allow_grant', '1', true);
  update public.pet_state set
    pet_key = null,
    name = null,
    adopted_at = null,
    granted_xp = 0,
    cosmetics = '{"accessory": true}'::jsonb,
    level = public.pet_level_for(public.pet_earned_xp(p_user_id))
  where user_id = p_user_id;
  perform set_config('pet.allow_grant', '0', true);

  return v_old_key;
end;
$$;

revoke all on function public.admin_reset_pet(text) from public, anon;
grant execute on function public.admin_reset_pet(text) to authenticated;

-- ── Grant a specific companion without levelling ────────────
create or replace function public.admin_grant_pet_unlock(p_user_id text, p_pet_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_pet_key is null or btrim(p_pet_key) = '' then
    raise exception 'A companion is required' using errcode = '22023';
  end if;

  select ps.unlocked into v_unlocked from public.pet_state ps
  where ps.user_id = p_user_id for update;
  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;

  -- Idempotent: granting the same key twice must not duplicate it.
  if not (coalesce(v_unlocked, '[]'::jsonb) @> to_jsonb(p_pet_key)) then
    v_unlocked := coalesce(v_unlocked, '[]'::jsonb) || to_jsonb(p_pet_key);
    update public.pet_state set unlocked = v_unlocked where user_id = p_user_id;
  end if;

  return v_unlocked;
end;
$$;

revoke all on function public.admin_grant_pet_unlock(text, text) from public, anon;
grant execute on function public.admin_grant_pet_unlock(text, text) to authenticated;

-- ── Reset today's care budget ───────────────────────────────
create or replace function public.admin_reset_pet_care(p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.pet_state
  set care = '{"day": null, "used": 0}'::jsonb
  where user_id = p_user_id;

  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_reset_pet_care(text) from public, anon;
grant execute on function public.admin_reset_pet_care(text) to authenticated;

-- ── Per-student kill switch ─────────────────────────────────
create or replace function public.admin_set_pet_companion(p_user_id text, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'A value is required' using errcode = '22023';
  end if;

  perform 1 from public.pet_state ps where ps.user_id = p_user_id for update;
  if not found then
    raise exception 'No companion found for this student' using errcode = 'P0002';
  end if;

  perform set_config('pet.allow_grant', '1', true);
  update public.pet_state set companion_enabled = p_enabled where user_id = p_user_id;
  perform set_config('pet.allow_grant', '0', true);

  return p_enabled;
end;
$$;

revoke all on function public.admin_set_pet_companion(text, boolean) from public, anon;
grant execute on function public.admin_set_pet_companion(text, boolean) to authenticated;
