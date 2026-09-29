-- Enrollment-based, cohort-only view of student-saved attendance marks.
-- A saved mark is not an official attendance record. No student identifiers leave this function.
create or replace function public.admin_attendance_coverage()
returns table(
  code text,
  section text,
  enrolled_students bigint,
  students_with_marks bigint,
  students_without_marks bigint,
  risk_eligible_students bigint,
  at_risk_students bigint,
  latest_marked_session text
)
language sql
stable
security definer
set search_path = public
as $$
  with enrollment as (
    select distinct
      p.user_id,
      case
        when c.key ~ '_[AB]$' then left(c.key, length(c.key) - 2)
        else c.key
      end as course_code,
      case
        when c.key ~ '_[AB]$' then right(c.key, 1)
        when c.value in ('A', 'B') then c.value
        else 'Single'
      end as course_section
    from public.profiles p
    cross join lateral jsonb_each_text(coalesce(p.courses::jsonb, '{}'::jsonb)) c
    where public.is_admin()
      and c.key !~ '^_'
      and (c.value in ('A', 'B', 'Single', 'All')
        or (c.key ~ '_[AB]$' and c.value in ('true', '1')))
      and not exists (
        select 1 from public._migration_map m where m.dev_user_id = p.user_id
      )
  ),
  per_student as (
    select
      e.course_code,
      e.course_section,
      e.user_id,
      count(a.session_key) as saved_marks,
      count(a.session_key) filter (where a.status = 'present') as present_marks,
      max(left(a.session_key, 10)) filter (
        where a.session_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}_'
      ) as latest_session
    from enrollment e
    left join public.attendance a
      on a.user_id = e.user_id
      and a.status in ('present', 'absent')
      and split_part(a.session_key, '_', 3) = e.course_code
      and (
        split_part(a.session_key, '_', 4) = e.course_section
        or split_part(a.session_key, '_', 4) in ('Single', 'All')
      )
    group by e.course_code, e.course_section, e.user_id
  )
  select
    s.course_code,
    s.course_section,
    count(*)::bigint,
    count(*) filter (where s.saved_marks > 0)::bigint,
    count(*) filter (where s.saved_marks = 0)::bigint,
    count(*) filter (where s.saved_marks >= 3)::bigint,
    count(*) filter (
      where s.saved_marks >= 3
        and s.present_marks::numeric / nullif(s.saved_marks, 0) < 0.8
    )::bigint,
    max(s.latest_session)
  from per_student s
  group by s.course_code, s.course_section
  order by count(*) filter (where s.saved_marks = 0) desc, s.course_code, s.course_section;
$$;

revoke all on function public.admin_attendance_coverage() from public, anon;
grant execute on function public.admin_attendance_coverage() to authenticated;
