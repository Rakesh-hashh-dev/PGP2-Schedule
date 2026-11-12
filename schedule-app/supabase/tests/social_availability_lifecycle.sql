-- Disposable local DB only. All behavioral assertions roll back.
begin;
insert into public.profiles(user_id,courses) values('life-consent-owner','{"PM":"A","_buddy_preferences":{"discoverable":false,"purposes":["Case preparation"]},"_status":{"availability":"unavailable"},"_name":"Owner"}'::jsonb);
create or replace function pg_temp.expect_lifecycle_error(statement text, fragment text) returns void language plpgsql as $$
declare failed boolean:=false; begin
 begin execute statement; exception when others then failed:=true; if position(fragment in sqlerrm)=0 then raise exception 'Unexpected failure: %',sqlerrm; end if; end;
 if not failed then raise exception 'Expected failure: %',fragment; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"life-consent-owner","role":"authenticated"}',true);
select public.social_set_discovery_opt_out(true);
do $$ begin
 if not exists(select 1 from public.profiles where user_id='life-consent-owner' and courses->'_hide_from_matchmaker'='true'::jsonb and courses->>'PM'='A' and courses->'_buddy_preferences'='{"discoverable":false,"purposes":["Case preparation"]}'::jsonb and courses->'_status'='{"availability":"unavailable"}'::jsonb and courses->>'_name'='Owner') then raise exception 'Consent update overwrote unrelated profile data'; end if;
end $$;
select pg_temp.expect_lifecycle_error('select public.social_set_discovery_opt_out(null)','boolean discovery preference');
select set_config('request.jwt.claims','{"sub":"life-missing-profile","role":"authenticated"}',true);
select pg_temp.expect_lifecycle_error('select public.social_set_discovery_opt_out(true)','profile is not available');
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_lifecycle_error('select public.social_set_discovery_opt_out(true)','Sign in required');
reset role;
insert into public.meetups(id,created_by,title,starts_at,ends_at,member_ids,series_id,series_index) values
 ('d0000000-0000-0000-0000-000000000001','life-owner','Study','2099-01-01 10:00Z','2099-01-01 11:00Z',array['life-guest',null],'d0000000-0000-0000-0000-000000000099',0),
 ('d0000000-0000-0000-0000-000000000002','life-owner','Study','2099-01-08 10:00Z','2099-01-08 11:00Z',array['life-guest'],'d0000000-0000-0000-0000-000000000099',1),
 ('d0000000-0000-0000-0000-000000000003','life-owner','Study','2099-01-15 10:00Z','2099-01-15 11:00Z',array['life-guest'],'d0000000-0000-0000-0000-000000000099',2);
insert into public.meetups(id,created_by,title,starts_at,ends_at,member_ids) values
 ('d0000000-0000-0000-0000-000000000004','life-owner','Voted time','2099-02-01 10:00Z','2099-02-01 11:00Z',array['life-guest']);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"life-owner","role":"authenticated"}',true);
insert into public.social_busy_blocks(user_id,starts_at,ends_at) values('life-owner','2099-01-01 12:00Z','2099-01-01 13:00Z');
select pg_temp.expect_lifecycle_error($s$insert into public.social_busy_blocks(user_id,starts_at,ends_at) values('other','2099-01-01 12:00Z','2099-01-01 13:00Z')$s$,'row-level security');
select pg_temp.expect_lifecycle_error($s$insert into public.social_busy_blocks(user_id,starts_at,ends_at) values('life-owner','2099-01-01 13:00Z','2099-01-01 12:00Z')$s$,'social_busy_interval');
select set_config('request.jwt.claims','{"sub":"outsider","role":"authenticated"}',true);
do $$ begin if exists(select 1 from public.social_busy_blocks) then raise exception 'Private blocks leaked'; end if; end $$;
select pg_temp.expect_lifecycle_error($s$select public.social_rsvp_meetup('d0000000-0000-0000-0000-000000000001',1,'going','Intruder')$s$,'Only invited');
select pg_temp.expect_lifecycle_error($s$select public.social_manage_meetup('d0000000-0000-0000-0000-000000000001',1,'cancel','this')$s$,'Only the organizer');
select set_config('request.jwt.claims','{"sub":"life-guest","role":"authenticated"}',true);
select public.social_rsvp_meetup('d0000000-0000-0000-0000-000000000001',1,'going','Guest');
select pg_temp.expect_lifecycle_error($s$update public.meetup_rsvps set response='going' where meetup_id='d0000000-0000-0000-0000-000000000001'$s$,'permission denied');
select pg_temp.expect_lifecycle_error($s$insert into public.meetup_rsvps(meetup_id,user_id,response) values('d0000000-0000-0000-0000-000000000002','life-guest','going')$s$,'permission denied');
select set_config('request.jwt.claims','{"sub":"life-owner","role":"authenticated"}',true);
select pg_temp.expect_lifecycle_error($s$update public.meetups set title='Bypass' where id='d0000000-0000-0000-0000-000000000001'$s$,'permission denied');
-- Future rows must all match the organizer's observed versions before any mutation/notification.
select pg_temp.expect_lifecycle_error($s$select public.social_manage_meetup('d0000000-0000-0000-0000-000000000001',1,'edit','future','{"title":"Changed","place":"Library","memberIds":["life-guest"],"startsAt":"2099-01-02T10:00:00Z","endsAt":"2099-01-02T11:30:00Z"}','{"d0000000-0000-0000-0000-000000000002":999,"d0000000-0000-0000-0000-000000000003":1}')$s$,'future occurrence changed');
reset role;
do $$ begin
 if exists(select 1 from public.meetups where id::text like 'd0000000%' and version<>1) then raise exception 'Failed transaction partially edited series'; end if;
 if exists(select 1 from public.notifications where dedup_key like 'meetup_lifecycle:d0000000%') then raise exception 'Failed transaction notified'; end if;
