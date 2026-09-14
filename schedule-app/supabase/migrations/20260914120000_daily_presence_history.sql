-- Durable daily activity history for Admin Tools -> Weekly Presence.
--
-- profiles.last_seen_at is intentionally still maintained as the current
-- last-seen value. It cannot, by itself, answer historical daily-active-user
-- questions because every new heartbeat overwrites the previous date. This
-- table keeps one compact row per user per IST calendar day instead.

create table if not exists public.user_daily_activity (
  user_id text not null,
  activity_date date not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  heartbeat_count integer not null default 1 check (heartbeat_count > 0),
  hourly_heartbeats jsonb not null default '{}'::jsonb,
  primary key (user_id, activity_date)
);

create index if not exists user_daily_activity_date_idx
  on public.user_daily_activity (activity_date desc, last_seen_at desc);

comment on table public.user_daily_activity is
  'One row per authenticated user per Asia/Kolkata calendar day. Used for durable DAU history.';
comment on column public.user_daily_activity.hourly_heartbeats is
  'Object keyed by IST hour 00-23. Values are heartbeat counts for that user in that hour.';

alter table public.user_daily_activity enable row level security;

-- Clients never read or write this table directly. The self-scoped recorder
-- and admin-only report below are the only authenticated entry points.
revoke all on table public.user_daily_activity from public, anon, authenticated;

create or replace function public.record_presence_heartbeat()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.jwt()->>'sub';
  v_seen_at timestamptz := clock_timestamp();
  v_local timestamp := timezone('Asia/Kolkata', v_seen_at);
  v_activity_date date;
  v_hour text;
begin
  if v_user_id is null or v_user_id = '' then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  v_activity_date := v_local::date;
  v_hour := to_char(v_local, 'HH24');

  insert into public.user_daily_activity (
    user_id, activity_date, first_seen_at, last_seen_at,
    heartbeat_count, hourly_heartbeats
  ) values (
    v_user_id, v_activity_date, v_seen_at, v_seen_at,
    1, jsonb_build_object(v_hour, 1)
  )
  on conflict (user_id, activity_date) do update set
    last_seen_at = greatest(user_daily_activity.last_seen_at, excluded.last_seen_at),
    heartbeat_count = user_daily_activity.heartbeat_count + 1,
    hourly_heartbeats = jsonb_set(
      coalesce(user_daily_activity.hourly_heartbeats, '{}'::jsonb),
      array[v_hour],
      to_jsonb(coalesce((user_daily_activity.hourly_heartbeats ->> v_hour)::integer, 0) + 1),
      true
    );

  -- Keep the existing user-directory and User X-Ray last-seen surfaces current.
  update public.profiles
     set last_seen_at = greatest(coalesce(last_seen_at, '-infinity'::timestamptz), v_seen_at)
   where user_id = v_user_id;

  return jsonb_build_object(
    'activity_date', v_activity_date,
    'seen_at', v_seen_at
  );
end;
$$;

revoke all on function public.record_presence_heartbeat() from public, anon;
grant execute on function public.record_presence_heartbeat() to authenticated;

create or replace function public.admin_get_presence_history(p_days integer default 30)
returns table (
  user_id text,
  activity_date date,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  heartbeat_count integer,
  hourly_heartbeats jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 90));
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select
      d.user_id,
      d.activity_date,
      d.first_seen_at,
      d.last_seen_at,
      d.heartbeat_count,
      d.hourly_heartbeats
    from public.user_daily_activity d
    where d.activity_date >= (timezone('Asia/Kolkata', now())::date - (v_days - 1))
    order by d.activity_date desc, d.last_seen_at desc;
end;
$$;

revoke all on function public.admin_get_presence_history(integer) from public, anon;
grant execute on function public.admin_get_presence_history(integer) to authenticated;

-- Preserve the only historical point available before this migration. This
-- cannot reconstruct older days that profiles.last_seen_at has overwritten,
-- but it prevents the current latest heartbeat from being discarded.
insert into public.user_daily_activity (
  user_id, activity_date, first_seen_at, last_seen_at,
  heartbeat_count, hourly_heartbeats
)
select
  p.user_id,
  (p.last_seen_at at time zone 'Asia/Kolkata')::date,
  p.last_seen_at,
  p.last_seen_at,
  1,
  jsonb_build_object(to_char(p.last_seen_at at time zone 'Asia/Kolkata', 'HH24'), 1)
from public.profiles p
where p.last_seen_at is not null
on conflict (user_id, activity_date) do nothing;
