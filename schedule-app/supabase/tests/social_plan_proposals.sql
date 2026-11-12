-- Run against a DISPOSABLE local database with migrations installed, as its
-- postgres owner: psql -v ON_ERROR_STOP=1 -f supabase/tests/social_plan_proposals.sql
-- All fixtures are rolled back. These are database behavior/RLS assertions,
-- separate from the mocked adapter tests. Never run against production.
begin;
create function pg_temp.expect_error(statement text, fragment text) returns void
language plpgsql as $$
declare failed boolean:=false;
begin
  begin execute statement;
  exception when others then
    failed:=true;
    if position(fragment in sqlerrm)=0 then raise exception 'Unexpected failure: %',sqlerrm; end if;
  end;
  if not failed then raise exception 'Expected failure containing: %',fragment; end if;
end $$;
insert into public.meetups(id,created_by,title,starts_at,ends_at,member_ids)
values('b0000000-0000-0000-0000-000000000001','schedule-test-owner','Direct scheduling test','2099-01-01 10:00Z','2099-01-01 11:30Z',array['schedule-test-guest']);
insert into public.meetups(id,created_by,title,starts_at,ends_at,member_ids) values
 ('b0000000-0000-0000-0000-000000000002','schedule-test-owner','NULL member test','2099-01-01 10:00Z','2099-01-01 11:00Z',array['schedule-test-guest',null]),
 ('b0000000-0000-0000-0000-000000000003','schedule-test-owner','Expired capacity test','2099-01-01 10:00Z','2099-01-01 11:00Z',array['schedule-test-guest']);
