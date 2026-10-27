-- ============================================================
-- Pet admin RPCs: gate writes on can_write_config(), not is_admin().
--
-- The 2026-09-06 roles migration made `monitor` a read-only admin and
-- enforced it on system_config + the draft stores. The pet admin RPCs
-- (2026-09-04, later redefined by the XP repair / level-cap migrations)
-- predate roles and only check is_admin(), which is TRUE for monitors —
-- so a monitor could reset, level or unlock any student's pet.
--
-- These functions have been redefined across several migrations, so
-- rather than restate their bodies (and risk reverting a later fix),
-- this rewrites whatever definition is live: it reads each function with
-- pg_get_functiondef and swaps the guard in place. Re-running is a no-op
-- once the guard is already swapped.
--
-- admin_get_pet_state is read-only and deliberately keeps is_admin(), so
-- monitors can still inspect pets.
-- ============================================================

do $$
declare
  r record;
  v_def text;
  v_new text;
  v_fixed int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_set_pet_level',
        'admin_set_pet_level_exact',
        'admin_adjust_pet_xp',
        'admin_bulk_adjust_pet_xp',
        'admin_bulk_set_pet_level',
        'admin_bulk_reset_pet_adjustments',
        'admin_reset_pet_adjustment',
        'admin_clear_pet_name',
        'admin_reset_pet_care',
        'admin_set_pet_companion',
        'admin_grant_pet_unlock',
        'admin_reset_pet'
      )
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def, 'public.is_admin()', 'public.can_write_config()');
    if v_new <> v_def then
      execute v_new;
      v_fixed := v_fixed + 1;
    end if;
  end loop;

  raise notice 'pet admin write gate: % function(s) switched to can_write_config()', v_fixed;
end;
$$;
