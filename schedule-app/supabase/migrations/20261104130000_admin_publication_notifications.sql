begin;
create table public.admin_schedule_notice_previews(id uuid primary key default gen_random_uuid(),created_by text not null,payload jsonb not null,base_revision bigint not null,message text,targets jsonb not null,expires_at timestamptz not null default now()+interval '10 minutes');
create table public.admin_schedule_notice_coverage(id bigint generated always as identity primary key,revision bigint not null,user_id text not null,class_date text not null,override_key text not null,code text not null,section text,slot text,effective jsonb not null,created_at timestamptz not null default now(),unique(revision,user_id,class_date,override_key));
alter table public.admin_schedule_notice_previews enable row level security;
alter table public.admin_schedule_notice_coverage enable row level security;
revoke all on public.admin_schedule_notice_previews,public.admin_schedule_notice_coverage from public,anon,authenticated;
create index admin_notice_preview_expiry_idx on public.admin_schedule_notice_previews(expires_at);
create index admin_notice_coverage_date_idx on public.admin_schedule_notice_coverage(class_date,user_id);
create index admin_notice_coverage_retention_idx on public.admin_schedule_notice_coverage(created_at);
alter table public.admin_scheduled_publications add column notice_message text;
alter table public.admin_scheduled_publications add column notify_students boolean not null default false;
alter table public.admin_scheduled_publications add column estimated_recipients integer;
alter table public.admin_scheduled_publications add column actual_recipients integer;

create function admin_internal.effective_notice_class(p_source jsonb,p_day jsonb) returns jsonb language sql immutable as $$
  with identity as (select coalesce(nullif(p_source->>'code',''),p_source->>'name') ident),
  merged as (select p_source||coalesce(p_day->(ident||'_'||(p_source->>'section')),p_day->ident,'{}')
    ||coalesce(p_day->(ident||'_'||(p_source->>'section')||'@'||(p_source->>'start')),p_day->(ident||'@'||(p_source->>'start')),'{}') value from identity)
  select jsonb_build_object('code',value->>'code','date',value->>'date','section',value->>'section','start',value->>'start','end',value->>'end','room',value->>'room','type',value->>'type','name',value->>'name') from merged;
$$;
revoke all on function admin_internal.effective_notice_class(jsonb,jsonb) from public,anon,authenticated;