insert into public.meetup_time_proposals(id,meetup_id,proposed_by,proposed_by_name,starts_at,base_starts_at,base_ends_at)
values('b0000000-0000-0000-0000-000000000099','b0000000-0000-0000-0000-000000000002','schedule-test-owner','Owner','2099-01-02 10:00Z','2099-01-01 10:00Z','2099-01-01 11:00Z');
insert into public.meetup_time_proposals(meetup_id,proposed_by,proposed_by_name,starts_at,base_starts_at,base_ends_at)
select 'b0000000-0000-0000-0000-000000000003','schedule-test-owner','Owner',now()-index*interval '1 hour','2099-01-01 10:00Z','2099-01-01 11:00Z' from generate_series(1,12) index;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"schedule-test-guest","role":"authenticated"}',true);
-- No group is needed to propose multiple persistent times.
select public.propose_meetup_times('b0000000-0000-0000-0000-000000000001',array['2099-01-02 10:00Z'::timestamptz,'2099-01-03 10:00Z'::timestamptz],'Guest');
do $$ begin
  if (select count(*) from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001')<>2 then raise exception 'Proposal persistence failed'; end if;
end $$;
-- A duplicate-only retry must acknowledge no change and send no notices.
reset role;
do $$ declare before_count bigint; result jsonb; begin
  select count(*) into before_count from public.notifications where data->>'meetup_id'='b0000000-0000-0000-0000-000000000001';
  result:=public.propose_meetup_times('b0000000-0000-0000-0000-000000000001',array['2099-01-02 10:00Z'::timestamptz],'Guest');
  if result->>'saved'<>'false' or result->>'reason'<>'duplicate' then raise exception 'Duplicate retry was reported saved'; end if;
  if (select count(*) from public.notifications where data->>'meetup_id'='b0000000-0000-0000-0000-000000000001')<>before_count then raise exception 'Duplicate retry emitted a fresh notice'; end if;
end $$;
set local role authenticated;
select public.propose_meetup_times('b0000000-0000-0000-0000-000000000003',array['2099-01-04 10:00Z'::timestamptz],'Guest');
do $$ begin
  if (select count(*) from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000003' and state='open')<>1 then raise exception 'Expired options did not release capacity'; end if;
end $$;
select pg_temp.expect_error($s$insert into public.meetup_time_votes(meetup_id,user_id,proposal_id) select meetup_id,'schedule-test-guest',id from public.meetup_time_proposals limit 1$s$,'permission denied');
select pg_temp.expect_error($s$select public.apply_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals limit 1))$s$,'Only the organizer');
select set_config('request.jwt.claims','{"sub":"schedule-test-outsider","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001') then raise exception 'Outsider can read private options'; end if;
end $$;
select pg_temp.expect_error($s$select public.propose_meetup_times('b0000000-0000-0000-0000-000000000001',array['2099-01-04 10:00Z'::timestamptz],'Outsider')$s$,'Only the organizer and invitees');
select pg_temp.expect_error($s$select public.vote_meetup_time('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000099')$s$,'Only the organizer and invitees');
-- NULL elements in an invitation array must never turn denial into UNKNOWN.
select pg_temp.expect_error($s$select public.propose_meetup_times('b0000000-0000-0000-0000-000000000002',array['2099-01-04 10:00Z'::timestamptz],'Outsider')$s$,'Only the organizer and invitees');
select pg_temp.expect_error($s$select public.vote_meetup_time('b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000099')$s$,'Only the organizer and invitees');
select set_config('request.jwt.claims','{"sub":"schedule-test-owner","role":"authenticated"}',true);
select pg_temp.expect_error($s$select public.apply_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' order by starts_at limit 1))$s$,'At least one vote');
select public.vote_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' order by starts_at limit 1));
select set_config('request.jwt.claims','{"sub":"schedule-test-guest","role":"authenticated"}',true);
insert into public.meetup_rsvps(meetup_id,user_id,response) values('b0000000-0000-0000-0000-000000000001','schedule-test-guest','going');
select public.vote_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' order by starts_at desc limit 1));
select set_config('request.jwt.claims','{"sub":"schedule-test-owner","role":"authenticated"}',true);
select pg_temp.expect_error($s$select public.apply_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' order by starts_at limit 1))$s$,'Times are tied');
select public.apply_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' order by starts_at limit 1),true);
do $$ begin
  if not exists(select 1 from public.meetups where id='b0000000-0000-0000-0000-000000000001' and starts_at='2099-01-02 10:00Z' and ends_at='2099-01-02 11:30Z') then raise exception 'Winning time/duration not preserved'; end if;
  if exists(select 1 from public.meetup_rsvps where meetup_id='b0000000-0000-0000-0000-000000000001') then raise exception 'Changed-time RSVP was not cleared'; end if;
  if exists(select 1 from public.meetup_time_votes where meetup_id='b0000000-0000-0000-0000-000000000001') then raise exception 'Old votes were not cleared'; end if;
end $$;
select pg_temp.expect_error($s$select public.apply_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' and state='applied'),true)$s$,'applied or is stale');
select pg_temp.expect_error($s$select public.vote_meetup_time('b0000000-0000-0000-0000-000000000001',(select id from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' and state='closed' limit 1))$s$,'suggestion is stale');
-- Later organizer edits must invalidate proposals even if the old time returns.
select public.propose_meetup_times('b0000000-0000-0000-0000-000000000001',array['2099-01-04 10:00Z'::timestamptz],'Owner');
update public.meetups set starts_at='2099-01-02 10:15Z',ends_at='2099-01-02 11:45Z' where id='b0000000-0000-0000-0000-000000000001';
do $$ begin
  if exists(select 1 from public.meetup_time_proposals where meetup_id='b0000000-0000-0000-0000-000000000001' and state='open') then raise exception 'Edit did not invalidate scheduling round'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"schedule-test-guest","role":"authenticated"}',true);
do $$ begin
  if not exists(select 1 from public.notifications where user_id='schedule-test-guest' and dedup_key like 'meetup_time_applied:%' and data->>'meetup_id'='b0000000-0000-0000-0000-000000000001') then raise exception 'Winner notification missing'; end if;
end $$;
rollback;
