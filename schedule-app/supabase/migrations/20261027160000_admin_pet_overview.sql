-- ============================================================
-- admin_pet_overview() — cohort snapshot for Admin › Companion.
-- Read-only, counts only (no names, no user ids). pet_state RLS limits a
-- caller to their own row, so this is SECURITY DEFINER and gated on
-- is_admin() — monitors included, the same as admin_get_pet_state.
-- ============================================================

create or replace function public.admin_pet_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  with adopted as (
    select * from pet_state where pet_key is not null
  )
  select jsonb_build_object(
    'rows',        (select count(*) from pet_state),
    'adopted',     (select count(*) from adopted),
    -- last_seen is epoch milliseconds (bigint), written by the client.
    'active7d',    (select count(*) from adopted where last_seen >= (extract(epoch from now() - interval '7 days') * 1000)::bigint),
    'adjusted',    (select count(*) from adopted where granted_xp > 0),
    'avgLevel',    (select round(avg(level)::numeric, 1) from adopted),
    'maxLevel',    (select max(level) from adopted),
    'levels',      coalesce((select jsonb_object_agg(level, n) from (select level, count(*) n from adopted group by level) l), '{}'::jsonb),
    'pets',        coalesce((select jsonb_object_agg(pet_key, n) from (select pet_key, count(*) n from adopted group by pet_key) p), '{}'::jsonb),
    'generatedAt', now()
  ) into v;
  return v;
end;
$$;

revoke all on function public.admin_pet_overview() from public, anon;
grant execute on function public.admin_pet_overview() to authenticated;
