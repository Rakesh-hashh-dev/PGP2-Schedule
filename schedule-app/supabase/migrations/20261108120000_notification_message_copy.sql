-- Keep publication copy factual even when an admin adds a free-form note.
begin;

create or replace function admin_internal.notice_time(p_time text) returns text
language sql immutable set search_path=public as $$
  select case when p_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
    then to_char((p_time||':00')::time,'FMHH12:MI AM') else null end;
$$;
revoke all on function admin_internal.notice_time(text) from public,anon,authenticated;

create or replace function admin_internal.schedule_notice_copy(p_target jsonb,p_message text) returns jsonb
language plpgsql stable set search_path=public as $$
declare
  effective jsonb:=coalesce(p_target->'effective','{}');
  previous jsonb:=coalesce(p_target->'before','{}');
  course text:=p_target->>'code';
  class_day text:=p_target->>'date';
  today_ist date:=(now() at time zone 'Asia/Kolkata')::date;
  day_label text;
  class_time text:=admin_internal.notice_time(effective->>'start');
  old_time text:=admin_internal.notice_time(previous->>'start');
  section_name text:=coalesce(effective->>'section',p_target->>'section');
  cancelled boolean:=coalesce(effective->>'type'='cancelled',false);
  time_changed boolean;
  room_changed boolean;
  heading text;
  message text;
begin
  day_label:=case when class_day=today_ist::text then 'Today'
    when class_day=(today_ist+1)::text then 'Tomorrow'
    else to_char(class_day::date,'Dy, FMDD Mon') end;
  time_changed:=old_time is not null and class_time is not null and previous->>'start' is distinct from effective->>'start';
  room_changed:=nullif(previous->>'room','') is not null and nullif(effective->>'room','') is not null and previous->>'room' is distinct from effective->>'room';
  heading:=case when cancelled then course||' cancelled '||lower(day_label)
    when time_changed then course||' moved to '||class_time
    when room_changed then course||' room changed'
    when previous->>'type'='cancelled' then course||' reinstated'
    else course||' timetable updated' end;
  message:=concat_ws(E'\n',
    nullif(concat_ws(' · ',day_label,case when day_label in ('Today','Tomorrow') then to_char(class_day::date,'Dy, FMDD Mon') end,case when cancelled then coalesce(old_time,class_time) else class_time end,
      case when section_name not in ('Single','All','') then 'Section '||section_name end,
      case when not room_changed and nullif(effective->>'room','') is not null then 'Room '||(effective->>'room') end),''),
    case when not cancelled and time_changed then old_time||' → '||class_time end,
    case when not cancelled and admin_internal.notice_time(previous->>'end') is not null and admin_internal.notice_time(effective->>'end') is not null
      and previous->>'end' is distinct from effective->>'end' then 'Ends: '||admin_internal.notice_time(previous->>'end')||' → '||admin_internal.notice_time(effective->>'end') end,
    case when not cancelled and room_changed then 'Room '||(previous->>'room')||' → '||(effective->>'room') end,
    case when cancelled then 'This session will not take place. Your timetable is updated.' end,
    nullif(btrim(p_message),''));
  return jsonb_build_object('title',heading,'body',message);
end $$;
revoke all on function admin_internal.schedule_notice_copy(jsonb,text) from public,anon,authenticated;

create or replace function admin_internal.emit_schedule_notices(p_targets jsonb,p_revision bigint,p_message text) returns integer
language plpgsql security definer set search_path=public as $$
declare target jsonb; dedup text; count_created integer:=0; changed integer; expires timestamptz; copy jsonb;
begin
  for target in select value from jsonb_array_elements(p_targets) loop
    expires:=((target->>'date')||'T'||coalesce(nullif(target#>>'{effective,start}',''),'23:59')||':00+05:30')::timestamptz;
    if expires<=now() then continue; end if;
    dedup:=case when target#>>'{effective,type}'='cancelled' then 'cancel:'||(target->>'date')||':'||(target->>'code')||':'||(target->>'section')||case when target->>'slot' is not null then '@'||(target->>'slot') else '' end
      else 'publication:'||p_revision||':'||(target->>'date')||':'||(target->>'key') end;
    copy:=admin_internal.schedule_notice_copy(target,p_message);
    insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key)
      values(target->>'user_id',case when target#>>'{effective,type}'='cancelled' then 'class_cancelled' else 'schedule_change' end,
        copy->>'title',copy->>'body','/?view=notifications','/icon-192.png',
        jsonb_build_object('code',target->>'code','date',target->>'date','start',target#>>'{effective,start}',
          'section',target->>'section','before',target->'before','effective',target->'effective',
          'publication_revision',p_revision,'urgency','normal','ttl',21600,'expires_at',expires),dedup)
      on conflict(user_id,dedup_key) do nothing;
    get diagnostics changed=row_count; count_created:=count_created+changed;
    insert into public.admin_schedule_notice_coverage(revision,user_id,class_date,override_key,code,section,slot,effective)
      values(p_revision,target->>'user_id',target->>'date',target->>'key',target->>'code',target->>'section',target->>'slot',target->'effective') on conflict do nothing;
  end loop;
  return count_created;
end $$;
revoke all on function admin_internal.emit_schedule_notices(jsonb,bigint,text) from public,anon,authenticated;


create or replace function admin_internal.schedule_notice_targets(p_before jsonb,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
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
          targets:=targets||jsonb_build_array(jsonb_build_object('user_id',student.user_id,'date',date_key,'key',override_key,'code',course,'section',section_name,'slot',slot_name,'before',admin_internal.effective_notice_class(source,old_map->date_key),'effective',effective));
        end loop;
      end loop;
      if source_count=0 then raise exception 'Override % on % is not mapped in the server timetable. Publish without the optional message or use an explicit broadcast audience.',override_key,date_key using errcode='22023'; end if;
    end loop;
  end loop;
  if jsonb_array_length(targets)>20000 then raise exception 'Too many notification recipients in one publication. Split the changes into smaller publications.' using errcode='22023'; end if;
  -- A broad key may match duplicate source rows: one intended alert per key/user.
  return (select coalesce(jsonb_agg(value order by value->>'date',value->>'key',value->>'user_id'),'[]') from (select distinct on(value->>'date',value->>'key',value->>'user_id') value from jsonb_array_elements(targets) order by value->>'date',value->>'key',value->>'user_id') unique_targets);
end $$;

create or replace function public.admin_preview_schedule_notices(p_payload jsonb,p_revision bigint,p_message text default null) returns jsonb language plpgsql security definer set search_path=public as $$
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
    'classes',(select coalesce(jsonb_agg(value),'[]') from (select distinct jsonb_build_object('date',t->>'date','key',t->>'key','before',t->'before','effective',t->'effective','copy',admin_internal.schedule_notice_copy(t,p_message)) value from jsonb_array_elements(targets) t) classes));
end $$;

commit;