end $$;
set local role authenticated;
select public.social_manage_meetup('d0000000-0000-0000-0000-000000000001',1,'edit','future','{"title":"Changed","place":"Library","memberIds":["life-guest"],"startsAt":"2099-01-02T10:00:00Z","endsAt":"2099-01-02T11:30:00Z"}','{"d0000000-0000-0000-0000-000000000002":1,"d0000000-0000-0000-0000-000000000003":1}');
reset role;
do $$ begin
 if (select count(*) from public.meetups where series_id='d0000000-0000-0000-0000-000000000099' and version=2 and title='Changed' and ends_at-starts_at=interval '90 minutes')<>3 then raise exception 'Series update failed'; end if;
 if not exists(select 1 from public.meetups where id='d0000000-0000-0000-0000-000000000003' and starts_at='2099-01-16 10:00Z') then raise exception 'Series spacing changed'; end if;
 if exists(select 1 from public.meetup_rsvps where meetup_id='d0000000-0000-0000-0000-000000000001') then raise exception 'Old acceptance survived new time'; end if;
 if (select count(*) from public.notifications where dedup_key like 'meetup_lifecycle:d0000000%')<>3 then raise exception 'Atomic series notices missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"life-guest","role":"authenticated"}',true);
select pg_temp.expect_lifecycle_error($s$select public.social_rsvp_meetup('d0000000-0000-0000-0000-000000000001',1,'going','Guest')$s$,'Plan changed');
select public.social_rsvp_meetup('d0000000-0000-0000-0000-000000000001',2,'going','Guest');
select set_config('request.jwt.claims','{"sub":"life-owner","role":"authenticated"}',true);
-- Single cancellation leaves other occurrences active; future cancellation is atomic.
select public.social_manage_meetup('d0000000-0000-0000-0000-000000000001',2,'cancel','this');
do $$ begin if (select count(*) from public.meetups where series_id='d0000000-0000-0000-0000-000000000099' and cancelled)<>1 then raise exception 'Single cancel affected series'; end if; end $$;
select public.social_manage_meetup('d0000000-0000-0000-0000-000000000002',2,'cancel','future','{}','{"d0000000-0000-0000-0000-000000000003":2}');
do $$ begin if (select count(*) from public.meetups where series_id='d0000000-0000-0000-0000-000000000099' and cancelled and version=3)<>3 then raise exception 'Future cancel failed'; end if; end $$;
-- Proposal application remains usable after direct UPDATE revocation and bumps version.
select public.propose_meetup_times('d0000000-0000-0000-0000-000000000004',array['2099-02-02 10:00Z'::timestamptz],'Owner');
select public.vote_meetup_time('d0000000-0000-0000-0000-000000000004',(select id from public.meetup_time_proposals where meetup_id='d0000000-0000-0000-0000-000000000004'));
select public.apply_meetup_time('d0000000-0000-0000-0000-000000000004',(select id from public.meetup_time_proposals where meetup_id='d0000000-0000-0000-0000-000000000004'));
do $$ begin if not exists(select 1 from public.meetups where id='d0000000-0000-0000-0000-000000000004' and version=2) then raise exception 'Proposal did not increment version'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"life-guest","role":"authenticated"}',true);
select pg_temp.expect_lifecycle_error($s$select public.social_rsvp_meetup('d0000000-0000-0000-0000-000000000004',1,'going','Guest')$s$,'Plan changed');
rollback;
