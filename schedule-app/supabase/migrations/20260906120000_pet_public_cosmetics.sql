-- Friends can see what a pet is wearing.
--
-- `get_friend_pets` has projected key/name/level since the pet shipped, which
-- was right when the wardrobe was eleven hats nobody else could see. It is now
-- thirty pieces across three slots plus titles, and a cosmetic nobody else ever
-- sees is a cosmetic that may as well not exist.
--
-- What is added: hat, neck, coat, title. What is NOT added, and deliberately:
--
--   * XP, the ledger, streaks, lastSeen, adoptedAt — the same things the
--     original function withheld. A friends list is not a leaderboard and this
--     app does not rank students against each other.
--   * the buddy companion — it is a second animal to draw, and the friends
--     list already renders dozens of these at once.
--
-- The values come out of the `cosmetics` jsonb the owner writes. The client
-- re-validates every one of them through `visibleHat` / `visibleCoat` /
-- `visibleNeckwear` / `visibleTitle` before drawing (see `publicSummary` in
-- lib/pet.js), so a hand-edited row cannot show a friend a crown its owner
-- never earned. This function does not attempt that check itself: it has no
-- view of the ledger's XP, and duplicating the level maths in SQL would be a
-- second source of truth that could only ever drift from the first.
--
-- Adding columns to a `returns table` needs the function dropped first —
-- `create or replace` cannot change the signature.

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
  title text
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
    -- ->> yields NULL for a missing key and for a JSON null alike, which is
    -- exactly the "wearing nothing" the client expects. Rows written before
    -- these slots existed therefore need no backfill.
    p.cosmetics->>'hat'   as hat,
    p.cosmetics->>'neck'  as neck,
    p.cosmetics->>'coat'  as coat,
    p.cosmetics->>'title' as title
  from pet_state p
  where auth.jwt()->>'sub' is not null
    and p.user_id = any(p_ids)
    and p.pet_key is not null
  limit 200;
$$;

revoke all on function public.get_friend_pets(text[]) from public, anon;
grant execute on function public.get_friend_pets(text[]) to authenticated;
