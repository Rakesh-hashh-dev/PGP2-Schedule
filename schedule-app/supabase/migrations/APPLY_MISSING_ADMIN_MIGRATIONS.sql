-- Student-readable published state; drafts and history remain admin-only.
create table public.app_controls (
  id text primary key check (id = 'global'), revision bigint not null default 0,
  payload jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
insert into public.app_controls(id) values ('global');
create table public.app_controls_drafts (
  section text primary key check (section in ('mess','navigation','dashboard')),
  payload jsonb not null, base_revision bigint not null,
  updated_by text not null, updated_at timestamptz not null default now()
);
create table public.app_controls_versions (
  revision bigint primary key, section text not null, payload jsonb not null,
  created_by text not null, created_at timestamptz not null default now()
);
alter table public.app_controls enable row level security;
alter table public.app_controls_drafts enable row level security;
alter table public.app_controls_versions enable row level security;
grant select on public.app_controls to anon, authenticated;
grant select on public.app_controls_drafts, public.app_controls_versions to authenticated;
revoke insert, update, delete on public.app_controls, public.app_controls_drafts, public.app_controls_versions from anon, authenticated;
create policy "Published controls readable" on public.app_controls for select using (true);
create policy "Admin drafts readable" on public.app_controls_drafts for select to authenticated using (public.is_admin());
create policy "Admin versions readable" on public.app_controls_versions for select to authenticated using (public.is_admin());

-- Reject unknown keys at every level. Validation also runs on draft save.
create function public.controls_keys(v jsonb, allowed text[]) returns boolean
language sql immutable set search_path = public as $$
 select jsonb_typeof(v) = 'object' and not exists(select 1 from jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k where not (k = any(allowed)));
$$;
create function public.controls_date(v text) returns boolean language plpgsql immutable set search_path=public as $$
begin
 return v ~ '^\d{4}-\d{2}-\d{2}$' and to_char(v::date,'YYYY-MM-DD')=v;
exception when others then return false; end;
$$;
create function public.controls_times(v jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare meal text; t jsonb; s text; e text; prev text := '00:00'; i int := 0;
 starts text[] := array['08:30','13:00','17:30','20:00']; ends text[] := array['10:30','15:00','18:30','22:30'];
begin
 if not public.controls_keys(v,array['breakfast','lunch','snacks','dinner']) then return false; end if;
 foreach meal in array array['breakfast','lunch','snacks','dinner'] loop
  i:=i+1; t:=v->meal;
  if t is not null and (not public.controls_keys(t,array['start','end']) or jsonb_typeof(t->'start') is distinct from 'string' or jsonb_typeof(t->'end') is distinct from 'string') then return false; end if;
  s:=coalesce(t->>'start', starts[i]); e:=coalesce(t->>'end', ends[i]);
  if s !~ '^([01]\d|2[0-3]):[0-5]\d$' or e !~ '^([01]\d|2[0-3]):[0-5]\d$' or s>=e or s<prev then return false; end if;
  prev:=e;
 end loop; return true;
end;
$$;
create function public.validate_app_controls(section text, v jsonb) returns void
language plpgsql set search_path=public as $$
declare entry record; meal record; item jsonb; area text; allowed text[]; d text; n jsonb;
 nav text[] := array['today','tomorrow','fullSchedule','courseHub','planner','attendance','exams','assignments','notifications','friends','board','messMenu','split','pet','wrapped'];
 cards text[] := array['upcoming','summary','timeline','mess','todayCommand','deadlines'];
begin
 if v is null or jsonb_typeof(v) <> 'object' or octet_length(v::text)>150000 then raise exception 'Invalid controls payload'; end if;
 if section='mess' then
  if not public.controls_keys(v,array['weekly','dates','timings','datedTimings','notices','anchor','feedUrl']) then raise exception 'Invalid mess fields'; end if;
  foreach area in array array['weekly','dates'] loop
   n:=coalesce(v->area,'{}');
   if jsonb_typeof(n)<>'object' then raise exception 'Invalid menu map'; end if;
   if (select count(*) from jsonb_object_keys(n)) > (case when area='weekly' then 7 else 120 end) then raise exception 'Too many menu entries'; end if;
   for entry in select * from jsonb_each(n) loop
    if (area='weekly' and entry.key !~ '^[0-6]$') or (area='dates' and not public.controls_date(entry.key)) then raise exception 'Invalid menu date'; end if;
    allowed:=case when area='weekly' then array['breakfast','lunch','snacksW13','snacksW24','dinner'] else array['breakfast','lunch','snacks','dinner'] end;
    if not public.controls_keys(entry.value,allowed) then raise exception 'Invalid meal'; end if;
    for meal in select * from jsonb_each(entry.value) loop
     if jsonb_typeof(meal.value)<>'array' or jsonb_array_length(meal.value)>40 then raise exception 'Invalid dishes'; end if;
     for item in select * from jsonb_array_elements(meal.value) loop
      if jsonb_typeof(item)<>'string' or length(btrim(item#>>'{}'))=0 or length(item#>>'{}')>160 then raise exception 'Invalid dish'; end if;
     end loop;
     if (select count(*)<>count(distinct x) from jsonb_array_elements(meal.value) x) then raise exception 'Duplicate dish'; end if;
    end loop;
   end loop;
  end loop;
  if v ? 'anchor' and (jsonb_typeof(v->'anchor')<>'string' or not public.controls_date(v->>'anchor') or extract(isodow from (v->>'anchor')::date)<>1) then raise exception 'Anchor must be Monday'; end if;
  if v ? 'feedUrl' and (jsonb_typeof(v->'feedUrl')<>'string' or ((v->>'feedUrl')<>'' and (v->>'feedUrl') !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$')) then raise exception 'Invalid source URL'; end if;
  if not public.controls_times(coalesce(v->'timings','{}')) then raise exception 'Invalid timings'; end if;
  n:=coalesce(v->'datedTimings','{}');
  if jsonb_typeof(n)<>'object' then raise exception 'Invalid dated timings'; end if;
  if (select count(*) from jsonb_object_keys(n))>120 then raise exception 'Too many dated timings'; end if;
  for entry in select * from jsonb_each(n) loop
   if not public.controls_date(entry.key) or not public.controls_keys(entry.value,array['breakfast','lunch','snacks','dinner']) or not public.controls_times(coalesce(v->'timings','{}') || entry.value) then raise exception 'Invalid dated timings'; end if;
  end loop;
  n:=coalesce(v->'notices','[]');
  if jsonb_typeof(n)<>'array' or jsonb_array_length(n)>30 then raise exception 'Invalid notices'; end if;
  for item in select * from jsonb_array_elements(n) loop
   if not public.controls_keys(item,array['id','text','start','end']) or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 80 or jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 1 and 300 or jsonb_typeof(item->'start') is distinct from 'string' or jsonb_typeof(item->'end') is distinct from 'string' then raise exception 'Invalid notice'; end if;
   if (item->>'start') !~ '(Z|[+-]\d\d:\d\d)$' or (item->>'end') !~ '(Z|[+-]\d\d:\d\d)$' or (item->>'start')::timestamptz >= (item->>'end')::timestamptz then raise exception 'Invalid notice window'; end if;
  end loop;
 elsif section='navigation' then
  if not public.controls_keys(v,array['items','order']) or not public.controls_keys(coalesce(v->'items','{}'),nav) then raise exception 'Invalid navigation fields'; end if;
  for entry in select * from jsonb_each(coalesce(v->'items','{}')) loop
   if not public.controls_keys(entry.value,array['label','visible']) then raise exception 'Invalid navigation item'; end if;
   if entry.value ? 'label' and (jsonb_typeof(entry.value->'label')<>'string' or length(btrim(entry.value->>'label')) not between 1 and 40) then raise exception 'Invalid navigation label'; end if;
   if entry.value ? 'visible' and jsonb_typeof(entry.value->'visible')<>'boolean' then raise exception 'Invalid visibility'; end if;
   if entry.key='today' and entry.value->>'visible'='false' then raise exception 'Today must remain visible'; end if;
  end loop;
 elsif section='dashboard' then
  if not public.controls_keys(v,array['order','visible','density','weekPanel']) or not public.controls_keys(coalesce(v->'visible','{}'),array['summary','todayCommand','upcoming','mess','weather','deadlines']) then raise exception 'Invalid dashboard fields'; end if;
  for item in select value from jsonb_each(coalesce(v->'visible','{}')) loop
   if jsonb_typeof(item)<>'boolean' then raise exception 'Invalid widget visibility'; end if;
  end loop;
  if v ? 'density' and (jsonb_typeof(v->'density')<>'string' or v->>'density' not in ('compact','comfortable')) then raise exception 'Invalid density'; end if;
  if v ? 'weekPanel' and jsonb_typeof(v->'weekPanel')<>'boolean' then raise exception 'Invalid week panel'; end if;
 else raise exception 'Unknown controls section'; end if;
 if section in ('navigation','dashboard') and v ? 'order' then
  n:=v->'order'; allowed:=case when section='navigation' then nav else cards end;
  if jsonb_typeof(n)<>'array' then raise exception 'Invalid order'; end if;
  for item in select * from jsonb_array_elements(n) loop
   d:=item#>>'{}'; if jsonb_typeof(item)<>'string' or not d=any(allowed) then raise exception 'Invalid order item'; end if;
  end loop;
  if (select count(*)<>count(distinct x) from jsonb_array_elements(n) x) then raise exception 'Duplicate order item'; end if;
 end if;
end;
$$;

create function public.admin_save_controls_draft(p_section text, p_payload jsonb, p_revision bigint) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.jwt()->>'sub' is null or not public.can_write_config() then raise exception 'Superadmin permission required' using errcode='42501'; end if;
 perform public.validate_app_controls(p_section,p_payload);
 insert into public.app_controls_drafts(section,payload,base_revision,updated_by) values(p_section,p_payload,p_revision,auth.jwt()->>'sub')
 on conflict(section) do update set payload=excluded.payload,base_revision=excluded.base_revision,updated_by=excluded.updated_by,updated_at=now();
end;
$$;
create function public.admin_publish_controls(p_section text, p_payload jsonb, p_revision bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare current_row public.app_controls; next_payload jsonb; next_revision bigint;
begin
 if auth.jwt()->>'sub' is null or not public.can_write_config() then raise exception 'Superadmin permission required' using errcode='42501'; end if;
 perform public.validate_app_controls(p_section,p_payload);
 select * into current_row from public.app_controls where id='global' for update;
 if p_revision is null or current_row.revision<>p_revision then raise exception 'Settings changed. Reload and review before publishing.' using errcode='40001'; end if;
 next_revision:=current_row.revision+1; next_payload:=jsonb_set(current_row.payload,array[p_section],p_payload,true);
 insert into public.app_controls_versions(revision,section,payload,created_by) values(next_revision,p_section,next_payload,auth.jwt()->>'sub');
 update public.app_controls set payload=next_payload,revision=next_revision,updated_at=now() where id='global';
 insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','app_controls_publish',jsonb_build_object('section',p_section,'revision',next_revision,'before',current_row.payload->p_section,'after',p_payload));
 delete from public.app_controls_drafts where section=p_section and payload=p_payload and base_revision=p_revision;
 return next_revision;
end;
$$;
revoke all on function public.admin_save_controls_draft(text,jsonb,bigint), public.admin_publish_controls(text,jsonb,bigint) from public, anon;
grant execute on function public.admin_save_controls_draft(text,jsonb,bigint), public.admin_publish_controls(text,jsonb,bigint) to authenticated;
-- Notes must never ride in the publicly readable configuration, even in history.
begin;

create table public.admin_student_notes (
  user_id text primary key,
  body text not null default '',
  revision bigint not null default 0 check (revision >= 0),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create table public.admin_private_config_archive (
  id bigint generated always as identity primary key,
  source_id text not null,
  payload jsonb not null,
  archived_at timestamptz not null default now()
);
alter table public.admin_student_notes enable row level security;
alter table public.admin_private_config_archive enable row level security;
revoke all on public.admin_student_notes, public.admin_private_config_archive from anon, authenticated;
grant select on public.admin_student_notes to authenticated;
create policy "Registered admins read student notes" on public.admin_student_notes
  for select to authenticated using (public.admin_role() in ('monitor', 'superadmin'));
-- Archive has no client policies: historical notes can be recovered by a DBA,
-- never exported through ordinary config history or the student API.

create or replace function public.admin_strip_private_config(p_value jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare result jsonb; pair record;
begin
  case jsonb_typeof(p_value)
  when 'object' then
    result := '{}'::jsonb;
    for pair in select key, value from jsonb_each(p_value) loop
      if pair.key not in ('adminNotes', 'adminRoles') then
        result := result || jsonb_build_object(pair.key, public.admin_strip_private_config(pair.value));
      end if;
    end loop;
    return result;
  when 'array' then
    select coalesce(jsonb_agg(public.admin_strip_private_config(value) order by ord), '[]'::jsonb)
      into result from jsonb_array_elements(p_value) with ordinality as a(value, ord);
    return result;
  else return p_value;
  end case;
end;
$$;

-- Archive the entire affected payload before stripping nested snapshots. This
-- preserves older note versions without making them ordinary restore targets.
insert into public.admin_private_config_archive(source_id, payload)
select id::text, flags from public.system_config
where flags is distinct from public.admin_strip_private_config(flags);

insert into public.admin_student_notes(user_id, body, revision, updated_by)
select e.key, e.value #>> '{}', 1, 'migration:private-notes'
from public.system_config sc
cross join lateral jsonb_each(case when jsonb_typeof(sc.flags->'adminNotes') = 'object'
  then sc.flags->'adminNotes' else '{}'::jsonb end) e
where sc.id = 'global' and jsonb_typeof(e.value) = 'string';

update public.system_config set flags = public.admin_strip_private_config(flags)
where flags is distinct from public.admin_strip_private_config(flags);

create or replace function public.admin_reject_private_config()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.flags is distinct from public.admin_strip_private_config(new.flags) then
    raise exception 'Private admin fields cannot be published. Reload Admin Tools and save notes in Private admin notes.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger reject_private_admin_config before insert or update on public.system_config
for each row execute function public.admin_reject_private_config();

create or replace function public.admin_save_student_note(p_user_id text, p_body text, p_revision bigint)
returns public.admin_student_notes language plpgsql security definer set search_path = public as $$
declare current_note public.admin_student_notes; actor text := auth.jwt()->>'sub';
begin
  if coalesce(public.admin_role(), '') <> 'superadmin' then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' or length(p_user_id) > 256
    or p_body is null or length(p_body) > 20000 or p_revision is null or p_revision < 0 then
    raise exception 'A student, note of at most 20000 characters, and revision are required' using errcode = '22023';
  end if;
  insert into public.admin_student_notes(user_id, updated_by) values (p_user_id, actor)
    on conflict (user_id) do nothing;
  select * into current_note from public.admin_student_notes where user_id = p_user_id for update;
  if current_note.revision <> p_revision then
    raise exception 'Another admin saved this note. Copy your changes, reload the saved note, and reconcile before saving.' using errcode = '40001';
  end if;
  update public.admin_student_notes set body = p_body, revision = revision + 1,
    updated_by = actor, updated_at = clock_timestamp() where user_id = p_user_id returning * into current_note;
  -- Body text deliberately stays out of the general audit stream.
  insert into public.admin_audit_logs(admin_id, action, details)
    values (actor, 'student_note_saved', jsonb_build_object('user_id', p_user_id, 'revision', current_note.revision));
  return current_note;
end;
$$;
revoke all on function public.admin_save_student_note(text, text, bigint) from public, anon;
grant execute on function public.admin_save_student_note(text, text, bigint) to authenticated;
commit;
begin;
-- Adding roles never expands can_write_config(): all legacy whole-config and
-- companion write paths remain exclusively Superadmin operations.
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check(role in
  ('monitor','superadmin','schedule_editor','communications_editor','moderator'));

create or replace function public.admin_has_capability(p_capability text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(case public.admin_role()
    when 'superadmin' then p_capability = any(array['admin.read','schedule.publish','communications.publish','communications.send','moderation.write','support.read','notes.read','notes.write','diagnostics.read','data.read','system.publish','roles.manage'])
    when 'monitor' then p_capability = any(array['admin.read','support.read','notes.read','diagnostics.read'])
    when 'schedule_editor' then p_capability = any(array['admin.read','schedule.publish'])
    when 'communications_editor' then p_capability = any(array['admin.read','communications.publish','communications.send','diagnostics.read'])
    when 'moderator' then p_capability = any(array['admin.read','moderation.write','support.read'])
    else false end, false);
$$;
revoke all on function public.admin_has_capability(text) from public, anon;
grant execute on function public.admin_has_capability(text) to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select public.admin_has_capability('admin.read');
$$;
create or replace function public.can_write_config()
returns boolean language sql stable security definer set search_path=public as $$
  select public.admin_has_capability('system.publish');
$$;
revoke all on function public.is_admin(), public.can_write_config() from public, anon;
grant execute on function public.is_admin(), public.can_write_config() to authenticated;

-- Serialise grants/removals so simultaneous last-admin changes cannot both pass.
-- New preset assignment is deliberately deferred until its scoped UI is ready.
create or replace function public.admin_set_role(p_user_id text, p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(611041210);
  if not public.admin_has_capability('roles.manage') then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if p_user_id is null or btrim(p_user_id)='' or p_role is null or p_role not in ('monitor','superadmin') then
    raise exception 'A user and currently enabled role are required' using errcode='22023';
  end if;
  if p_role <> 'superadmin' and exists(select 1 from public.admins where user_id=p_user_id and role='superadmin')
    and (select count(*) from public.admins where role='superadmin') <= 1 then
    raise exception 'Cannot demote the last superadmin' using errcode='23514';
  end if;
  insert into public.admins(user_id,role,added_by) values(p_user_id,p_role,auth.jwt()->>'sub')
    on conflict(user_id) do update set role=excluded.role,added_by=excluded.added_by;
  insert into public.admin_audit_logs(admin_id,action,details)
    values(auth.jwt()->>'sub','admin_role_changed',jsonb_build_object('user_id',p_user_id,'role',p_role));
end;
$$;
create or replace function public.admin_remove_role(p_user_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(611041210);
  if not public.admin_has_capability('roles.manage') then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if exists(select 1 from public.admins where user_id=p_user_id and role='superadmin')
    and (select count(*) from public.admins where role='superadmin') <= 1 then
    raise exception 'Cannot remove the last superadmin' using errcode='23514';
  end if;
  delete from public.admins where user_id=p_user_id;
  if found then insert into public.admin_audit_logs(admin_id,action,details)
    values(auth.jwt()->>'sub','admin_role_removed',jsonb_build_object('user_id',p_user_id)); end if;
end;
$$;
revoke all on function public.admin_set_role(text,text), public.admin_remove_role(text) from public,anon;
grant execute on function public.admin_set_role(text,text), public.admin_remove_role(text) to authenticated;

-- Every successful config mutation gets an authoritative, atomic server record.
-- Values remain in private publication history; the general log records keys.
create or replace function public.admin_audit_config_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.admin_audit_logs(admin_id,action,details) values(
    coalesce(auth.jwt()->>'sub','service:configuration'), 'config_mutation',
    jsonb_build_object('operation',tg_op,'id',new.id,
      'keys',(select coalesce(jsonb_agg(key),'[]') from jsonb_object_keys(coalesce(new.flags,'{}')) key)));
  return new;
end;
$$;
create trigger audit_config_mutation after insert or update on public.system_config
for each row execute function public.admin_audit_config_mutation();

-- Browser events cannot impersonate authoritative server mutation records.
revoke insert,update,delete on public.admin_audit_logs from anon,authenticated;
create or replace function public.admin_record_event(p_action text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_has_capability('admin.read') then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_action is null or length(p_action) not between 1 and 100 or octet_length(p_details::text)>10000 then
    raise exception 'Invalid event' using errcode='22023';
  end if;
  insert into public.admin_audit_logs(admin_id,action,details)
    values(auth.jwt()->>'sub','interaction:'||p_action,coalesce(p_details,'{}'));
end;
$$;
revoke all on function public.admin_record_event(text,jsonb) from public,anon;
grant execute on function public.admin_record_event(text,jsonb) to authenticated;
alter table public.admin_audit_logs enable row level security;
grant select on public.admin_audit_logs to authenticated;
drop policy if exists "Admins can read admin_audit_logs" on public.admin_audit_logs;
create policy "Admins can read admin_audit_logs" on public.admin_audit_logs for select to authenticated using(public.admin_has_capability('diagnostics.read'));

create or replace function public.admin_audit_privileged_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb;
begin
  -- Ordinary student writes and cron operations keep their existing behaviour.
  -- An admin intervention carries a signed subject, even through definer RPCs.
  if public.is_admin() then
    row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
    insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','admin_table_mutation',
      jsonb_build_object('table',tg_table_name,'operation',tg_op,'id',coalesce(row_data->'id',row_data->'user_id'),'user_id',row_data->'user_id'));
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
do $$
declare name text;
begin
  foreach name in array array['schedule_drafts','schedule_versions','schedule_templates',
    'app_controls','app_controls_drafts','app_controls_versions','admin_feedback_triage',
    'admin_handoff_notes','pet_state','profiles','share_codes','board_posts','board_comments','polls','group_messages'] loop
    if to_regclass('public.'||name) is not null then
      execute format('create trigger audit_admin_mutation after insert or update or delete on public.%I for each row execute function public.admin_audit_privileged_mutation()',name);
    end if;
  end loop;
end $$;

-- These legacy no-argument SECURITY DEFINER feeds originally relied on the
-- page's visibility. Keep their result shapes, but move implementations behind
-- authenticated capability wrappers. Missing optional feeds are skipped.
create schema if not exists admin_internal;
revoke all on schema admin_internal from public,anon,authenticated;
do $$
declare entry record; result_type text; statement text; capability text; definition record; function_id oid;
begin
  for entry in select p.oid,p.proname,p.proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.pronargs=0 and p.proname in ('get_admin_stats','get_push_broadcast_stats','get_cron_health',
      'get_push_delivery_diagnostics','admin_attendance_coverage','admin_attendance_risk','admin_feature_usage_trend','admin_pet_overview')
  loop
    result_type := pg_get_function_result(entry.oid);
    capability:=case when entry.proname='admin_pet_overview' then 'system.publish' else 'diagnostics.read' end;
    execute format('alter function public.%I() set schema admin_internal',entry.proname);
    execute format('revoke all on function admin_internal.%I() from public,anon,authenticated',entry.proname);
    statement := case when entry.proretset then format('return query select * from admin_internal.%I();',entry.proname)
      else format('return admin_internal.%I();',entry.proname) end;
    execute format('create function public.%I() returns %s language plpgsql security definer set search_path=public as $body$ begin if not public.admin_has_capability(%L) then raise exception ''Required admin capability missing'' using errcode=''42501''; end if; %s end; $body$',entry.proname,result_type,capability,statement);
    execute format('revoke all on function public.%I() from public,anon',entry.proname);
    execute format('grant execute on function public.%I() to authenticated',entry.proname);
  end loop;
  -- These feeds have arguments; preserve their public argument names/defaults.
  for definition in select * from (values
    ('admin_get_presence_history','integer','p_days integer default 30','support.read'),
    ('admin_get_pet_state','text','p_user_id text','system.publish')
  ) as definitions(name,arg_type,args,required_capability) loop
    function_id:=to_regprocedure(format('public.%I(%s)',definition.name,definition.arg_type));
    if function_id is null then continue; end if;
    result_type:=pg_get_function_result(function_id);
    execute format('alter function public.%I(%s) set schema admin_internal',definition.name,definition.arg_type);
    execute format('revoke all on function admin_internal.%I(%s) from public,anon,authenticated',definition.name,definition.arg_type);
    execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path=public as $body$ begin if not public.admin_has_capability(%L) then raise exception ''Required admin capability missing'' using errcode=''42501''; end if; return query select * from admin_internal.%I($1); end; $body$',definition.name,definition.args,result_type,definition.required_capability,definition.name);
    execute format('revoke all on function public.%I(%s) from public,anon',definition.name,definition.arg_type);
    execute format('grant execute on function public.%I(%s) to authenticated',definition.name,definition.arg_type);
  end loop;
end $$;
commit;
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
begin;
alter table public.admin_publication_drafts drop constraint admin_publication_drafts_domain_fkey;
alter table public.admin_publication_drafts add constraint workspace_draft_domain_check check(domain in ('schedule','communications','system','mess','navigation','dashboard'));
do $$ begin
  if to_regclass('public.app_controls_drafts') is not null then
    insert into public.admin_publication_drafts(user_id,domain,payload,base_payload,base_revision,draft_revision)
    select d.updated_by,d.section,d.payload,
      coalesce((select v.payload->d.section from public.app_controls_versions v where v.revision=d.base_revision),case when c.revision=d.base_revision then c.payload->d.section end,'null'::jsonb),d.base_revision,1
    from public.app_controls_drafts d cross join public.app_controls c where c.id='global' and exists(select 1 from public.admins a where a.user_id=d.updated_by)
    on conflict do nothing;
    insert into public.admin_private_config_archive(source_id,payload)
      select 'legacy-control-draft:'||section,to_jsonb(d) from public.app_controls_drafts d;
    delete from public.app_controls_drafts;
  end if;
end $$;
create function public.admin_load_workspace_draft(p_domain text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return (select to_jsonb(d) from public.admin_publication_drafts d where user_id=auth.jwt()->>'sub' and domain=p_domain);
end $$;
create function public.admin_save_workspace_draft(p_domain text,p_payload jsonb,p_base jsonb,p_base_revision bigint,p_draft_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved public.admin_publication_drafts; actor text:=auth.jwt()->>'sub'; capability text;
begin
  capability:=case when p_domain in ('mess','navigation','dashboard') then 'system.publish' else p_domain||'.publish' end;
  if not public.admin_has_capability(capability) then raise exception 'Draft write permission required' using errcode='42501'; end if;
  if p_base_revision is null or p_base_revision<0 or p_draft_revision is null or p_draft_revision<0 then raise exception 'Valid draft revisions required' using errcode='22023'; end if;
  -- A comparison base may predate today's schema; never republish it without
  -- validating the merged proposal. Keep it bounded and free of private keys.
  if p_base is null or octet_length(p_base::text)>1000000 or public.admin_strip_private_config(p_base) is distinct from p_base then raise exception 'Invalid comparison base' using errcode='22023'; end if;
  if p_domain in ('mess','navigation','dashboard') then
    perform public.validate_app_controls(p_domain,p_payload);
  else
    perform public.admin_validate_publication(p_domain,p_payload);
  end if;
  insert into public.admin_publication_drafts(user_id,domain,payload,base_payload,base_revision,draft_revision)
    values(actor,p_domain,p_payload,p_base,p_base_revision,0) on conflict(user_id,domain) do nothing;
  select * into saved from public.admin_publication_drafts where user_id=actor and domain=p_domain for update;
  if saved.draft_revision<>p_draft_revision then raise exception 'This draft changed in another tab. Your current edits are preserved. Reload the saved draft before retrying.' using errcode='40001'; end if;
  update public.admin_publication_drafts set payload=p_payload,base_payload=p_base,base_revision=p_base_revision,
    draft_revision=draft_revision+1,updated_at=clock_timestamp() where user_id=actor and domain=p_domain returning * into saved;
  return to_jsonb(saved);
end $$;
create function public.admin_discard_workspace_draft(p_domain text,p_draft_revision bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_has_capability(case when p_domain in ('mess','navigation','dashboard') then 'system.publish' else p_domain||'.publish' end) then raise exception 'Draft write permission required' using errcode='42501'; end if;
  delete from public.admin_publication_drafts where user_id=auth.jwt()->>'sub' and domain=p_domain and draft_revision=p_draft_revision;
  if not found and exists(select 1 from public.admin_publication_drafts where user_id=auth.jwt()->>'sub' and domain=p_domain) then raise exception 'Draft changed in another tab. Reload first.' using errcode='40001'; end if;
end $$;
revoke all on function public.admin_load_workspace_draft(text),public.admin_save_workspace_draft(text,jsonb,jsonb,bigint,bigint),public.admin_discard_workspace_draft(text,bigint) from public,anon;
grant execute on function public.admin_load_workspace_draft(text),public.admin_save_workspace_draft(text,jsonb,jsonb,bigint,bigint),public.admin_discard_workspace_draft(text,bigint) to authenticated;
create or replace function public.admin_save_controls_draft(p_section text,p_payload jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path=public as $$
begin raise exception 'Reload Admin Tools to use identity-scoped, versioned private drafts.' using errcode='22023'; end $$;
commit;
begin;
create table public.admin_content_reports(
  id uuid primary key default gen_random_uuid(), target_type text not null check(target_type in ('board_post','board_comment','poll','group_message')),
  target_id uuid not null, reporter_id text not null, reason text not null, detail text not null default '',
  evidence jsonb not null, status text not null default 'open' check(status in ('open','resolved','dismissed')),
  owner_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(target_type,target_id,reporter_id)
);
create table public.admin_moderation_decisions(
  id bigint generated always as identity primary key, target_type text not null,target_id uuid not null,
  action text not null, reason text not null, actor text not null, created_at timestamptz not null default now()
);
create table public.admin_content_states(target_type text not null,target_id uuid not null,previous_status text,primary key(target_type,target_id));
alter table public.admin_content_reports enable row level security;
alter table public.admin_moderation_decisions enable row level security;
alter table public.admin_content_states enable row level security;
revoke all on public.admin_content_reports,public.admin_moderation_decisions,public.admin_content_states from public,anon,authenticated;
create index admin_reports_queue_idx on public.admin_content_reports(status,created_at,id);
create index admin_decisions_target_idx on public.admin_moderation_decisions(target_type,target_id,id desc);
alter table public.polls add column moderation_hidden boolean not null default false;
alter table public.group_messages add column moderation_hidden boolean not null default false;

create function admin_internal.content_source(p_type text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; table_name text;
begin
  table_name:=case p_type when 'board_post' then 'board_posts' when 'board_comment' then 'board_comments' when 'poll' then 'polls' when 'group_message' then 'group_messages' end;
  if table_name is null then raise exception 'Unknown report target' using errcode='22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1',table_name) into result using p_id;
  if result is null then raise exception 'Content is no longer available' using errcode='22023'; end if;
  return result;
end $$;
create function admin_internal.report_group_member(p_group text,p_user text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.study_group_invites i where i.group_id=p_group and i.enabled and
    (i.owner_id=p_user or exists(select 1 from public.study_group_join_requests r where r.group_id=p_group and r.requester_id=p_user and r.status='approved')
      or exists(select 1 from public.profiles p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.groups)='array' then p.groups else '[]' end) g where p.user_id=i.owner_id and g->>'id'=p_group and coalesce(g->>'isReceived','false')<>'true' and coalesce(g->'cloudMemberIds','[]')?p_user)));
$$;
create function admin_internal.set_content_hidden(p_type text,p_id uuid,p_hidden boolean) returns void language plpgsql security definer set search_path=public as $$
declare source jsonb; previous text;
begin
  source:=admin_internal.content_source(p_type,p_id);
  perform pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
  if p_type='board_post' then
    if p_hidden then
      insert into public.admin_content_states values(p_type,p_id,case when source->>'status'='removed' then 'open' else source->>'status' end) on conflict do nothing;
      update public.board_posts set status='removed' where id=p_id;
    else
      select previous_status into previous from public.admin_content_states where target_type=p_type and target_id=p_id;
      update public.board_posts set status=coalesce(previous,'open') where id=p_id;
      delete from public.admin_content_states where target_type=p_type and target_id=p_id;
    end if;
  elsif p_type='board_comment' then update public.board_comments set hidden=p_hidden where id=p_id;
  elsif p_type='poll' then update public.polls set moderation_hidden=p_hidden where id=p_id;
  elsif p_type='group_message' then update public.group_messages set moderation_hidden=p_hidden where id=p_id;
  end if;
end $$;
revoke all on function admin_internal.content_source(text,uuid),admin_internal.report_group_member(text,text),admin_internal.set_content_hidden(text,uuid,boolean) from public,anon,authenticated;

create function public.report_content(p_type text,p_id uuid,p_reason text,p_detail text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare source jsonb; reporter text:=auth.jwt()->>'sub'; report_id uuid; evidence jsonb; count_open integer;
begin
  if reporter is null then raise exception 'Sign in to report content' using errcode='42501'; end if;
  if p_reason is null or p_reason not in ('spam','harassment','inappropriate','misleading','other') or p_detail is null or length(p_detail)>1000 then raise exception 'Choose a valid report reason and a detail up to 1000 characters' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
  source:=admin_internal.content_source(p_type,p_id);
  if (p_type='group_message' or (p_type='poll' and source->>'scope'='group')) and not admin_internal.report_group_member(source->>'group_id',reporter) then
    raise exception 'Verified group membership is required to report this content' using errcode='42501';
  end if;
  evidence:=jsonb_build_object('id',p_id,'text',left(coalesce(source->>'title',source->>'question','')||E'\n'||coalesce(source->>'body',source->>'text',''),2000),
    'author',coalesce(source->>'user_id',source->>'created_by',source->>'from_id'),'group_id',source->>'group_id','status',source->>'status');
  insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,detail,evidence) values(p_type,p_id,reporter,p_reason,p_detail,evidence)
    on conflict(target_type,target_id,reporter_id) do nothing returning id into report_id;
  if report_id is null then select id into report_id from public.admin_content_reports where target_type=p_type and target_id=p_id and reporter_id=reporter; end if;
  select count(*) into count_open from public.admin_content_reports where target_type=p_type and target_id=p_id and status='open';
  if count_open>=3 then perform admin_internal.set_content_hidden(p_type,p_id,true); end if;
  return report_id;
end $$;
create function public.admin_moderate_content(p_report uuid,p_action text,p_reason text,p_owner text default null)
returns void language plpgsql security definer set search_path=public as $$
declare report public.admin_content_reports;
begin
  if not public.admin_has_capability('moderation.write') then raise exception 'Moderation permission required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('hide','restore','dismiss','resolve','assign') or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'An action and decision reason are required' using errcode='22023'; end if;
  if p_action='assign' and p_owner is not null and not exists(select 1 from public.admins where user_id=p_owner and role in ('moderator','superadmin')) then raise exception 'Choose an authorized moderator' using errcode='22023'; end if;
  select * into report from public.admin_content_reports where id=p_report;
  if not found then raise exception 'Report unavailable' using errcode='22023'; end if;
  -- Serialise decisions and automatic hiding for the same content.
  perform pg_advisory_xact_lock(hashtextextended(report.target_type||report.target_id::text,0));
  select * into report from public.admin_content_reports where id=p_report for update;
  if p_action in ('hide','restore') then perform admin_internal.set_content_hidden(report.target_type,report.target_id,p_action='hide'); end if;
  update public.admin_content_reports set status=case when p_action='dismiss' then 'dismissed' when p_action in ('resolve','restore') then 'resolved' else status end,
    owner_id=case when p_action='assign' then p_owner else owner_id end,updated_at=clock_timestamp() where target_type=report.target_type and target_id=report.target_id;
  insert into public.admin_moderation_decisions(target_type,target_id,action,reason,actor) values(report.target_type,report.target_id,p_action,p_reason,auth.jwt()->>'sub');
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','content_moderated',jsonb_build_object('report',p_report,'action',p_action,'target_type',report.target_type,'target_id',report.target_id));
end $$;
create function public.admin_report_queue(p_status text default 'open',p_before timestamptz default now(),p_limit integer default 30,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not (public.admin_has_capability('moderation.write') or coalesce(public.admin_role()='monitor',false)) then raise exception 'Moderation access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
    select id,target_type,target_id,reason,detail,evidence,status,owner_id,created_at,
      (select coalesce(jsonb_agg(jsonb_build_object('action',d.action,'reason',d.reason,'actor',d.actor,'at',d.created_at) order by d.id desc),'[]') from (select * from public.admin_moderation_decisions where target_type=c.target_type and target_id=c.target_id order by id desc limit 20) d) history
    from public.admin_content_reports c where (p_status='all' or status=p_status) and (p_before_id is null and created_at<=p_before or p_before_id is not null and (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit least(greatest(p_limit,1),50)
  ) r);
end $$;

-- Registered moderation authority replaces the old self-stamped email helper.
create or replace function public.is_termflow_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.admin_has_capability('moderation.write'); $$;
-- Restrictive policies compose with existing membership/ownership policies.
create policy moderation_poll_visibility on public.polls as restrictive for select to authenticated using(not moderation_hidden or created_by=auth.jwt()->>'sub');
create policy moderation_message_visibility on public.group_messages as restrictive for select to authenticated using(not moderation_hidden or from_id=auth.jwt()->>'sub');

-- Preserve legacy reports privately before clearing public reporter identities.
insert into public.admin_private_config_archive(source_id,payload)
select 'legacy-board-reporters:'||id,jsonb_build_object('type','board_post','reported_by',reported_by) from public.board_posts where reported_by<>'[]'::jsonb;
insert into public.admin_private_config_archive(source_id,payload)
select 'legacy-comment-reporters:'||id,jsonb_build_object('type','board_comment','reported_by',reported_by) from public.board_comments where reported_by<>'[]'::jsonb;
insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,evidence)
select 'board_post',b.id,reporter#>>'{}','legacy',jsonb_build_object('id',b.id,'text',left(b.title||E'\n'||coalesce(b.body,''),2000),'author',b.user_id)
from public.board_posts b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.reported_by)='array' then b.reported_by else '[]' end) reporter where jsonb_typeof(reporter)='string' on conflict do nothing;
insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,evidence)
select 'board_comment',b.id,reporter#>>'{}','legacy',jsonb_build_object('id',b.id,'text',left(b.body,2000),'author',b.user_id)
from public.board_comments b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.reported_by)='array' then b.reported_by else '[]' end) reporter where jsonb_typeof(reporter)='string' on conflict do nothing;
update public.board_posts set reported_by='[]'; update public.board_comments set reported_by='[]';
create or replace function public.report_board_post(p_post_id uuid) returns integer language plpgsql security definer set search_path=public as $$
begin perform public.report_content('board_post',p_post_id,'other','Reported from an older app version'); return (select count(*)::integer from public.admin_content_reports where target_type='board_post' and target_id=p_post_id); end $$;
create or replace function public.report_board_comment(p_comment_id uuid) returns integer language plpgsql security definer set search_path=public as $$
begin perform public.report_content('board_comment',p_comment_id,'other','Reported from an older app version'); return (select count(*)::integer from public.admin_content_reports where target_type='board_comment' and target_id=p_comment_id); end $$;

create function public.admin_guard_moderation_fields() returns trigger language plpgsql as $$
begin
  if current_user in ('anon','authenticated') then
    if to_jsonb(new)->'reported_by' is not null and to_jsonb(new)->'reported_by'<>'[]'::jsonb then raise exception 'Report identities are private' using errcode='42501'; end if;
    if tg_op='UPDATE' and not public.admin_has_capability('moderation.write') and
      ((to_jsonb(old)->'moderation_hidden') is distinct from (to_jsonb(new)->'moderation_hidden')
       or (to_jsonb(old)->'hidden') is distinct from (to_jsonb(new)->'hidden')
       or (to_jsonb(old)->>'status'='removed' and to_jsonb(new)->>'status'<>'removed')) then raise exception 'Moderation permission required' using errcode='42501'; end if;
  end if; return new;
end $$;
create trigger protect_board_moderation before insert or update on public.board_posts for each row execute function public.admin_guard_moderation_fields();
create trigger protect_comment_moderation before insert or update on public.board_comments for each row execute function public.admin_guard_moderation_fields();
create trigger protect_poll_moderation before insert or update on public.polls for each row execute function public.admin_guard_moderation_fields();
create trigger protect_message_moderation before insert or update on public.group_messages for each row execute function public.admin_guard_moderation_fields();
revoke all on function public.report_content(text,uuid,text,text),public.admin_moderate_content(uuid,text,text,text),public.admin_report_queue(text,timestamptz,integer,uuid) from public,anon;
grant execute on function public.report_content(text,uuid,text,text),public.admin_moderate_content(uuid,text,text,text),public.admin_report_queue(text,timestamptz,integer,uuid) to authenticated;
commit;
-- Scoped publication and moderation are available before grants are enabled.
begin;
create or replace function public.admin_set_role(p_user_id text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(611041210);
  if not public.admin_has_capability('roles.manage') then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if p_user_id is null or btrim(p_user_id)='' or p_role is null or p_role not in ('monitor','superadmin','schedule_editor','communications_editor','moderator') then raise exception 'A user and valid role are required' using errcode='22023'; end if;
  if p_role<>'superadmin' and exists(select 1 from public.admins where user_id=p_user_id and role='superadmin') and (select count(*) from public.admins where role='superadmin')<=1 then raise exception 'Cannot demote the last superadmin' using errcode='23514'; end if;
  insert into public.admins(user_id,role,added_by) values(p_user_id,p_role,auth.jwt()->>'sub') on conflict(user_id) do update set role=excluded.role,added_by=excluded.added_by;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','admin_role_changed',jsonb_build_object('user_id',p_user_id,'role',p_role));
end $$;
commit;
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
begin;
create index if not exists admin_audit_page_idx on public.admin_audit_logs(created_at desc,id desc);
create index if not exists admin_feedback_page_idx on public.feedback(created_at desc,id desc);
create function public.admin_operational_search(p_dataset text,p_query text default '',p_from timestamptz default now()-interval '30 days',p_to timestamptz default now(),p_before timestamptz default null,p_before_key text default null,p_status text default null,p_actor text default null,p_export boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare table_name text; fields text[]; capability text; time_key text; id_key text; sql_text text; source_sql text; output jsonb; cap integer:=case when p_export then 1000 else 50 end;
begin
  case p_dataset
    when 'audit' then table_name:='admin_audit_logs'; fields:=array['id','admin_id','action','created_at']; capability:='diagnostics.read';time_key:='created_at';id_key:='id';
    when 'feedback' then table_name:='feedback'; fields:=array['id','user_id','message','status','owner_id','severity','created_at'];capability:='support.read';time_key:='created_at';id_key:='id';
    when 'versions' then table_name:='admin_publication_versions';fields:=array['id','domain','revision','created_by','created_at'];capability:='admin.read';time_key:='created_at';id_key:='id';
    when 'students' then table_name:='profiles';fields:=array['user_id','name','email','last_seen_at','courses'];capability:='support.read';time_key:='last_seen_at';id_key:='user_id';
    when 'notifications' then table_name:='notifications';fields:=array['id','user_id','type','title','push_delivery_state','created_at'];capability:='diagnostics.read';time_key:='created_at';id_key:='id';
    else raise exception 'Dataset is not allowlisted' using errcode='22023';
  end case;
  if not public.admin_has_capability(capability) then raise exception 'Dataset permission required' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' or length(coalesce(p_query,''))>200 then raise exception 'Choose a range of at most 366 days and a search up to 200 characters' using errcode='22023'; end if;
  -- Table and field names come exclusively from the fixed mapping above. Search
  -- uses bound parameters and only the projected, authorized fields.
  source_sql:=case when p_dataset='feedback' then 'select to_jsonb(t)||jsonb_build_object(''status'',coalesce(triage.status,t.status),''owner_id'',triage.owner_id,''severity'',triage.severity) raw from public.feedback t left join public.admin_feedback_triage triage on triage.feedback_id=t.id::text'
    when p_dataset='students' then 'select to_jsonb(t)||jsonb_build_object(''name'',coalesce(nullif(to_jsonb(t)->''name'',''null''::jsonb),t.courses->''_name'')) raw from public.profiles t'
    else format('select to_jsonb(t) raw from public.%I t',table_name) end;
  sql_text:=format($query$
    with source as(%s), projected as(
      select raw->>$1 key,coalesce((raw->>$2)::timestamptz,'1970-01-01'::timestamptz) at,
        (select coalesce(jsonb_object_agg(k,raw->k),'{}') from unnest($3::text[]) k) data from source
    ), filtered as(select * from projected where (at >= $4 and at < $5 or $11='students' and at='1970-01-01'::timestamptz)
      and (coalesce($6,'')='' or strpos(lower(data::text),lower($6))>0)
      and ($7 is null or data->>'status'=$7) and ($8 is null or coalesce(data->>'admin_id',data->>'created_by')=$8)),
    page as(select * from filtered where $9::timestamptz is null or (at,key)<($9,$10) order by at desc,key desc limit $12+1)
    select jsonb_build_object('total',(select count(*) from filtered),'has_more',(select count(*)>$12 from page),
      'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by at desc,key desc),'[]') from (select * from page order by at desc,key desc limit $12) r))
  $query$,source_sql);
  execute sql_text into output using id_key,time_key,fields,p_from,p_to,p_query,p_status,p_actor,p_before,p_before_key,p_dataset,cap;
  if p_dataset in ('students','feedback') or p_export then
    insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub',case when p_export then 'data_export' else 'data_lookup' end,jsonb_build_object('dataset',p_dataset,'searched',coalesce(p_query,'')<>'','rows',jsonb_array_length(output->'rows')));
  end if;
  return output;
end $$;
revoke all on function public.admin_operational_search(text,text,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from public,anon;
grant execute on function public.admin_operational_search(text,text,timestamptz,timestamptz,timestamptz,text,text,text,boolean) to authenticated;
create function public.admin_publication_version(p_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_has_capability('admin.read') then raise exception 'Admin access required' using errcode='42501'; end if;
  return (select to_jsonb(v) from public.admin_publication_versions v where id=p_id);
end $$;
revoke all on function public.admin_publication_version(bigint) from public,anon;
grant execute on function public.admin_publication_version(bigint) to authenticated;
commit;
begin;
create function public.admin_student_support(p_user_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare profile jsonb; subscribed integer; course_count integer; feedback_rows jsonb; interventions jsonb;
begin
  if not public.admin_has_capability('support.read') then raise exception 'Student support permission required' using errcode='42501'; end if;
  if p_user_id is null or length(p_user_id) not between 1 and 256 then raise exception 'A student ID is required' using errcode='22023'; end if;
  select jsonb_build_object('user_id',p.user_id,'name',coalesce(nullif(to_jsonb(p)->'name','null'::jsonb),p.courses->'_name'),'email',to_jsonb(p)->'email','courses',p.courses,'last_seen_at',to_jsonb(p)->'last_seen_at') into profile from public.profiles p where p.user_id=p_user_id;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','student_support_lookup',jsonb_build_object('user_id',p_user_id,'available',profile is not null));
  if profile is null then return jsonb_build_object('available',false,'user_id',p_user_id); end if;
  select count(*) into subscribed from public.push_subscriptions where user_id=p_user_id;
  select count(*) into course_count from jsonb_each(case when jsonb_typeof(profile->'courses')='object' then profile->'courses' else '{}' end) where left(key,1)<>'_';
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into feedback_rows from (select f.id,f.message,coalesce(t.status,f.status,'pending') status,t.owner_id,t.severity,f.created_at from public.feedback f left join public.admin_feedback_triage t on t.feedback_id=f.id::text where f.user_id=p_user_id order by f.created_at desc limit 10) r;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into interventions from (select id,action,admin_id,created_at from public.admin_audit_logs where (details->>'user_id'=p_user_id or details->>'target_user'=p_user_id) and action not in ('student_support_lookup','notification_lookup','data_lookup') and action not like 'interaction:%' order by created_at desc,id desc limit 10) r;
  return jsonb_build_object('available',true,'profile',profile,'course_count',course_count,'push_devices',subscribed,'feedback',feedback_rows,'interventions',interventions,
    'push_preferences',(select jsonb_build_object('class_reminders',to_jsonb(p)->'class_reminders','cancellation_alerts',p.cancellation_alerts,'types',p.prefs) from public.push_prefs p where p.user_id=p_user_id),'checked_at',clock_timestamp());
end $$;
revoke all on function public.admin_student_support(text) from public,anon;
grant execute on function public.admin_student_support(text) to authenticated;
commit;
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
-- Reuse Campus Board ownership, image storage, comments, and moderation.
begin;
alter table public.board_posts drop constraint if exists board_posts_kind_check;
alter table public.board_posts add constraint board_posts_kind_check
  check (kind in ('lost','found','sell','ask','celebrate'));
-- Celebration posts do not carry marketplace prices or phone/contact fields.
alter table public.board_posts add constraint board_celebration_fields_check
  check (kind <> 'celebrate' or (price is null and contact is null));
commit;
