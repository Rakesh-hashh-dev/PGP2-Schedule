-- ============================================================
-- Pet companion — durable per-user state
-- Run in: Supabase Dashboard → SQL Editor (apply the file directly;
-- `db push` is not safe on this project).
-- Additive only; nothing else reads or writes this table.
--
-- Design notes (full rationale in docs/pet-companion-plan.md §4):
--
--   * There is deliberately NO `xp` column. Total XP is DERIVED as
--     base_xp + sum(awarded), so two devices that both earned XP offline
--     merge by unioning the ledger and recomputing. Last-write-wins on an
--     xp integer would silently discard a day's earnings from whichever
--     device wrote first, and neither copy would know.
--
--   * `awarded` is the idempotency ledger: { eventKey: [day, xp] }, keyed by a
--     stable id for the real-world event (a marked class, a cleared deadline).
--     Re-syncing or re-rendering replays the same key and pays nothing twice.
--     The client prunes it to a rolling 30 days, folding dropped XP into
--     base_xp, so retention never costs progress.
--
--   * `level` IS denormalized — it is the one field friends need and the only
--     one they may read (see get_friend_pets). The client recomputes and
--     rewrites it on every save, so any drift self-heals on the next write.
--     Private truth stays in base_xp + awarded; this column is a projection.
-- ============================================================

create table if not exists public.pet_state (
  user_id    text primary key,                       -- Clerk subject
  pet_key    text,                                   -- null ⇒ not adopted yet
  name       text check (name is null or char_length(name) <= 24),
  level      int  not null default 1 check (level between 1 and 12),
  base_xp    int  not null default 0 check (base_xp >= 0),
  -- Admin-granted XP. Deliberately a SEPARATE column from base_xp: the client
  -- owns base_xp (it grows by pruning) and rewrites it on every save, so an
  -- admin grant written there would be clobbered by the next save from a
  -- student who already had the app open. Nothing client-side ever writes this
  -- column; the trigger below enforces that.
  granted_xp int  not null default 0 check (granted_xp >= 0),
  adopted_at date,
  -- Ledger + counters. Size-guarded: a 30-day ledger is a few KB, so anything
  -- approaching 64KB is a bug or an abusive client, not a busy term.
  awarded    jsonb not null default '{}'::jsonb  check (pg_column_size(awarded) < 65536),
  care       jsonb not null default '{"day": null, "used": 0}'::jsonb,
  last_seen  bigint not null default 0 check (last_seen >= 0),
  unlocked   jsonb not null default '[]'::jsonb,
  cosmetics  jsonb not null default '{"accessory": true}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Additive for any environment where pet_state was created before granted_xp
-- existed (the local Docker stack, mainly) — `create table if not exists`
-- above is a no-op there and would otherwise leave the column missing.
alter table public.pet_state
  add column if not exists granted_xp int not null default 0;

do $$
begin
  alter table public.pet_state add constraint pet_state_granted_xp_check
    check (granted_xp >= 0);
exception when duplicate_object then null;
end;
$$;

-- Keep updated_at honest without trusting the client to send it, and keep
-- granted_xp out of the client's reach.
--
-- RLS gives a student full write access to their OWN row, which is correct for
-- every other column but wrong for an admin grant: an ordinary save sends the
-- whole row, so it would erase the grant, and a crafted request could mint
-- unlimited XP. Only admin_set_pet_level may move this column, and it opts in
-- through a transaction-local flag that a PostgREST client has no way to set.
create or replace function public.pet_state_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if coalesce(current_setting('pet.allow_grant', true), '') <> '1' then
    if tg_op = 'UPDATE' then
      new.granted_xp = old.granted_xp;
    else
      new.granted_xp = 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pet_state_touch on public.pet_state;
create trigger pet_state_touch
  before insert or update on public.pet_state
  for each row execute function public.pet_state_touch();

alter table public.pet_state enable row level security;

-- Self-only, all four verbs. Friends read through get_friend_pets() instead,
-- which is the only path that may see another student's row.
drop policy if exists pet_state_select on public.pet_state;
create policy pet_state_select on public.pet_state
  for select using (auth.jwt()->>'sub' = user_id);

drop policy if exists pet_state_insert on public.pet_state;
create policy pet_state_insert on public.pet_state
  for insert with check (auth.jwt()->>'sub' = user_id);

drop policy if exists pet_state_update on public.pet_state;
create policy pet_state_update on public.pet_state
  for update using (auth.jwt()->>'sub' = user_id)
          with check (auth.jwt()->>'sub' = user_id);

drop policy if exists pet_state_delete on public.pet_state;
create policy pet_state_delete on public.pet_state
  for delete using (auth.jwt()->>'sub' = user_id);

-- ── Friend visibility ───────────────────────────────────────
-- RLS is row-level, so "others may read SOME columns" needs a definer-side
-- projection rather than a policy. This function is the ONLY way another
-- student's pet is readable, and it returns exactly the public summary:
-- key, name, level. Never base_xp, never the ledger, never timestamps.
--
-- Matching the app's existing posture (see fetchFriendPresence over profiles),
-- friendship is not enforced server-side — any signed-in user may resolve ids
-- they already hold. The data exposed is cosmetic by construction.
create or replace function public.get_friend_pets(p_ids text[])
returns table (user_id text, pet_key text, name text, level int)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.pet_key, p.name, p.level
  from pet_state p
  where auth.jwt()->>'sub' is not null
    and p.user_id = any(p_ids)
    and p.pet_key is not null
  limit 200;
$$;

revoke all on function public.get_friend_pets(text[]) from public, anon;
grant execute on function public.get_friend_pets(text[]) to authenticated;

grant select, insert, update, delete on public.pet_state to authenticated;
