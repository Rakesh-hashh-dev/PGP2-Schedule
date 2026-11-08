begin;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
update public.profiles set courses=courses||'{"_fixtureUpdated":true}' where user_id='student-one';
insert into public.feedback(id,user_id,message,status,created_at) values('ffffffff-ffff-ffff-ffff-ffffffffffff','student-one','Support fixture','pending',now()-interval '1 minute');
insert into public.admin_feedback_triage(feedback_id,status,owner_id,severity) values('ffffffff-ffff-ffff-ffff-ffffffffffff','resolved','admin-one','normal');
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ declare result jsonb; begin
  result:=public.admin_student_support('student-one');
  if result->>'available'<>'true' or result->>'course_count'<>'1' or result->>'push_devices'<>'1' then raise exception 'Support summary incorrect: %',result; end if;
  if result#>>'{feedback,0,status}'<>'resolved' then raise exception 'Triage status ignored'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'interventions') entry where entry->>'action'='admin_table_mutation') then raise exception 'Profile interventions omitted'; end if;
  if result::text like '%Current private note%' then raise exception 'Summary leaked note content'; end if;
  if public.admin_student_support('no-profile')->>'available'<>'false' then raise exception 'Missing profile disguised'; end if;
  if public.admin_student_support('student-unconfigured')->>'course_count'<>'0' then raise exception 'Unconfigured student not handled'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
do $$ begin
  begin perform public.admin_student_support('student-two'); raise exception 'Student support access allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Support summary, saved enrollment, subscription counts, triage status, missing data and permission checks passed' as result;
