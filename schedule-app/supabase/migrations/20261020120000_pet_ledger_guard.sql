-- ============================================================
-- Pet ledger guard + verifiable friend cosmetics.
--
-- NOT applied yet. Requires 20261013110000_pet_xp_repair.sql and
-- 20261013120000_pet_level_cap_20.sql (both live since 2026-10-13).
--
-- The problem: XP is derived from the `awarded` ledger, and the server took
-- whatever ledger a client sent. pet_state_merge is SECURITY INVOKER and the
-- owner may UPDATE their own row, so one devtools call could write
-- {"att:x": ["2026-10-20", 999999]}; the server then derived Lv 20 from it,
-- published that level to friends, and every unlock followed.
--
-- The fix lives in the pet_state_touch trigger, so it covers BOTH write paths
-- (the merge RPC and a bare upsert/update), and only on the non-admin path
-- (pet.allow_grant <> '1'; no admin RPC writes `awarded`):
--
--   1. The ledger is append-only. Existing keys keep the value already stored
--      (the merge's `old || new` let a client re-price a key), and keys cannot
--      be removed.
--   2. A NEW key is accepted only if it is a shape the app actually produces,
--      with an amount inside what the app can actually pay:
--        att:<yyyy-mm-dd>...      <= 96   (32 x the 3x admin rate cap)
--        due:<task id>            <= 180  (60 x 3)
--        stk:<yyyy-mm-dd>         <= 30   (10 x 3)
--        care:<yyyy-mm-dd>:<1-3>  <= 14   (3 x 3, x1.5 streak bonus, rounded)
--      plus [day, amount] where day is a real date no later than tomorrow
--      (timezone slack) and amount a positive integer. At most 12 attendance
--      keys per class date and 20 deadline keys per award day.
--      Anything else is dropped silently: the write still lands, the entry
--      does not. KEEP IN SYNC with XP / XP_RATE_MAX / keyFor in lib/pet.js.
--   3. `level` is recomputed from the guarded ledger + granted_xp, so a direct
--      UPDATE can no longer write a level either.
--
-- get_friend_pets additionally returns the owner's unlock standing
-- (unlock_level, unlock_tier — the same maths as unlockStanding() in
-- lib/pet.js, legacy floor included), and the client re-checks the raw
-- cosmetics against it (friendCosmetics), so a hand-edited cosmetics column
-- can no longer show friends a crown that was never earned.
--
-- Rows already in prod are not rewritten: rule 1 means old entries stand.
-- To look for anything suspicious before/after, run:
--   select user_id, k, v from public.pet_state, jsonb_each(awarded) as e(k, v)
--   where k !~ '^(att|due|stk|care):' or (v->>1)::numeric > 180;
-- ============================================================

begin;

-- ── Ledger guard ────────────────────────────────────────────
create or replace function public.pet_guard_ledger(p_old jsonb, p_new jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_old jsonb := coalesce(p_old, '{}'::jsonb);
  v_out jsonb := '{}'::jsonb;
  v_att_per_day jsonb := '{}'::jsonb;  -- class date -> count
  v_due_per_day jsonb := '{}'::jsonb;  -- award day  -> count
  r record;
  v_day date;
  v_amt numeric;
  v_cap int;
  v_bucket text;
  v_n int;
begin
  if jsonb_typeof(coalesce(p_new, '{}'::jsonb)) <> 'object' then
    return v_old;
  end if;

  -- Seed the per-day counters from what is already stored.
  for r in select key, value from jsonb_each(v_old) loop
    if r.key ~ '^att:\d{4}-\d{2}-\d{2}' then
      v_bucket := substr(r.key, 5, 10);
      v_att_per_day := v_att_per_day || jsonb_build_object(v_bucket, coalesce((v_att_per_day ->> v_bucket)::int, 0) + 1);
    elsif r.key like 'due:%' then
      v_bucket := coalesce(r.value ->> 0, '');
      v_due_per_day := v_due_per_day || jsonb_build_object(v_bucket, coalesce((v_due_per_day ->> v_bucket)::int, 0) + 1);
    end if;
  end loop;

  for r in select key, value from jsonb_each(p_new) order by key loop
    continue when v_old ? r.key;  -- append-only: the stored value stands

    -- Shape: [ "yyyy-mm-dd", positive integer ]
    continue when jsonb_typeof(r.value) <> 'array' or jsonb_array_length(r.value) <> 2;
    continue when jsonb_typeof(r.value -> 0) <> 'string' or jsonb_typeof(r.value -> 1) <> 'number';
    continue when (r.value ->> 0) !~ '^\d{4}-\d{2}-\d{2}$';
    begin
      v_day := (r.value ->> 0)::date;
    exception when others then
      continue;  -- e.g. 2026-13-45
    end;
    continue when v_day > current_date + 1;
    v_amt := (r.value ->> 1)::numeric;
    continue when v_amt <= 0 or v_amt <> trunc(v_amt);

    v_cap := case
      when r.key ~ '^att:\d{4}-\d{2}-\d{2}' then 96
      when r.key ~ '^due:.{1,200}$' then 180
      when r.key ~ '^stk:\d{4}-\d{2}-\d{2}$' then 30
      when r.key ~ '^care:\d{4}-\d{2}-\d{2}:[1-3]$' then 14
      else 0
    end;
    continue when v_amt > v_cap;

    if r.key like 'att:%' then
      v_bucket := substr(r.key, 5, 10);
      v_n := coalesce((v_att_per_day ->> v_bucket)::int, 0);
      continue when v_n >= 12;
      v_att_per_day := v_att_per_day || jsonb_build_object(v_bucket, v_n + 1);
    elsif r.key like 'due:%' then
      v_bucket := r.value ->> 0;
      v_n := coalesce((v_due_per_day ->> v_bucket)::int, 0);
      continue when v_n >= 20;
      v_due_per_day := v_due_per_day || jsonb_build_object(v_bucket, v_n + 1);
    end if;

    v_out := v_out || jsonb_build_object(r.key, jsonb_build_array(r.value ->> 0, v_amt::int));
  end loop;

  return v_old || v_out;
end;
$$;

-- The trigger is not SECURITY DEFINER, so it runs as the writing student:
-- authenticated must be able to execute this (it is a pure function).
revoke all on function public.pet_guard_ledger(jsonb, jsonb) from public, anon;
grant execute on function public.pet_guard_ledger(jsonb, jsonb) to authenticated;

-- Latest definition (20261013110000_pet_xp_repair.sql) plus the guard and the
-- level recompute. Everything else is unchanged.
create or replace function public.pet_state_touch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ledger_xp int;
begin
  new.updated_at = now();
  if coalesce(current_setting('pet.allow_grant', true), '') <> '1' then
    if tg_op = 'UPDATE' then
      new.granted_xp = old.granted_xp;
      new.companion_enabled = old.companion_enabled;
      new.legacy_xp = old.legacy_xp;
      new.awarded = public.pet_guard_ledger(old.awarded, new.awarded);
    else
      new.granted_xp = 0;
      new.companion_enabled = true;
      new.legacy_xp = 0;
      new.awarded = public.pet_guard_ledger('{}'::jsonb, new.awarded);
    end if;
    new.base_xp = 0;

    select coalesce(sum(greatest(0, (e.value ->> 1)::int)), 0) into v_ledger_xp
    from jsonb_each(coalesce(new.awarded, '{}'::jsonb)) as e;
    new.level = public.pet_level_for(greatest(0, coalesce(new.granted_xp, 0) + v_ledger_xp));
  end if;
  return new;
end;
$$;

-- ── Friend projection with unlock standing ──────────────────
drop function if exists public.get_friend_pets(text[]);

create or replace function public.get_friend_pets(p_ids text[])
returns table (
  user_id text,
  pet_key text,
  name text,
  level int,
  hat text,
  neck text,
  coat text,
  title text,
  unlock_level int,
  unlock_tier int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.pet_key,
    p.name,
    p.level,
    p.cosmetics->>'hat'   as hat,
    p.cosmetics->>'neck'  as neck,
    p.cosmetics->>'coat'  as coat,
    p.cosmetics->>'title' as title,
    -- unlockStanding() in lib/pet.js: real level/tier, raised by the legacy
    -- floor (level floor capped at 12). Devotion: base 3,850, step 270, max 10.
    case when p.legacy_xp > x.xp
      then greatest(public.pet_level_for(x.xp), least(12, public.pet_level_for(p.legacy_xp)))
      else public.pet_level_for(x.xp) end as unlock_level,
    least(10, greatest(0, (greatest(x.xp, p.legacy_xp) - 3850) / 270)) as unlock_tier
  from pet_state p
  cross join lateral (
    select greatest(0, coalesce(p.granted_xp, 0)
      + coalesce((select sum(greatest(0, (e.value ->> 1)::int))
                  from jsonb_each(coalesce(p.awarded, '{}'::jsonb)) as e), 0))::int as xp
  ) x
  where auth.jwt()->>'sub' is not null
    and p.user_id = any(p_ids)
    and p.pet_key is not null
  limit 200;
$$;

revoke all on function public.get_friend_pets(text[]) from public, anon;
grant execute on function public.get_friend_pets(text[]) to authenticated;

commit;
