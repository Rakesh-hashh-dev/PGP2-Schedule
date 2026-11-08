begin;
create table public.admin_publication_state(domain text primary key check(domain in ('schedule','communications','system')), revision bigint not null default 0);
insert into public.admin_publication_state(domain) values('schedule'),('communications'),('system');
create table public.admin_publication_versions(
  id bigint generated always as identity primary key, domain text not null,
  revision bigint not null, payload jsonb not null, created_by text not null,
  created_at timestamptz not null default now(), unique(domain,revision)
);
create table public.admin_publication_drafts(
  user_id text not null, domain text not null references public.admin_publication_state,
  payload jsonb not null, base_payload jsonb not null, base_revision bigint not null,
  draft_revision bigint not null default 1, updated_at timestamptz not null default now(),
  primary key(user_id,domain)
);
create table public.admin_scheduled_publications(
  id uuid primary key default gen_random_uuid(), domain text not null,
  payload jsonb not null, base_revision bigint, created_by text not null,
  scheduled_at timestamptz not null, status text not null default 'pending'
    check(status in ('pending','needs_review','published','failed','cancelled')),
  error text, created_at timestamptz not null default now(), published_at timestamptz
);
alter table public.admin_publication_state enable row level security;
alter table public.admin_publication_versions enable row level security;
alter table public.admin_publication_drafts enable row level security;
alter table public.admin_scheduled_publications enable row level security;
revoke all on public.admin_publication_state,public.admin_publication_versions,public.admin_publication_drafts,public.admin_scheduled_publications from anon,authenticated;
grant select on public.admin_publication_state,public.admin_publication_versions,public.admin_publication_drafts,public.admin_scheduled_publications to authenticated;
create policy "Admins read revisions" on public.admin_publication_state for select to authenticated using(public.is_admin());
create policy "Admins read versions" on public.admin_publication_versions for select to authenticated using(public.is_admin());
create policy "Own private drafts" on public.admin_publication_drafts for select to authenticated using(public.is_admin() and user_id=auth.jwt()->>'sub');
create policy "Admins read scheduled publications" on public.admin_scheduled_publications for select to authenticated using(public.is_admin());

create function public.admin_config_domain(p_key text) returns text language sql immutable as $$
  select case when p_key='classOverrides' then 'schedule'
    when p_key=any(array['scheduledAnnouncements','scheduledPushes','quickLinks','feedbackFlashes','feedbackFlash','updatePrompt','whatsNew','socialFlash']) then 'communications'
    when p_key=any(array['configHistory','scheduledConfigDeploys','adminNotes','adminRoles']) then null
    else 'system' end;
$$;
create function public.admin_domain_payload(p_domain text,p_flags jsonb,p_announcement jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object('flags',coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(p_flags,'{}')) where public.admin_config_domain(key)=p_domain),'{}'))
    || case when p_domain='communications' then jsonb_build_object('announcement',p_announcement) else '{}'::jsonb end;
