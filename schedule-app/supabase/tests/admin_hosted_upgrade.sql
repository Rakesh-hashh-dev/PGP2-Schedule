begin;
select set_config('request.jwt.claims','{"sub":"upgrade-admin"}',true);
do $$ declare result jsonb; dataset text; report_id uuid; begin
 if exists(select 1 from public.system_config where flags::text like '%adminNotes%') then raise exception 'Private notes remain public'; end if;
 if not exists(select 1 from public.admin_student_notes where user_id='upgrade-student') then raise exception 'Private note backfill missing'; end if;
 if not public.admin_has_capability('roles.manage') then raise exception 'Superadmin lost access'; end if;
 if public.admin_load_workspace_draft('navigation')->>'user_id' is distinct from 'upgrade-admin' then raise exception 'Legacy draft lost author'; end if;
 if not exists(select 1 from public.admin_scheduled_publications where status='needs_review') then raise exception 'Legacy scheduled snapshot lost'; end if;
 result:=public.admin_load_publication('system');
 perform public.admin_publish_domain('system','{"flags":{"enableFriends":false}}',(result->>'revision')::bigint);
 result:=public.admin_student_support('upgrade-student');
 if result is null then raise exception 'Support unavailable'; end if;
 perform public.admin_notification_diagnostics(now()-interval '1 day',now()+interval '1 day');
 foreach dataset in array array['audit','feedback','versions','students','notifications'] loop
   result:=public.admin_operational_search(dataset);
   if result->'rows' is null then raise exception 'Search failed for %',dataset; end if;
 end loop;
 select id into report_id from public.admin_content_reports where target_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 if report_id is null then raise exception 'Legacy report migration failed'; end if;
 perform public.admin_moderate_content(report_id,'hide','Synthetic hide test');
 perform public.admin_moderate_content(report_id,'restore','Synthetic restore test');
 if (select status from public.board_posts where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')<>'open' then raise exception 'Restore failed'; end if;
 perform public.admin_report_queue();
end $$;
-- Scheduled fanout resolves the current cohort at execution, not the preview.
do $$ declare payload jsonb; preview jsonb; job_id uuid; result jsonb; day text:=to_char((now() at time zone 'Asia/Kolkata')::date+1,'YYYY-MM-DD'); begin
 payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','B203')))));
 preview:=public.admin_preview_schedule_notices(payload,0,'Synthetic scheduled update');
 if preview->>'students'<>'1' then raise exception 'Initial audience mismatch: %',preview; end if;
 job_id:=public.admin_schedule_domain('schedule',payload,0,now()+interval '1 minute',true,(preview->>'id')::uuid);
 insert into public.profiles(user_id,courses) values('upgrade-new-enrollment','{"BMD":"A"}');
 update public.admin_scheduled_publications set scheduled_at=now()-interval '1 minute' where id=job_id;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 result:=public.admin_apply_due_publications();
 if (select status from public.admin_scheduled_publications where id=job_id)<>'published' or
    (select actual_recipients from public.admin_scheduled_publications where id=job_id)<>2 or
    (select count(*) from public.notifications where type='schedule_change')<>2 then raise exception 'Scheduled cohort fanout failed: %',result; end if;
 perform public.admin_apply_due_publications();
 if (select count(*) from public.notifications where type='schedule_change')<>2 then raise exception 'Scheduler replay duplicated inbox'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"upgrade-monitor"}',true);
do $$ begin
 if public.admin_has_capability('system.publish') then raise exception 'Monitor can publish'; end if;
 begin perform public.admin_publish_domain('system','{"flags":{}}',1); raise exception 'Monitor publish accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Newly introduced roles cannot inherit legacy aggregate/pet/presence access.
insert into public.admins(user_id,role) values('upgrade-editor','schedule_editor'),('upgrade-comms','communications_editor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"upgrade-editor"}',true);
do $$ declare feed text; begin
 foreach feed in array array['admin_attendance_coverage','admin_attendance_risk','admin_feature_usage_trend','get_push_delivery_diagnostics','admin_pet_overview'] loop
   begin execute format('select * from public.%I()',feed); raise exception 'Schedule editor accessed %',feed; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.admin_get_presence_history(); raise exception 'Editor accessed presence'; exception when insufficient_privilege then null; end;
 begin perform public.admin_get_pet_state('upgrade-student'); raise exception 'Editor accessed pet'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"upgrade-comms"}',true);
do $$ begin
 perform public.admin_attendance_coverage();
 perform public.get_push_delivery_diagnostics();
 begin perform public.admin_get_presence_history(); raise exception 'Comms accessed support history'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"upgrade-monitor"}',true);
do $$ begin
 perform public.admin_get_presence_history();
 begin perform public.admin_pet_overview(); raise exception 'Monitor accessed companion admin'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"upgrade-student"}',true);
do $$ begin
 if exists(select 1 from public.admin_student_notes) then raise exception 'Student sees private notes'; end if;
 begin perform public.admin_load_workspace_draft('navigation'); raise exception 'Student accessed drafts'; exception when insufficient_privilege then null; end;
 begin perform public.admin_report_queue(); raise exception 'Student accessed queue'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Hosted public-schema upgrade smoke checks passed' as result;
