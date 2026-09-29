-- Persist a coarse delivery state for each inbox row. Existing rows remain
-- unknown; a null state must never be interpreted as a particular failure.
alter table public.notifications
  add column if not exists push_delivery_state text;

alter table public.notifications
  add constraint notifications_push_delivery_state_check
  check (push_delivery_state is null or push_delivery_state in (
    'delivered', 'no_subscription', 'preference_off', 'quiet_hours',
    'expired', 'endpoint_rejected', 'provider_error'
  ));

create or replace function public.get_push_delivery_diagnostics()
returns table (
  dedup_key text,
  total bigint,
  delivered bigint,
  no_subscription bigint,
  preference_off bigint,
  quiet_hours bigint,
  expired bigint,
  endpoint_rejected bigint,
  provider_error bigint,
  pending_or_unknown bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select n.dedup_key, n.delivered_push_at, n.push_delivery_state
    from public.notifications n
    where public.is_admin()
      and n.type = 'admin_broadcast'
      and n.dedup_key in (
        select recent_key.dedup_key
        from public.notifications recent_key
        where recent_key.type = 'admin_broadcast'
        group by recent_key.dedup_key
        order by min(recent_key.created_at) desc
        limit 25
      )
  )
  select
    r.dedup_key,
    count(*)::bigint,
    count(*) filter (where r.delivered_push_at is not null)::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'no_subscription')::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'preference_off')::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'quiet_hours')::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'expired')::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'endpoint_rejected')::bigint,
    count(*) filter (where r.delivered_push_at is null and r.push_delivery_state = 'provider_error')::bigint,
    count(*) filter (where r.delivered_push_at is null and
      (r.push_delivery_state is null or r.push_delivery_state = 'delivered'))::bigint
  from recent r
  group by r.dedup_key;
$$;

revoke all on function public.get_push_delivery_diagnostics() from public, anon;
grant execute on function public.get_push_delivery_diagnostics() to authenticated;
