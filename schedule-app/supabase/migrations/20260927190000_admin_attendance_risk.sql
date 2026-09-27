-- Cohort-only attendance watch for Admin Tools. No student attendance rows
-- or identifiers leave this function.
create or replace function public.admin_attendance_risk()
returns table(code text, section text, recorded_users bigint, at_risk bigint)
language sql
stable
security definer
set search_path = public
as $$
  with per_student as (
    select
      a.user_id,
      split_part(a.session_key, '_', 3) as code,
      split_part(a.session_key, '_', 4) as section,
      count(*) filter (where a.status = 'present') as present,
      count(*) filter (where a.status = 'absent') as absent
    from public.attendance a
    where public.is_admin()
      and a.user_id not in (
        select m.dev_user_id from public._migration_map m
        where m.dev_user_id is not null
      )
      and split_part(a.session_key, '_', 3) <> ''
    group by a.user_id, split_part(a.session_key, '_', 3), split_part(a.session_key, '_', 4)
  )
  select
    p.code,
    p.section,
    count(*)::bigint as recorded_users,
    count(*) filter (where p.present::numeric / nullif(p.present + p.absent, 0) < 0.8)::bigint as at_risk
  from per_student p
  where p.present + p.absent >= 3
  group by p.code, p.section
  having count(*) filter (where p.present::numeric / nullif(p.present + p.absent, 0) < 0.8) > 0
  order by at_risk desc, recorded_users desc, p.code
  limit 50;
$$;

revoke all on function public.admin_attendance_risk() from public, anon;
grant execute on function public.admin_attendance_risk() to authenticated;
