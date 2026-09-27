-- One row per user, feature, and IST day. Students can write only their own
-- daily signal. Admin Tools reads aggregate counts through the RPC below.
create table if not exists public.feature_usage_days (
  user_id text not null,
  feature text not null check (feature in ('attendance_mark', 'calendar_export', 'announcements_view')),
  activity_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  primary key (user_id, feature, activity_date)
);

create index if not exists feature_usage_days_recent_idx
  on public.feature_usage_days (activity_date desc, feature);

alter table public.feature_usage_days enable row level security;

create policy "Students read own usage days" on public.feature_usage_days
  for select to authenticated using (user_id = auth.jwt()->>'sub');
create policy "Students insert own current usage day" on public.feature_usage_days
  for insert to authenticated
  with check (user_id = auth.jwt()->>'sub' and activity_date = (now() at time zone 'Asia/Kolkata')::date);
create policy "Students update own current usage day" on public.feature_usage_days
  for update to authenticated
  using (user_id = auth.jwt()->>'sub')
  with check (user_id = auth.jwt()->>'sub' and activity_date = (now() at time zone 'Asia/Kolkata')::date);

grant select, insert, update on public.feature_usage_days to authenticated;

create or replace function public.admin_feature_usage_trend()
returns table(activity_date date, feature text, users bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.activity_date, f.feature, count(*)::bigint as users
  from public.feature_usage_days f
  where public.is_admin()
    and f.activity_date >= (now() at time zone 'Asia/Kolkata')::date - 27
    and f.user_id not in (
      select m.dev_user_id from public._migration_map m
      where m.dev_user_id is not null
    )
  group by f.activity_date, f.feature
  order by f.activity_date, f.feature;
$$;

revoke all on function public.admin_feature_usage_trend() from public, anon;
grant execute on function public.admin_feature_usage_trend() to authenticated;
