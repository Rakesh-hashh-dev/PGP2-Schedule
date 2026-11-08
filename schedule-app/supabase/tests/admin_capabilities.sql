begin;
insert into public.admins(user_id,role) values('schedule','schedule_editor'),('comms','communications_editor'),('moderator','moderator');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"schedule"}',true);
do $$ begin
  if not public.admin_has_capability('schedule.publish') or public.can_write_config() or public.admin_has_capability('notes.read') then raise exception 'Schedule permissions incorrect'; end if;
  if (select count(*) from public.system_config where id='global')<>1 then raise exception 'Published config unreadable'; end if;
  if exists(select 1 from public.admin_student_notes) then raise exception 'Editor read notes'; end if;
  update public.system_config set flags='{}' where id='global';
  if found then raise exception 'Editor whole-config write allowed'; end if;
  begin perform public.admin_set_role('student','superadmin'); raise exception 'Editor elevated role'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"comms"}',true);
do $$ begin
  if not public.admin_has_capability('communications.send') or public.admin_has_capability('schedule.publish') or public.can_write_config() then raise exception 'Communications permissions incorrect'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"moderator"}',true);
do $$ begin
  if not public.admin_has_capability('moderation.write') or public.admin_has_capability('roles.manage') then raise exception 'Moderator permissions incorrect'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
do $$ begin
  if public.is_admin() or public.can_write_config() or public.admin_has_capability('admin.read') then raise exception 'Student gained admin access'; end if;
  begin perform public.admin_record_event('forged','{}'); raise exception 'Student audit event allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_admin_stats(); raise exception 'Student stats access allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_cron_health(); raise exception 'Student cron access allowed'; exception when insufficient_privilege then null; end;
  begin perform admin_internal.get_admin_stats(); raise exception 'Internal stats bypass allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
do $$ begin
  if public.get_admin_stats()->>'total' <> '3' then raise exception 'Stats wrapper changed shape'; end if;
  if (select total from public.get_push_broadcast_stats()) <> 4 then raise exception 'Table wrapper changed shape'; end if;
  if (select job from public.get_cron_health()) <> 'dispatch' then raise exception 'Cron wrapper changed shape'; end if;
end $$;
select public.admin_set_role('admin-two','monitor');
do $$ begin
  begin perform public.admin_remove_role('admin-one'); raise exception 'Last admin removed'; exception when check_violation then null; end;
  begin perform public.admin_set_role('admin-one','monitor'); raise exception 'Last admin demoted'; exception when check_violation then null; end;
  begin perform public.admin_set_role('new','schedule_editor'); raise exception 'Premature editor grant allowed'; exception when invalid_parameter_value then null; end;
  begin insert into public.admin_audit_logs(admin_id,action) values('forged','config_mutation'); raise exception 'Forged authoritative audit allowed'; exception when insufficient_privilege then null; end;
end $$;
select public.admin_record_event('view','{"scope":"config"}');
update public.system_config set flags=flags||'{"enabled":false}' where id='global';
reset role;
do $$ begin
  if not exists(select 1 from public.admin_audit_logs where action='config_mutation' and admin_id='admin-one') then raise exception 'Missing authoritative config audit'; end if;
  if not exists(select 1 from public.admin_audit_logs where action='interaction:view' and admin_id='admin-one') then raise exception 'Client event actor not derived'; end if;
end $$;
-- Revocation applies to the very next server request, independent of UI state.
delete from public.admins where user_id='schedule';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"schedule"}',true);
do $$ begin
  if public.is_admin() or public.admin_has_capability('schedule.publish') then raise exception 'Revoked role retained authority'; end if;
end $$;
reset role;
rollback;
select 'Capability matrix, direct-write denial, audit integrity, revocation, last-Superadmin guards passed' as result;
