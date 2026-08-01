-- Admin Insights RPCs (SECURITY DEFINER) for the admin dashboard.
-- notifications and cron.* are not readable by normal clients (RLS / schema
-- perms), so these functions expose just the aggregates the Admin Tools page
-- needs: per-broadcast delivery/open funnel, and edge-function cron health.
-- Both are admin-gated at the app layer (the page only renders for admin
-- emails); keep them lightweight and read-only.

-- ── Push broadcast delivery analytics ────────────────────────────────────────
-- One row per admin broadcast (grouped by dedup_key), with sent/delivered/read
-- counts so admins can see how a push actually landed.
create or replace function get_push_broadcast_stats()
returns table (
  dedup_key   text,
  title       text,
  body        text,
  sent_at     timestamptz,
  total       bigint,
  delivered   bigint,
  opened      bigint
)
language sql
security definer
set search_path = public
as $$
  select
    n.dedup_key,
    max(n.title)                                             as title,
    max(n.body)                                              as body,
    min(n.created_at)                                        as sent_at,
    count(*)                                                 as total,
    count(*) filter (where n.delivered_push_at is not null)  as delivered,
    count(*) filter (where n.read_at is not null)            as opened
  from notifications n
  where n.type = 'admin_broadcast'
  group by n.dedup_key
  order by min(n.created_at) desc
  limit 25;
$$;

grant execute on function get_push_broadcast_stats() to authenticated;

-- ── Cron / edge-function health ──────────────────────────────────────────────
-- Last run per pg_cron job (dispatch, dispatch-scheduled-pushes, class-reminders,
-- etc.), including status and message, so ops can spot a stalled notifier.
-- Wrapped in exception handling: if pg_cron isn't present the function returns
-- no rows instead of erroring.
create or replace function get_cron_health()
returns table (
  jobname     text,
  schedule    text,
  active      boolean,
  last_run    timestamptz,
  status      text,
  message     text
)
language plpgsql
security definer
set search_path = public, cron
as $$
begin
  return query
    select
      j.jobname::text,
      j.schedule::text,
      j.active,
      d.start_time                as last_run,
      d.status::text,
      d.return_message::text      as message
    from cron.job j
    left join lateral (
      select r.start_time, r.status, r.return_message
      from cron.job_run_details r
      where r.jobid = j.jobid
      order by r.start_time desc
      limit 1
    ) d on true
    order by j.jobname;
exception when others then
  return; -- pg_cron unavailable or no permission — return empty set
end;
$$;

grant execute on function get_cron_health() to authenticated;