$$;
create function public.admin_validate_publication(p_domain text,p_payload jsonb)
returns void language plpgsql set search_path=public as $$
declare pair record; day record; item record; field_name text; element jsonb;
begin
  if p_domain is null or p_domain not in ('schedule','communications','system') or p_payload is null
    or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'flags') is distinct from 'object'
    or octet_length(p_payload::text)>1000000
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('flags','announcement'))
    or (p_domain<>'communications' and p_payload?'announcement')
    or (p_domain='communications' and not p_payload?'announcement') then raise exception 'Invalid publication payload' using errcode='22023'; end if;
  if public.admin_strip_private_config(p_payload) is distinct from p_payload then raise exception 'Private fields cannot be published' using errcode='22023'; end if;
  for pair in select * from jsonb_each(p_payload->'flags') loop
    if public.admin_config_domain(pair.key) is distinct from p_domain then raise exception 'Setting belongs to another domain: %',pair.key using errcode='22023'; end if;
    if pair.key in ('feedbackFlashes','scheduledPushes','scheduledAnnouncements','quickLinks') and pair.value<>'null'::jsonb then
      if jsonb_typeof(pair.value)<>'array' or jsonb_array_length(pair.value)>500 then raise exception 'Setting % must be a bounded list',pair.key using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements(pair.value) v where jsonb_typeof(v)<>'object') then raise exception 'Setting % must contain objects',pair.key using errcode='22023'; end if;
      for element in select value from jsonb_array_elements(pair.value) loop
        foreach field_name in array array['title','body','text','message','date','time','deadline','subjectCode','section','url','href','start','end'] loop
          if element?field_name and jsonb_typeof(element->field_name) not in ('string','null') then raise exception 'Field % in % must be text',field_name,pair.key using errcode='22023'; end if;
        end loop;
        if element?'enabled' and jsonb_typeof(element->'enabled') not in ('boolean','null') then raise exception 'Enabled must be a boolean' using errcode='22023'; end if;
      end loop;
    end if;
    if (pair.key~'^enable[A-Z]' or pair.key in ('dispatchEnabled','maintenanceMode')) and jsonb_typeof(pair.value) not in ('boolean','null') then raise exception 'Setting % must be a boolean',pair.key using errcode='22023'; end if;
    if pair.key='updatePrompt' then
      if jsonb_typeof(pair.value)<>'object' or jsonb_typeof(pair.value->'title') is distinct from 'string' or jsonb_typeof(pair.value->'desc') is distinct from 'string' or jsonb_typeof(pair.value->'highlights') is distinct from 'array' then raise exception 'Invalid update message' using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements(pair.value->'highlights') v where jsonb_typeof(v)<>'string') then raise exception 'Update highlights must be text' using errcode='22023'; end if;
    end if;
  end loop;
  if p_domain='schedule' and p_payload->'flags'?'classOverrides' then
    if jsonb_typeof(p_payload#>'{flags,classOverrides}')<>'object' then raise exception 'Invalid overrides' using errcode='22023'; end if;
    for day in select * from jsonb_each(p_payload#>'{flags,classOverrides}') loop
      if day.key !~ '^\d{4}-\d{2}-\d{2}$' or to_char(day.key::date,'YYYY-MM-DD')<>day.key or jsonb_typeof(day.value)<>'object' then raise exception 'Invalid override date' using errcode='22023'; end if;
      for item in select * from jsonb_each(day.value) loop
        if length(item.key) not between 1 and 300 or jsonb_typeof(item.value)<>'object' then raise exception 'Invalid override entry' using errcode='22023'; end if;
        foreach field_name in array array['room','name','code','section','faculty','session','type','cancelledType','modifiedAt','modifiedBy'] loop
          if item.value?field_name and jsonb_typeof(item.value->field_name) not in ('string','null') then raise exception 'Class field % must be text',field_name using errcode='22023'; end if;
        end loop;
        if (item.value?'start' and jsonb_typeof(item.value->'start')<>'string') or (item.value?'end' and jsonb_typeof(item.value->'end')<>'string') then raise exception 'Class times must be text' using errcode='22023'; end if;
        if (item.value?'start' and item.value->>'start' !~ '^([01]\d|2[0-3]):[0-5]\d$')
          or (item.value?'end' and item.value->>'end' !~ '^([01]\d|2[0-3]):[0-5]\d$')
          or (item.value?'start' and item.value?'end' and item.value->>'start'>=item.value->>'end') then raise exception 'Invalid class times' using errcode='22023'; end if;
      end loop;
    end loop;
  end if;
end;
$$;

create function public.admin_track_domain_revisions() returns trigger language plpgsql security definer set search_path=public as $$
declare domain_name text; before_payload jsonb; after_payload jsonb; next_revision bigint;
begin
  foreach domain_name in array array['schedule','communications','system'] loop
    before_payload := case when tg_op='INSERT' then null else public.admin_domain_payload(domain_name,old.flags,to_jsonb(old.announcement)) end;
    after_payload := public.admin_domain_payload(domain_name,new.flags,to_jsonb(new.announcement));
    if before_payload is distinct from after_payload then
      update public.admin_publication_state set revision=revision+1 where domain=domain_name returning revision into next_revision;
      insert into public.admin_publication_versions(domain,revision,payload,created_by)
        values(domain_name,next_revision,after_payload,coalesce(auth.jwt()->>'sub','service:configuration'));
    end if;
  end loop;
  return new;
end;
$$;
insert into public.admin_publication_versions(domain,revision,payload,created_by)
select d.domain,0,public.admin_domain_payload(d.domain,c.flags,to_jsonb(c.announcement)),'migration:publication'
from public.admin_publication_state d cross join public.system_config c where c.id='global';
create trigger track_admin_domains after insert or update on public.system_config
for each row when(new.id='global') execute function public.admin_track_domain_revisions();

create function public.admin_load_publication(p_domain text) returns jsonb language plpgsql security definer set search_path=public as $$
declare output jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select jsonb_build_object('domain',s.domain,'revision',s.revision,'payload',public.admin_domain_payload(s.domain,c.flags,to_jsonb(c.announcement))) into output
    from public.admin_publication_state s cross join public.system_config c where s.domain=p_domain and c.id='global';
  if output is null then raise exception 'Unknown domain or missing config' using errcode='22023'; end if;
  return output;
end;
$$;
-- Only wrappers below may call this actor-parameterized primitive.
create function admin_internal.publish_domain(p_domain text,p_payload jsonb,p_revision bigint,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare config public.system_config; merged public.system_config; actual_revision bigint; actor_role text; flags_next jsonb; requested_payload jsonb:=p_payload; flash jsonb; previous_flash jsonb; stamped jsonb:='[]';
begin
  select role into actor_role from public.admins where user_id=p_actor;
  if not coalesce(actor_role='superadmin' or (actor_role='schedule_editor' and p_domain='schedule') or (actor_role='communications_editor' and p_domain='communications'),false)
    then raise exception 'Publication permission required' using errcode='42501'; end if;
  perform public.admin_validate_publication(p_domain,p_payload);
  select * into config from public.system_config where id='global' for update;
  if not found then raise exception 'Configuration unavailable'; end if;
  select revision into actual_revision from public.admin_publication_state where domain=p_domain;
  if p_revision is null or actual_revision<>p_revision then raise exception 'This area changed. Reload and reconcile before publishing.' using errcode='40001'; end if;
  if public.admin_domain_payload(p_domain,config.flags,to_jsonb(config.announcement))=p_payload then
    return jsonb_build_object('domain',p_domain,'revision',actual_revision,'payload',p_payload);
  end if;
  -- Preserve the scheduler's existing announcement semantics: enabling or
  -- retargeting a flash stamps the actual publication time on the server.
  if p_domain='communications' and jsonb_typeof(p_payload#>'{flags,feedbackFlashes}')='array' then
    for flash in select value from jsonb_array_elements(p_payload#>'{flags,feedbackFlashes}') loop
      select value into previous_flash from jsonb_array_elements(case when jsonb_typeof(config.flags->'feedbackFlashes')='array' then config.flags->'feedbackFlashes' else '[]' end) where value->'id'=flash->'id' limit 1;
      if flash->'enabled'='true'::jsonb then
        if previous_flash is null or previous_flash->'enabled' is distinct from 'true'::jsonb or previous_flash->'deadline' is distinct from flash->'deadline' or previous_flash->'subjectCode' is distinct from flash->'subjectCode' or previous_flash->'section' is distinct from flash->'section' then
          flash:=jsonb_set(flash,'{announcedAt}',to_jsonb(clock_timestamp()),true);
        elsif previous_flash?'announcedAt' then flash:=jsonb_set(flash,'{announcedAt}',previous_flash->'announcedAt',true);
        end if;
      end if;
      stamped:=stamped||jsonb_build_array(flash);
    end loop;
    p_payload:=jsonb_set(p_payload,'{flags,feedbackFlashes}',stamped,true);
  end if;
  select coalesce(jsonb_object_agg(key,value),'{}') into flags_next from jsonb_each(coalesce(config.flags,'{}')) where public.admin_config_domain(key) is distinct from p_domain;
  flags_next := flags_next || (p_payload->'flags');
  merged := jsonb_populate_record(config,jsonb_build_object('flags',flags_next) || case when p_domain='communications' then jsonb_build_object('announcement',p_payload->'announcement') else '{}'::jsonb end);
  update public.system_config set flags=merged.flags,announcement=merged.announcement,updated_at=clock_timestamp() where id='global';
  update public.admin_publication_versions set created_by=p_actor where domain=p_domain and revision=actual_revision+1;
  insert into public.admin_audit_logs(admin_id,action,details) values(p_actor,'domain_published',jsonb_build_object('domain',p_domain,'revision',actual_revision+1));
  delete from public.admin_publication_drafts where user_id=p_actor and domain=p_domain and payload=requested_payload and base_revision=p_revision;
  return jsonb_build_object('domain',p_domain,'revision',actual_revision+1,'payload',p_payload);
end;
$$;
revoke all on function admin_internal.publish_domain(text,jsonb,bigint,text) from public,anon,authenticated;
create function public.admin_publish_domain(p_domain text,p_payload jsonb,p_revision bigint)
returns jsonb language sql security definer set search_path=public as $$
  select admin_internal.publish_domain(p_domain,p_payload,p_revision,auth.jwt()->>'sub');
$$;

create function public.admin_schedule_domain(p_domain text,p_payload jsonb,p_revision bigint,p_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare job_id uuid;
begin
  if not public.admin_has_capability(p_domain||'.publish') then raise exception 'Publication permission required' using errcode='42501'; end if;
  perform public.admin_validate_publication(p_domain,p_payload);
  if p_at is null or p_at<=now() or p_at>now()+interval '366 days' then raise exception 'Choose a future time within one year' using errcode='22023'; end if;
  if (select revision from public.admin_publication_state where domain=p_domain) is distinct from p_revision then raise exception 'Settings changed' using errcode='40001'; end if;
  insert into public.admin_scheduled_publications(domain,payload,base_revision,created_by,scheduled_at)
    values(p_domain,p_payload,p_revision,auth.jwt()->>'sub',p_at) returning id into job_id;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','domain_scheduled',jsonb_build_object('id',job_id,'domain',p_domain,'at',p_at));
  return job_id;
end;
$$;
create function public.admin_cancel_publication(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare job public.admin_scheduled_publications;
begin
  select * into job from public.admin_scheduled_publications where id=p_id for update;
  if not found or not public.admin_has_capability(job.domain||'.publish') then raise exception 'Publication unavailable or forbidden' using errcode='42501'; end if;
  update public.admin_scheduled_publications set status='cancelled' where id=p_id and status in ('pending','needs_review','failed');
  if found then insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','publication_cancelled',jsonb_build_object('id',p_id)); end if;
end;
$$;

-- Old snapshots cannot be safely inferred as patches. Preserve them privately
-- for an admin to review instead of applying them over a newer configuration.
insert into public.admin_scheduled_publications(domain,payload,created_by,scheduled_at,status,error)
select 'system',entry,coalesce(entry->>'author','legacy'),now(),'needs_review','Legacy whole-config snapshot: restage each intended area.'
from public.system_config c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.flags->'scheduledConfigDeploys')='array' then c.flags->'scheduledConfigDeploys' else '[]' end) entry where c.id='global';
update public.system_config set flags=flags-'scheduledConfigDeploys' where flags?'scheduledConfigDeploys';
create function public.admin_reject_legacy_schedule() returns trigger language plpgsql as $$
begin
  if new.flags?'scheduledConfigDeploys' and new.flags->'scheduledConfigDeploys'<>'[]'::jsonb then
    raise exception 'Reload Admin Tools and schedule each area through scoped publishing.' using errcode='22023';
  end if; return new;
end $$;
create trigger reject_legacy_schedule before insert or update on public.system_config for each row execute function public.admin_reject_legacy_schedule();

create function public.admin_apply_due_publications() returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.admin_scheduled_publications; applied integer:=0; failed integer:=0;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  for job in select * from public.admin_scheduled_publications where status='pending' and scheduled_at<=now() order by scheduled_at,id for update skip locked limit 30 loop
    begin
      perform admin_internal.publish_domain(job.domain,job.payload,job.base_revision,job.created_by);
      update public.admin_scheduled_publications set status='published',published_at=clock_timestamp(),error=null where id=job.id;
      applied:=applied+1;
    exception when others then
      update public.admin_scheduled_publications set status=case when sqlstate='40001' then 'needs_review' else 'failed' end,error=left(sqlerrm,500) where id=job.id;
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('applied',applied,'failed',failed);
end;
$$;
revoke all on function public.admin_load_publication(text),public.admin_publish_domain(text,jsonb,bigint),public.admin_schedule_domain(text,jsonb,bigint,timestamptz),public.admin_cancel_publication(uuid) from public,anon;
grant execute on function public.admin_load_publication(text),public.admin_publish_domain(text,jsonb,bigint),public.admin_schedule_domain(text,jsonb,bigint,timestamptz),public.admin_cancel_publication(uuid) to authenticated;
revoke all on function public.admin_apply_due_publications() from public,anon,authenticated;
grant execute on function public.admin_apply_due_publications() to service_role;
commit;
