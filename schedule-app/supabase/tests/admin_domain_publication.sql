begin;
insert into public.admins(user_id,role) values('schedule','schedule_editor'),('comms','communications_editor');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"schedule"}',true);
select public.admin_publish_domain('schedule','{"flags":{"classOverrides":{"2026-11-05":{"BMD_A@17:00":{"room":"B203"}}}}}',0);
do $$ begin
  begin perform public.admin_publish_domain('system','{"flags":{"enabled":false}}',0); raise exception 'Cross-domain publication allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_publish_domain('schedule','{"flags":{"enabled":false}}',1); raise exception 'Cross-domain payload allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_publish_domain('schedule','{"flags":{"classOverrides":{"2026-11-05":{"BMD_A":{"room":{}}}}}}',1); raise exception 'Invalid class field allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_publish_domain('schedule','{"flags":{}}',0); raise exception 'Stale publication allowed'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"comms"}',true);
select public.admin_publish_domain('communications','{"flags":{"scheduledAnnouncements":[]},"announcement":"A reviewed message"}',0);
do $$ begin
  if (select flags#>>'{classOverrides,2026-11-05,BMD_A@17:00,room}' from public.system_config where id='global')<>'B203' then raise exception 'Unrelated area overwritten'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"schedule"}',true);
select public.admin_schedule_domain('schedule','{"flags":{}}',1,now()+interval '1 hour');
reset role;
update public.admin_scheduled_publications set scheduled_at=now()-interval '1 minute' where created_by='schedule';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_apply_due_publications();
select public.admin_apply_due_publications();
reset role;
do $$ begin
  if (select count(*) from public.admin_scheduled_publications where created_by='schedule' and status='published')<>1 then raise exception 'Scheduled job failed'; end if;
  if (select revision from public.admin_publication_state where domain='schedule')<>2 then raise exception 'Repeat execution changed revision'; end if;
  if not exists(select 1 from public.admin_publication_versions where domain='schedule' and revision=2 and created_by='schedule') then raise exception 'Scheduled author lost'; end if;
end $$;
-- A revoked author's pending job fails rather than retaining old authority.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"schedule"}',true);
select public.admin_schedule_domain('schedule','{"flags":{"classOverrides":{}}}',2,now()+interval '1 hour');
reset role;
update public.admin_scheduled_publications set scheduled_at=now()-interval '1 minute' where status='pending';
delete from public.admins where user_id='schedule';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_apply_due_publications();
reset role;
do $$ begin
  if not exists(select 1 from public.admin_scheduled_publications where created_by='schedule' and status='failed') then raise exception 'Revoked job was not refused'; end if;
end $$;
-- Generated flash metadata is stamped at publication and must not prevent the
-- exact reviewed private draft from being acknowledged/cleared.
insert into public.admin_publication_drafts(user_id,domain,payload,base_payload,base_revision)
values('comms','communications','{"flags":{"feedbackFlashes":[{"id":"flash-one","enabled":true,"deadline":"2026-12-01T12:00:00Z","subjectCode":"BMD","section":"A"}]},"announcement":"Reviewed flash"}', '{}',1);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"comms"}',true);
do $$ declare result jsonb; begin
  result:=public.admin_publish_domain('communications',(select payload from public.admin_publication_drafts where user_id='comms' and domain='communications'),1);
  if result#>>'{payload,flags,feedbackFlashes,0,announcedAt}' is null then raise exception 'Announcement timestamp lost'; end if;
  if exists(select 1 from public.admin_publication_drafts where user_id='comms' and domain='communications') then raise exception 'Published flash draft remained pending'; end if;
end $$;
reset role;
rollback;
select 'Scoped publication, stale-write denial, unrelated-domain preservation, scheduler idempotency and revocation passed' as result;
