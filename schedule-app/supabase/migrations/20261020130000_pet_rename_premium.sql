-- ============================================================
-- Rename the retired premium pet keys.
--
-- Tide (Lv 16), Sol (Lv 18) and Eclipse (Lv 20) were replaced by the Griffin,
-- Unicorn and Dragon on 2026-10-20. Students keep the slot under the new key:
--   tide -> griffin, sol -> unicorn, eclipse -> dragon
-- in pet_key, in the unlocked list and in cosmetics.buddy.
--
-- The client maps the old keys too (RENAMED_PETS in lib/pet.js), so this is
-- order-independent with the frontend: it only stops friends' screens and the
-- admin panel from ever seeing an old key again. Re-running is a no-op.
--
-- Goes through the pet_state_touch trigger like any write: granted_xp,
-- legacy_xp and companion_enabled stay pinned, the ledger is untouched, and
-- level is recomputed from the same XP (so it does not move).
-- ============================================================

begin;

create temporary table pet_rename (old_key text primary key, new_key text not null) on commit drop;
insert into pet_rename values ('tide', 'griffin'), ('sol', 'unicorn'), ('eclipse', 'dragon');

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
