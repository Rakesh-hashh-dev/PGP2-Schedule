begin;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
do $$ declare payload jsonb; preview jsonb; result jsonb; day text:=to_char((now() at time zone 'Asia/Kolkata')::date+1,'YYYY-MM-DD'); begin
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','B203')))));
  preview:=public.admin_preview_schedule_notices(payload,0,'Room changed');
  if preview->>'students'<>'2' or preview->>'push_subscribers'<>'1' then raise exception 'Recipient matching incorrect: %',preview; end if;
  result:=public.admin_publish_schedule_with_notice(payload,0,(preview->>'id')::uuid);
  if result->>'notice_count'<>'2' then raise exception 'Inbox fanout incorrect: %',result; end if;
  begin perform public.admin_publish_schedule_with_notice(payload,0,(preview->>'id')::uuid); raise exception 'Preview reused'; exception when serialization_failure then null; end;
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','C303')))));
  preview:=public.admin_preview_schedule_notices(payload,1,null);
  update public.profiles set courses='{}' where user_id='student-three';
  begin perform public.admin_publish_schedule_with_notice(payload,1,(preview->>'id')::uuid); raise exception 'Changed audience silently accepted'; exception when serialization_failure then null; end;
  if (select revision from public.admin_publication_state where domain='schedule')<>1 then raise exception 'Rejected audience changed config'; end if;
  update public.profiles set courses='{"BMD_A":"A"}' where user_id='student-three';
  -- An existing automatic cancellation and the optional publication notice share
  -- the canonical cancellation key, so they cannot produce duplicate inbox rows.
  insert into public.notifications(user_id,type,title,dedup_key) values('student-one','class_cancelled','Existing alert','cancel:'||day||':BMD:A@09:00');
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,jsonb_build_object('BMD_A@09:00',jsonb_build_object('type','cancelled')))));
  preview:=public.admin_preview_schedule_notices(payload,1,null);
  if preview->>'students'<>'1' then raise exception 'Cancellation preference ignored'; end if;
  result:=public.admin_publish_schedule_with_notice(payload,1,(preview->>'id')::uuid);
  if result->>'notice_count'<>'0' then raise exception 'Duplicate cancellation queued'; end if;
end $$;
create function pg_temp.fail_notice() returns trigger language plpgsql as $$ begin raise exception 'Inbox unavailable' using errcode='23514'; end $$;
create trigger test_notice_failure before insert on public.notifications for each row execute function pg_temp.fail_notice();
do $$ declare payload jsonb; preview jsonb; day text:=to_char((now() at time zone 'Asia/Kolkata')::date+1,'YYYY-MM-DD'); begin
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','D404')))));
  preview:=public.admin_preview_schedule_notices(payload,2,null);
  begin perform public.admin_publish_schedule_with_notice(payload,2,(preview->>'id')::uuid); raise exception 'Inbox failure ignored'; exception when check_violation then null; end;
  if (select revision from public.admin_publication_state where domain='schedule')<>2 then raise exception 'Failed inbox fanout published config'; end if;
end $$;
rollback;
select 'Verified audience, section/session matching, changed-cohort rejection, preferences, cancellation dedup and atomic fanout passed' as result;
