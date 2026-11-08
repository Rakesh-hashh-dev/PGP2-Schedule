begin;
alter table public.notifications add column push_checked_at timestamptz;
alter table public.notifications add column push_attempted_devices integer;
alter table public.notifications add column push_accepted_devices integer;
create function public.admin_guard_notification_evidence() returns trigger language plpgsql as $$
begin
  if current_user in ('anon','authenticated') and
    ((tg_op='INSERT' and (new.push_checked_at is not null or new.push_delivery_state is not null or new.delivered_push_at is not null or new.push_attempted_devices is not null or new.push_accepted_devices is not null))
      or (tg_op='UPDATE' and (new.push_checked_at,new.push_delivery_state,new.delivered_push_at,new.push_attempted_devices,new.push_accepted_devices) is distinct from (old.push_checked_at,old.push_delivery_state,old.delivered_push_at,old.push_attempted_devices,old.push_accepted_devices))) then
    raise exception 'Push delivery evidence is maintained by the dispatcher' using errcode='42501';
  end if; return new;
end $$;
create trigger protect_push_evidence before insert or update on public.notifications for each row execute function public.admin_guard_notification_evidence();
create table public.admin_notification_events(
  id bigint generated always as identity primary key, notification_id uuid not null,
  user_id text not null, type text not null, title text, notification_created_at timestamptz not null,
  state text, checked_at timestamptz not null default now(), attempted_devices integer,accepted_devices integer
);
alter table public.admin_notification_events enable row level security;
revoke all on public.admin_notification_events from public,anon,authenticated;
grant delete on public.admin_notification_events to service_role;
create index admin_notification_events_latest on public.admin_notification_events(notification_id,id desc);
create index admin_notification_events_retention on public.admin_notification_events(checked_at);
create function public.admin_capture_notification_check() returns trigger language plpgsql security definer set search_path=public as $$
declare previous public.admin_notification_events; current_state text;
begin
  current_state:=case when new.delivered_push_at is not null then 'delivered' when tg_op='INSERT' then case when new.scheduled_for>now() then 'scheduled' else 'queued' end else new.push_delivery_state end;
  select * into previous from public.admin_notification_events where notification_id=new.id order by id desc limit 1;
  -- Do not create a row every minute for an unchanged no-send condition.
  if tg_op='UPDATE' and coalesce(new.push_attempted_devices,0)=0 and previous.state is not distinct from current_state and previous.attempted_devices=0 then return new; end if;
  insert into public.admin_notification_events(notification_id,user_id,type,title,notification_created_at,state,checked_at,attempted_devices,accepted_devices)
    values(new.id,new.user_id,new.type,new.title,new.created_at,
      current_state,
      coalesce(new.push_checked_at,new.created_at),new.push_attempted_devices,new.push_accepted_devices);
  delete from public.admin_notification_events where notification_id=new.id and id<(select id from public.admin_notification_events where notification_id=new.id order by id desc offset 19 limit 1);
  return new;
end $$;
create trigger capture_notification_check after insert or update of push_checked_at on public.notifications
for each row execute function public.admin_capture_notification_check();
create function public.admin_record_push_diagnostics(p_results jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)>2000 then raise exception 'Invalid diagnostics batch' using errcode='22023'; end if;
  if exists(select 1 from jsonb_to_recordset(p_results) r(id uuid,attempted integer,accepted integer) where attempted is null or accepted is null or attempted<0 or accepted<0 or accepted>attempted) then raise exception 'Invalid device counts' using errcode='22023'; end if;
  update public.notifications n set push_checked_at=clock_timestamp(),push_attempted_devices=r.attempted,push_accepted_devices=r.accepted
    from jsonb_to_recordset(p_results) r(id uuid,attempted integer,accepted integer) where n.id=r.id;
  delete from public.admin_notification_events where checked_at<now()-interval '90 days';
end $$;
revoke all on function public.admin_record_push_diagnostics(jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_push_diagnostics(jsonb) to service_role;

create function public.admin_notification_diagnostics(p_from timestamptz default now()-interval '7 days',p_to timestamptz default now(),p_type text default null,p_user text default null,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare output jsonb;
begin
  if not public.admin_has_capability('diagnostics.read') then raise exception 'Diagnostics access required' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '90 days' then raise exception 'Choose a date range of at most 90 days' using errcode='22023'; end if;
  with latest as (select distinct on(notification_id) * from public.admin_notification_events order by notification_id,id desc),
  evidence as (
    select n.id,n.user_id,n.type,n.title,n.created_at,coalesce(n.push_delivery_state,e.state,'pending_or_unknown') state,n.delivered_push_at is not null provider_accepted,
      n.push_checked_at,n.push_attempted_devices,n.push_accepted_devices from public.notifications n left join latest e on e.notification_id=n.id
    union all select e.notification_id,e.user_id,e.type,e.title,e.notification_created_at,coalesce(e.state,'unknown'),e.state='delivered',e.checked_at,e.attempted_devices,e.accepted_devices
      from latest e where not exists(select 1 from public.notifications n where n.id=e.notification_id)
  ), filtered as (select * from evidence where created_at>=greatest(p_from,now()-interval '90 days') and created_at<p_to and (p_type is null or type=p_type) and (p_user is null or user_id=p_user)),
  page as (select * from filtered where p_before is null or (created_at,id)<(p_before,p_before_id) order by created_at desc,id desc limit 51)
  select jsonb_build_object('dispatch_enabled',not coalesce((select flags->'dispatchEnabled'='false'::jsonb from public.system_config where id='global'),false),'total',(select count(*) from filtered),'students',(select count(distinct user_id) from filtered),
    'accepted',(select count(*) from filtered where provider_accepted),'has_more',(select count(*)>50 from page),
    'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]') from (select p.*,
      (select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]') from (select id,state,checked_at,attempted_devices,accepted_devices from public.admin_notification_events e where e.notification_id=p.id order by id desc limit 20) h) history
      from page p order by p.created_at desc,p.id desc limit 50) r)) into output;
  if p_user is not null then insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','notification_lookup',jsonb_build_object('user_id',p_user,'from',p_from,'to',p_to)); end if;
  return output;
end $$;
revoke all on function public.admin_notification_diagnostics(timestamptz,timestamptz,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.admin_notification_diagnostics(timestamptz,timestamptz,text,text,timestamptz,uuid) to authenticated;
commit;
