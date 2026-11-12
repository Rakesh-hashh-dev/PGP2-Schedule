-- Owner-private commitments and transactional meetup lifecycle. Apply after proposals.
begin;
create table public.social_busy_blocks (
 id uuid primary key default gen_random_uuid(), user_id text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, created_at timestamptz not null default now(),
 constraint social_busy_interval check(isfinite(starts_at) and isfinite(ends_at) and ends_at>=starts_at+interval '1 minute' and ends_at<=starts_at+interval '7 days')
);
create index social_busy_owner_time on public.social_busy_blocks(user_id,starts_at);
alter table public.social_busy_blocks enable row level security;
revoke all on public.social_busy_blocks from public,anon;
grant select,insert,delete on public.social_busy_blocks to authenticated;
create policy social_busy_owner on public.social_busy_blocks for all to authenticated using(user_id=auth.jwt()->>'sub') with check(user_id=auth.jwt()->>'sub');
-- Update only discovery consent; never replace the caller's courses blob.
create function public.social_set_discovery_opt_out(p_hidden boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare subject text:=auth.jwt()->>'sub'; existing_courses jsonb;
begin
 if nullif(subject,'') is null then raise exception 'Sign in required'; end if;
 if p_hidden is null then raise exception 'Choose a boolean discovery preference'; end if;
 select courses into existing_courses from public.profiles where user_id=subject for update;
 if not found then raise exception 'Your profile is not available. Refresh before changing discovery'; end if;
 if jsonb_typeof(coalesce(existing_courses,'{}'::jsonb)) is distinct from 'object' then raise exception 'Your profile preferences could not be read'; end if;
 update public.profiles set courses=jsonb_set(coalesce(courses,'{}'::jsonb),'{_hide_from_matchmaker}',to_jsonb(p_hidden),true) where user_id=subject;
 return jsonb_build_object('saved',true,'hidden',p_hidden);
end $$;
revoke all on function public.social_set_discovery_opt_out(boolean) from public,anon;
grant execute on function public.social_set_discovery_opt_out(boolean) to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_busy_blocks') then
  alter publication supabase_realtime add table public.social_busy_blocks;
 end if;
end $$;

alter table public.meetups add column version integer not null default 1;
alter table public.meetups add column updated_at timestamptz not null default now();
create function public.social_meetup_version() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (new.title,new.place,new.starts_at,new.ends_at,new.member_ids,new.cancelled,new.template_id) is distinct from (old.title,old.place,old.starts_at,old.ends_at,old.member_ids,old.cancelled,old.template_id) then
  new.version:=old.version+1; new.updated_at:=clock_timestamp();
 else new.version:=old.version; new.updated_at:=old.updated_at; end if;
 return new;
end $$;
create trigger social_meetup_version before update on public.meetups for each row execute function public.social_meetup_version();
-- Expand phase: preserve existing direct-write privileges/RLS for the hosted
-- frontend. After the RPC frontend is released and verified, contract with
-- supabase/operations/social-lifecycle-rpc-cutover.sql. Do not grant new access.
-- Keep proposal invalidation trigger intact. Its apply RPC also passes through this version trigger.

create function public.social_manage_meetup(p_meetup_id uuid,p_expected_version integer,p_action text,p_scope text,p_payload jsonb default '{}'::jsonb,p_versions jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare anchor public.meetups; oldrow public.meetups; changed public.meetups; subject text:=auth.jwt()->>'sub';
 new_start timestamptz; new_end timestamptz; shift interval; duration interval; members text[]; ids uuid[]; affected integer:=0; rescheduled boolean;
begin
 if subject is null then raise exception 'Sign in required'; end if;
 if p_action is null or p_action not in ('edit','cancel') or p_scope is null or p_scope not in ('this','future') then raise exception 'Invalid lifecycle action'; end if;
 select * into anchor from public.meetups where id=p_meetup_id;
 if anchor.id is null or anchor.created_by<>subject then raise exception 'Only the organizer can change this plan'; end if;
 -- Serialize operations for a series before acquiring occurrence row locks.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(anchor.series_id,anchor.id)::text,0));
 select * into anchor from public.meetups where id=p_meetup_id for update;
 if anchor.cancelled or anchor.starts_at<=now() then raise exception 'This occurrence is no longer editable'; end if;
 if p_expected_version is distinct from anchor.version then raise exception 'Plan changed. Refresh before trying again'; end if;
 if p_scope='future' and anchor.series_id is null then raise exception 'This plan is not a series'; end if;
 if p_action='edit' then
  if jsonb_typeof(p_payload) is distinct from 'object' or char_length(trim(coalesce(p_payload->>'title',''))) not between 1 and 80 or char_length(coalesce(p_payload->>'place',''))>60 or jsonb_typeof(p_payload->'memberIds') is distinct from 'array' then raise exception 'Invalid plan details'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'memberIds') value where jsonb_typeof(value) is distinct from 'string' or char_length(trim(value#>>'{}')) not between 1 and 255) then raise exception 'Invalid invitees'; end if;
  select array_agg(distinct value) into members from jsonb_array_elements_text(p_payload->'memberIds') value where value<>subject;
  if coalesce(cardinality(members),0) not between 1 and 100 then raise exception 'Choose 1 to 100 invitees'; end if;
  new_start:=(p_payload->>'startsAt')::timestamptz; new_end:=(p_payload->>'endsAt')::timestamptz;
  if new_start is null or new_end is null or not isfinite(new_start) or not isfinite(new_end) or new_start<=now() or new_end-new_start not between interval '15 minutes' and interval '4 hours' then raise exception 'Choose a future time and 15 to 240 minute duration'; end if;
  shift:=new_start-anchor.starts_at; duration:=new_end-new_start;
 end if;
 -- Locks and version checks all precede mutations. Any failure rolls back the whole operation.
 for oldrow in select * from public.meetups where created_by=subject and not cancelled and starts_at>now() and (id=anchor.id or (p_scope='future' and series_id=anchor.series_id and series_index>=anchor.series_index)) order by id for update loop
  if oldrow.id<>anchor.id and (p_versions->>oldrow.id::text)::integer is distinct from oldrow.version then raise exception 'A future occurrence changed or was not loaded. Refresh the plans'; end if;
  ids:=array_append(ids,oldrow.id);
 end loop;
 for oldrow in select * from public.meetups where id=any(ids) order by series_index nulls first loop
  rescheduled:=p_action='edit' and (oldrow.starts_at+shift is distinct from oldrow.starts_at or oldrow.starts_at+shift+duration is distinct from oldrow.ends_at);
  if p_action='cancel' then update public.meetups set cancelled=true where id=oldrow.id returning * into changed;
  else
   if oldrow.starts_at+shift<=now() then raise exception 'A future occurrence would move into the past'; end if;
   update public.meetups set title=trim(p_payload->>'title'),place=nullif(trim(p_payload->>'place'),''),starts_at=oldrow.starts_at+shift,ends_at=oldrow.starts_at+shift+duration,member_ids=members,template_id=nullif(p_payload->>'templateId','') where id=oldrow.id returning * into changed;
   delete from public.meetup_rsvps where meetup_id=oldrow.id and (rescheduled or (user_id=any(members)) is not true);
  end if;
  if changed.version=oldrow.version then continue; end if;
  affected:=affected+1;
  insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key)
   select distinct target,case when p_action='cancel' then 'meetup_cancelled' else 'meetup_invite' end,
    case when p_action='cancel' then 'Plan cancelled: ' else 'Plan updated: ' end||changed.title,
    case when p_action='cancel' then 'The organizer cancelled this occurrence.' when (target=any(changed.member_ids)) is not true then 'You are no longer invited to this occurrence.' when rescheduled then 'The time changed. Review the plan and RSVP again.' else 'The organizer updated the plan. Open it to review the details.' end,
    '/?view=friends','/icon-192.png',jsonb_build_object('from_id',subject,'meetup_id',changed.id,'version',changed.version,'expires_at',greatest(changed.starts_at,now()+interval '1 hour')),
    'meetup_lifecycle:'||changed.id::text||':'||changed.version::text
   from unnest(oldrow.member_ids||changed.member_ids) target where target is not null and target<>subject
   on conflict(user_id,dedup_key) do nothing;
 end loop;
 return jsonb_build_object('saved',true,'affected',affected);
end $$;

create function public.social_rsvp_meetup(p_meetup_id uuid,p_expected_version integer,p_response text,p_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.meetups; subject text:=auth.jwt()->>'sub';
begin
 select * into m from public.meetups where id=p_meetup_id for update;
 if subject is null or m.id is null or (subject=any(m.member_ids)) is not true then raise exception 'Only invited members can RSVP'; end if;
 if m.cancelled or m.starts_at<=now() then raise exception 'This plan is no longer open for responses'; end if;
 if p_expected_version is distinct from m.version then raise exception 'Plan changed. Review the new time before responding'; end if;
 if p_response is null or p_response not in ('going','declined') then raise exception 'Invalid RSVP'; end if;
 insert into public.meetup_rsvps(meetup_id,user_id,user_name,response) values(m.id,subject,left(coalesce(nullif(trim(p_name),''),'Someone'),80),p_response)
  on conflict(meetup_id,user_id) do update set response=excluded.response,user_name=excluded.user_name,responded_at=now();
 insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key) values(m.created_by,'meetup_rsvp','Plan response: '||m.title,left(coalesce(nullif(trim(p_name),''),'Someone'),80)||case when p_response='going' then ' is going.' else ' cannot make it.' end,'/?view=friends','/icon-192.png',jsonb_build_object('from_id',subject,'meetup_id',m.id,'expires_at',m.starts_at),'meetup_rsvp:'||m.id::text||':'||m.version::text||':'||subject||':'||p_response) on conflict(user_id,dedup_key) do nothing;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.social_manage_meetup(uuid,integer,text,text,jsonb,jsonb),public.social_rsvp_meetup(uuid,integer,text,text),public.social_meetup_version() from public,anon,authenticated;
grant execute on function public.social_manage_meetup(uuid,integer,text,text,jsonb,jsonb),public.social_rsvp_meetup(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
