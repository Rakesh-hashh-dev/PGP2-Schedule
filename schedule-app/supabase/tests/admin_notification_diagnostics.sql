begin;
insert into public.notifications(id,user_id,type,title,created_at) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','student-one','admin_broadcast','A test notification',now()-interval '1 second');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
do $$ begin
  begin perform public.admin_notification_diagnostics(); raise exception 'Student diagnostics allowed'; exception when insufficient_privilege then null; end;
  begin update public.notifications set push_checked_at=now() where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; raise exception 'Student forged delivery evidence'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.notifications set push_delivery_state='delivered',delivered_push_at=now() where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_record_push_diagnostics('[{"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","attempted":2,"accepted":1}]');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ declare result jsonb; begin
  result:=public.admin_notification_diagnostics();
  if result->>'total'<>'3' or result->>'students'<>'2' or result->>'accepted'<>'2' then raise exception 'Diagnostic totals incorrect: %',result; end if;
  if not exists(select 1 from jsonb_array_elements(result->'rows') r where r->>'type'='health_alert' and r->>'state'='pending_or_unknown') then raise exception 'Unknown evidence mislabelled'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'rows') r where r->>'id'='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and r->>'push_attempted_devices'='2' and r->>'push_accepted_devices'='1') then raise exception 'Device evidence incorrect'; end if;
end $$;
reset role;
-- Inbox retention does not erase the bounded diagnostic event history.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$ declare iteration integer; last_event bigint; begin
  for iteration in 1..25 loop perform public.admin_record_push_diagnostics('[{"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","attempted":2,"accepted":1}]'); end loop;
  if (select count(*) from public.admin_notification_events where notification_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')<>20 then raise exception 'Per-notification event history unbounded'; end if;
  perform public.admin_record_push_diagnostics('[{"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","attempted":0,"accepted":0}]');
  select max(id) into last_event from public.admin_notification_events where notification_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  for iteration in 1..10 loop perform public.admin_record_push_diagnostics('[{"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","attempted":0,"accepted":0}]'); end loop;
  if last_event<>(select max(id) from public.admin_notification_events where notification_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') then raise exception 'Unchanged no-send checks inflated history'; end if;
end $$;
delete from public.notifications where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ begin
  if public.admin_notification_diagnostics()->>'total'<>'3' then raise exception 'Retained evidence lost'; end if;
end $$;
reset role;
rollback;
select 'All-type diagnostics, provider/device counts, unknown history, evidence protection and retention passed' as result;
