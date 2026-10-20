-- ============================================================
-- Retire Nova (and the never-shipped Griffin).
--
-- 2026-10-20: Nova, the Devotion 2 companion, was removed from the roster.
-- Its owners move to Inky, which unlocks on the same tier, so everyone who
-- had Nova is guaranteed to own Inky (buddy slots keep working). The Griffin
-- held Lv 16 for an afternoon and never reached prod; its slot went to Sable,
-- and so does any stray key:
--   nova -> inky, griffin -> sable, tide -> sable
-- in pet_key, in the unlocked list and in cosmetics.buddy.
--
-- The client maps the same keys (RENAMED_PETS in lib/pet.js), so this is
-- order-independent with the frontend. Re-running is a no-op. Goes through the
-- pet_state_touch trigger like any write: server-owned columns stay pinned,
-- the ledger is untouched and level is recomputed from the same XP.
-- ============================================================

begin;

create temporary table pet_rename (old_key text primary key, new_key text not null) on commit drop;
insert into pet_rename values ('nova', 'inky'), ('griffin', 'sable'), ('tide', 'sable');

update public.pet_state p
set
  pet_key = coalesce((select r.new_key from pet_rename r where r.old_key = p.pet_key), p.pet_key),
  unlocked = (
    select coalesce(jsonb_agg(distinct coalesce(r.new_key, u.k)), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(p.unlocked, '[]'::jsonb)) as u(k)
    left join pet_rename r on r.old_key = u.k
  ),
  cosmetics = case
    when p.cosmetics ->> 'buddy' in (select old_key from pet_rename)
      then jsonb_set(p.cosmetics, '{buddy}',
                     to_jsonb((select r.new_key from pet_rename r where r.old_key = p.cosmetics ->> 'buddy')))
    else p.cosmetics
  end
where p.pet_key in (select old_key from pet_rename)
   or p.cosmetics ->> 'buddy' in (select old_key from pet_rename)
   or exists (select 1 from jsonb_array_elements_text(coalesce(p.unlocked, '[]'::jsonb)) as u(k)
              where u.k in (select old_key from pet_rename));

commit;
