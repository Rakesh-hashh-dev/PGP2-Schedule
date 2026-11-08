begin;
insert into public.admins(user_id,role) values('moderator','moderator');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
select public.report_content('board_post','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','spam','First report');
select public.report_content('board_post','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','spam','Duplicate');
select public.report_content('poll','cccccccc-cccc-cccc-cccc-cccccccccccc','misleading','Group poll');
select public.report_content('group_message','dddddddd-dddd-dddd-dddd-dddddddddddd','harassment','Group message');
select public.report_content('board_comment','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','inappropriate','Comment');
do $$ begin
  begin perform public.admin_report_queue(); raise exception 'Student saw queue'; exception when insufficient_privilege then null; end;
  begin perform * from public.admin_content_reports; raise exception 'Private reporter identities exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"outsider"}',true);
do $$ begin
  begin perform public.report_content('group_message','dddddddd-dddd-dddd-dddd-dddddddddddd','spam'); raise exception 'Non-member reported group message'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"student-two"}',true);
select public.report_content('board_post','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','spam');
select set_config('request.jwt.claims','{"sub":"student-three"}',true);
select public.report_content('board_post','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','spam');
do $$ begin
  if exists(select 1 from public.board_posts where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then raise exception 'Auto-hidden content still readable'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ begin
  begin perform public.admin_moderate_content((public.admin_report_queue()->0->>'id')::uuid,'hide','test'); raise exception 'Monitor moderated'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"moderator"}',true);
do $$ declare report_id uuid; begin
  select (r->>'id')::uuid into report_id from jsonb_array_elements(public.admin_report_queue('all')) r where r->>'target_type'='board_post' limit 1;
  perform public.admin_moderate_content(report_id,'restore','Reviewed and restored');
  select (r->>'id')::uuid into report_id from jsonb_array_elements(public.admin_report_queue('all')) r where r->>'target_type'='poll' limit 1;
  perform public.admin_moderate_content(report_id,'hide','Hidden after review');
end $$;
select set_config('request.jwt.claims','{"sub":"owner"}',true);
do $$ begin
  begin update public.polls set moderation_hidden=false where id='cccccccc-cccc-cccc-cccc-cccccccccccc'; raise exception 'Author bypassed moderation'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.admin_content_reports where target_type='board_post')<>3 then raise exception 'Reports lost or duplicated'; end if;
  if (select status from public.board_posts where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')<>'open' then raise exception 'Restore failed'; end if;
  if (select count(*) from public.admin_moderation_decisions)<>2 then raise exception 'Decision history incomplete'; end if;
end $$;
rollback;
select 'Report intake, deduplication, group membership, auto-hide, private identities, moderator decisions and restore passed' as result;