create function admin_internal.schedule_notice_targets(p_before jsonb,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare days text[]; date_key text; override_key text; old_map jsonb:=coalesce(p_before->'classOverrides','{}'); new_map jsonb:=coalesce(p_payload#>'{flags,classOverrides}','{}');
  old_value jsonb; new_value jsonb; source jsonb; effective jsonb; ident text; section_name text; slot_name text; course text;
  feed jsonb; fetched timestamptz; student record; targets jsonb:='[]'; source_count integer; today_ist text:=to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD');
begin
  select payload->'CLASSES',fetched_at into feed,fetched from public.schedule_cache where id='latest';
  if jsonb_typeof(feed) is distinct from 'array' or fetched is null or fetched<now()-interval '3 days' then raise exception 'Refresh the server schedule cache before previewing notifications' using errcode='22023'; end if;
  select array_agg(key order by key) into days from (select jsonb_object_keys(old_map) key union select jsonb_object_keys(new_map)) d;
  foreach date_key in array coalesce(days,array[]::text[]) loop
    if date_key<today_ist then continue; end if;
    for override_key in select key from (select jsonb_object_keys(coalesce(old_map->date_key,'{}')) key union select jsonb_object_keys(coalesce(new_map->date_key,'{}'))) k order by key loop
      old_value:=old_map->date_key->override_key; new_value:=new_map->date_key->override_key;
      if (old_value-array['modifiedAt','modifiedBy']) is not distinct from (new_value-array['modifiedAt','modifiedBy']) then continue; end if;
      slot_name:=substring(override_key from '@([0-9]{1,2}:[0-9]{2})$');
      ident:=regexp_replace(override_key,'@[0-9]{1,2}:[0-9]{2}$','');
      section_name:=substring(ident from '_(A|B)$'); ident:=regexp_replace(ident,'_(A|B)$','');
      section_name:=coalesce(section_name,'All');
      source_count:=0;
      for source in select value from jsonb_array_elements(feed) where value->>'date'=date_key and coalesce(nullif(value->>'code',''),value->>'name')=ident
        and (section_name='All' or value->>'section' in (section_name,'Single')) and (slot_name is null or value->>'start'=slot_name) order by value->>'section',value->>'start' loop
        source_count:=source_count+1;
        effective:=admin_internal.effective_notice_class(source,new_map->date_key); course:=source->>'code';
        if course is null or course='' then raise exception 'Cannot verify a course enrollment for %. Publish without the optional message or use an explicit broadcast audience.',override_key using errcode='22023'; end if;
        if date_key=today_ist and coalesce(effective->>'start','23:59')<=to_char(now() at time zone 'Asia/Kolkata','HH24:MI') then continue; end if;
        for student in select p.user_id from public.profiles p
          where exists(select 1 from jsonb_each(case when jsonb_typeof(p.courses)='object' then p.courses else '{}' end) enrollment where left(enrollment.key,1)<>'_' and (enrollment.key=course or left(enrollment.key,length(course)+1)=course||'_')
            and (source->>'section'='Single' or source->>'section' is null or enrollment.value#>>'{}'=source->>'section' or right(enrollment.key,2)='_'||(source->>'section')))
          and not exists(select 1 from public._migration_map m where m.dev_user_id=p.user_id)
          and (effective->>'type' is distinct from 'cancelled' or not exists(select 1 from public.push_prefs ppf where ppf.user_id=p.user_id and ppf.cancellation_alerts=false)) order by p.user_id loop
          targets:=targets||jsonb_build_array(jsonb_build_object('user_id',student.user_id,'date',date_key,'key',override_key,'code',course,'section',section_name,'slot',slot_name,'effective',effective));
        end loop;
      end loop;
      if source_count=0 then raise exception 'Override % on % is not mapped in the server timetable. Publish without the optional message or use an explicit broadcast audience.',override_key,date_key using errcode='22023'; end if;
    end loop;
  end loop;
  if jsonb_array_length(targets)>20000 then raise exception 'Too many notification recipients in one publication. Split the changes into smaller publications.' using errcode='22023'; end if;
  -- A broad key may match duplicate source rows: one intended alert per key/user.
  return (select coalesce(jsonb_agg(value order by value->>'date',value->>'key',value->>'user_id'),'[]') from (select distinct on(value->>'date',value->>'key',value->>'user_id') value from jsonb_array_elements(targets) order by value->>'date',value->>'key',value->>'user_id') unique_targets);
end $$;
create function public.admin_preview_schedule_notices(p_payload jsonb,p_revision bigint,p_message text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare before_flags jsonb; targets jsonb; preview_id uuid; unique_users integer; push_users integer;
begin
  if not public.admin_has_capability('schedule.publish') then raise exception 'Schedule permission required' using errcode='42501'; end if;
  if length(coalesce(p_message,''))>500 then raise exception 'Message must be at most 500 characters' using errcode='22023'; end if;
  perform public.admin_validate_publication('schedule',p_payload);
  select flags into before_flags from public.system_config where id='global' for share;
  if (select revision from public.admin_publication_state where domain='schedule') is distinct from p_revision then raise exception 'Schedule changed. Review again.' using errcode='40001'; end if;
  targets:=admin_internal.schedule_notice_targets(before_flags,p_payload);
  insert into public.admin_schedule_notice_previews(created_by,payload,base_revision,message,targets) values(auth.jwt()->>'sub',p_payload,p_revision,p_message,targets) returning id into preview_id;
  select count(distinct value->>'user_id') into unique_users from jsonb_array_elements(targets);
  select count(distinct value->>'user_id') into push_users from jsonb_array_elements(targets) where exists(select 1 from public.push_subscriptions s where s.user_id=value->>'user_id');
  delete from public.admin_schedule_notice_previews where expires_at<now();
  return jsonb_build_object('id',preview_id,'students',unique_users,'push_subscribers',push_users,'notifications',jsonb_array_length(targets),
    'classes',(select coalesce(jsonb_agg(value),'[]') from (select distinct jsonb_build_object('date',t->>'date','key',t->>'key','effective',t->'effective') value from jsonb_array_elements(targets) t) classes));
end $$;
create function admin_internal.emit_schedule_notices(p_targets jsonb,p_revision bigint,p_message text) returns integer language plpgsql security definer set search_path=public as $$
declare target jsonb; dedup text; count_created integer:=0; changed integer; expires timestamptz;
begin
  for target in select value from jsonb_array_elements(p_targets) loop
    expires:=((target->>'date')||'T'||coalesce(target#>>'{effective,start}','23:59')||':00+05:30')::timestamptz;
    if expires<=now() then continue; end if;
    dedup:=case when target#>>'{effective,type}'='cancelled' then 'cancel:'||(target->>'date')||':'||(target->>'code')||':'||(target->>'section')||case when target->>'slot' is not null then '@'||(target->>'slot') else '' end
      else 'publication:'||p_revision||':'||(target->>'date')||':'||(target->>'key') end;
    insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key)
      values(target->>'user_id',case when target#>>'{effective,type}'='cancelled' then 'class_cancelled' else 'schedule_change' end,
        (target->>'code')||case when target#>>'{effective,type}'='cancelled' then ' cancelled' else ' timetable updated' end,
        coalesce(nullif(btrim(p_message),''),(target->>'date')||' · '||coalesce(target#>>'{effective,start}','')||' · Room '||coalesce(target#>>'{effective,room}','see timetable')),
        '/?view=today','/icon-192.png',jsonb_build_object('code',target->>'code','date',target->>'date','start',target#>>'{effective,start}','section',target->>'section','publication_revision',p_revision,'urgency','normal','ttl',21600,'expires_at',expires),dedup)
      on conflict(user_id,dedup_key) do nothing;
    get diagnostics changed=row_count; count_created:=count_created+changed;
    insert into public.admin_schedule_notice_coverage(revision,user_id,class_date,override_key,code,section,slot,effective)
      values(p_revision,target->>'user_id',target->>'date',target->>'key',target->>'code',target->>'section',target->>'slot',target->'effective') on conflict do nothing;
  end loop;
  return count_created;
end $$;
create function public.admin_publish_schedule_with_notice(p_payload jsonb,p_revision bigint,p_preview uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare preview public.admin_schedule_notice_previews; before_flags jsonb; targets jsonb; result jsonb; queued integer;
begin
  select * into preview from public.admin_schedule_notice_previews where id=p_preview and created_by=auth.jwt()->>'sub' for update;
  if not found or preview.expires_at<clock_timestamp() or preview.payload is distinct from p_payload or preview.base_revision is distinct from p_revision then raise exception 'Audience preview expired or changed. Preview again.' using errcode='40001'; end if;
  select flags into before_flags from public.system_config where id='global' for update;
  targets:=admin_internal.schedule_notice_targets(before_flags,p_payload);
  if targets is distinct from preview.targets then raise exception 'Audience or source schedule changed. Preview again before publishing.' using errcode='40001'; end if;
  result:=admin_internal.publish_domain('schedule',p_payload,p_revision,auth.jwt()->>'sub');
  queued:=admin_internal.emit_schedule_notices(targets,(result->>'revision')::bigint,preview.message);
  delete from public.admin_schedule_notice_previews where id=p_preview;
  return result||jsonb_build_object('notice_count',queued,'notice_status','queued');
end $$;

-- Service-only evidence used by the existing cron producers to avoid sending
-- another alert for an identical effective class already covered at publication.
create function public.admin_list_schedule_notice_coverage(p_dates text[]) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.admin_schedule_notice_coverage c where class_date=any(p_dates) and created_at>now()-interval '30 days');
end $$;
revoke all on function admin_internal.schedule_notice_targets(jsonb,jsonb),admin_internal.emit_schedule_notices(jsonb,bigint,text) from public,anon,authenticated;
revoke all on function public.admin_preview_schedule_notices(jsonb,bigint,text),public.admin_publish_schedule_with_notice(jsonb,bigint,uuid) from public,anon;
grant execute on function public.admin_preview_schedule_notices(jsonb,bigint,text),public.admin_publish_schedule_with_notice(jsonb,bigint,uuid) to authenticated;
revoke all on function public.admin_list_schedule_notice_coverage(text[]) from public,anon,authenticated;
grant execute on function public.admin_list_schedule_notice_coverage(text[]) to service_role;

drop function public.admin_schedule_domain(text,jsonb,bigint,timestamptz);
create function public.admin_schedule_domain(p_domain text,p_payload jsonb,p_revision bigint,p_at timestamptz,p_notify boolean default false,p_preview uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare preview public.admin_schedule_notice_previews; job_id uuid;
begin
  if not public.admin_has_capability(p_domain||'.publish') then raise exception 'Publication permission required' using errcode='42501'; end if;
  perform public.admin_validate_publication(p_domain,p_payload);
  if p_at is null or p_at<=now() or p_at>now()+interval '366 days' then raise exception 'Choose a future time within one year' using errcode='22023'; end if;
  if (select revision from public.admin_publication_state where domain=p_domain) is distinct from p_revision then raise exception 'Settings changed' using errcode='40001'; end if;
  if p_notify then
    select * into preview from public.admin_schedule_notice_previews where id=p_preview and created_by=auth.jwt()->>'sub';
    if p_domain<>'schedule' or not found or preview.expires_at<clock_timestamp() or preview.payload is distinct from p_payload or preview.base_revision is distinct from p_revision then raise exception 'Preview the schedule audience again before scheduling' using errcode='40001'; end if;
  end if;
  insert into public.admin_scheduled_publications(domain,payload,base_revision,created_by,scheduled_at,notify_students,notice_message,estimated_recipients)
    values(p_domain,p_payload,p_revision,auth.jwt()->>'sub',p_at,p_notify,preview.message,
      (select count(distinct value->>'user_id') from jsonb_array_elements(coalesce(preview.targets,'[]')))) returning id into job_id;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','domain_scheduled',jsonb_build_object('id',job_id,'domain',p_domain,'at',p_at,'notify',p_notify,'audience_policy','resolve_at_execution'));
  return job_id;
end $$;
create or replace function public.admin_apply_due_publications() returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.admin_scheduled_publications; applied integer:=0; failed integer:=0; before_flags jsonb; targets jsonb; result jsonb; recipients integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  delete from public.admin_schedule_notice_previews where expires_at<now();
  delete from public.admin_schedule_notice_coverage where created_at<now()-interval '30 days';
  for job in select * from public.admin_scheduled_publications where status='pending' and scheduled_at<=now() order by scheduled_at,id for update skip locked limit 30 loop
    begin
      targets:='[]'; recipients:=0;
      if job.notify_students then
        select flags into before_flags from public.system_config where id='global' for update;
        targets:=admin_internal.schedule_notice_targets(before_flags,job.payload);
      end if;
      result:=admin_internal.publish_domain(job.domain,job.payload,job.base_revision,job.created_by);
      if job.notify_students then
        perform admin_internal.emit_schedule_notices(targets,(result->>'revision')::bigint,job.notice_message);
        select count(distinct value->>'user_id') into recipients from jsonb_array_elements(targets);
      end if;
      update public.admin_scheduled_publications set status='published',published_at=clock_timestamp(),error=null,actual_recipients=recipients where id=job.id;
      applied:=applied+1;
    exception when others then
      update public.admin_scheduled_publications set status=case when sqlstate='40001' then 'needs_review' else 'failed' end,error=left(sqlerrm,500) where id=job.id;
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('applied',applied,'failed',failed);
end $$;
revoke all on function public.admin_schedule_domain(text,jsonb,bigint,timestamptz,boolean,uuid) from public,anon;
grant execute on function public.admin_schedule_domain(text,jsonb,bigint,timestamptz,boolean,uuid) to authenticated;
commit;
