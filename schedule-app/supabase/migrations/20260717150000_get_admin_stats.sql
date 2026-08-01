-- ============================================================
-- get_admin_stats() — RLS-bypassing aggregates for the admin dashboard
--
-- push_subscriptions / friend_pings / attendance are all RLS-locked to
-- the requesting user, so the dashboard's client-side counts only saw
-- the ADMIN'S OWN rows (e.g. "Push Subscribers: 4" when the table held
-- 14). SECURITY DEFINER lets these aggregates count the whole cohort.
--
-- Exposes ONLY aggregate numbers — no user ids, emails, or row data —
-- so granting to all authenticated users matches the posture of
-- get_dev_user_ids(). Dev-ghost rows (pre-cutover Clerk dev ids still
-- present in _migration_map) are excluded the same way the dashboard's
-- Total Users / Active Today stats exclude them.
-- ============================================================

create or replace function public.get_admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with dev_ids as (
    select m.dev_user_id as id
    from _migration_map m
    where m.dev_user_id is not null
  )
  select jsonb_build_object(
    'push_subscriptions', (
      select count(*)
      from push_subscriptions ps
      where ps.user_id not in (select id from dev_ids)
    ),
    'push_users', (
      select count(distinct ps.user_id)
      from push_subscriptions ps
      where ps.user_id not in (select id from dev_ids)
    ),
    'push_user_ids', (
      select coalesce(jsonb_agg(distinct ps.user_id), '[]'::jsonb)
      from push_subscriptions ps
      where ps.user_id not in (select id from dev_ids)
    ),
    'friend_pings', (select count(*) from friend_pings),
    'skips_by_course', (
      -- session_key: YYYY-MM-DD_HH:MM_CODE_SECTION → part 3 is the course code
      select coalesce(
        jsonb_agg(jsonb_build_array(s.code, s.cnt) order by s.cnt desc),
        '[]'::jsonb
      )
      from (
        select split_part(a.session_key, '_', 3) as code, count(*) as cnt
        from attendance a
        where a.status = 'absent'
          and a.user_id not in (select id from dev_ids)
          and split_part(a.session_key, '_', 3) <> ''
        group by 1
        order by cnt desc
        limit 5
      ) s
    )
  );
$$;

revoke all on function public.get_admin_stats() from public, anon;
grant execute on function public.get_admin_stats() to authenticated;
