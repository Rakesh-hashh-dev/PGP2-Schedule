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
