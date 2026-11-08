-- psql -v ON_ERROR_STOP=1 -f admin_private_notes.sql (after fixture + migration).
begin;
do $$ begin
  if (select body from public.admin_student_notes where user_id='student-one') <> 'Current private note' then raise exception 'Backfill lost note'; end if;
  if (select count(*) from public.admin_private_config_archive) <> 1 then raise exception 'Missing private archive'; end if;
  if (select flags::text like '%adminNotes%' from public.system_config where id='global') then raise exception 'Nested private note still public'; end if;
  if (select flags#>>'{scheduledConfigDeploys,0,flags,room}' from public.system_config where id='global') <> 'A101' then raise exception 'Unrelated setting changed'; end if;
  if public.admin_strip_private_config('[null,{},[],false,7,"value"]') <> '[null,{},[],false,7,"value"]'::jsonb then raise exception 'Scalar/array corruption'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.admin_student_notes; raise exception 'Anonymous note access allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_save_student_note('student-one','bad',1); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
do $$ begin
  if exists(select 1 from public.admin_student_notes) then raise exception 'Student read notes'; end if;
  begin perform public.admin_save_student_note('student-one','bad',1); raise exception 'Student write allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.admin_private_config_archive; raise exception 'Archive exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ begin
  if (select count(*) from public.admin_student_notes) <> 1 then raise exception 'Monitor cannot read'; end if;
  begin perform public.admin_save_student_note('student-one','bad',1); raise exception 'Monitor write allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
select public.admin_save_student_note('student-one','Updated private note',1);
do $$ begin
  begin perform public.admin_save_student_note('student-one','stale',1); raise exception 'Stale save allowed'; exception when serialization_failure then null; end;
  begin insert into public.admin_student_notes(user_id,updated_by) values('bypass','forged'); raise exception 'Direct write allowed'; exception when insufficient_privilege then null; end;
  begin update public.system_config set flags=flags||'{"configHistory":[{"flags":{"adminNotes":{"s":"restore leak"}}}]}'::jsonb where id='global'; raise exception 'Restore leak allowed'; exception when invalid_parameter_value then null; end;
  begin update public.system_config set flags=flags||'{"scheduledConfigDeploys":[{"flags":{"adminNotes":{"s":"schedule leak"}}}]}'::jsonb where id='global'; raise exception 'Schedule leak allowed'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if (select revision from public.admin_student_notes where user_id='student-one') <> 2 then raise exception 'Revision incorrect'; end if;
  if (select updated_by from public.admin_student_notes where user_id='student-one') <> 'admin-one' then raise exception 'Actor incorrect'; end if;
  if (select count(*) from public.admin_audit_logs where action='student_note_saved') <> 1 then raise exception 'Audit inconsistent'; end if;
  if exists(select 1 from public.admin_audit_logs where details::text like '%Updated private note%') then raise exception 'Audit includes body'; end if;
end $$;
-- A failed audit must roll back both the note and its revision.
create function pg_temp.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable' using errcode='23514'; end $$;
create trigger test_audit_failure before insert on public.admin_audit_logs for each row execute function pg_temp.fail_audit();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"admin-two"}',true);
do $$ begin
  begin perform public.admin_save_student_note('student-one','must roll back',2); raise exception 'Audit failure ignored'; exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  if (select body from public.admin_student_notes where user_id='student-one') <> 'Updated private note' then raise exception 'Failed audit changed note'; end if;
end $$;
rollback;
select 'Private-note migration, RLS, revisions, leak protection, and atomic audit passed' as result;
