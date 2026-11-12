-- Expand-phase assertions: run after D migration, BEFORE the cutover operation.
-- Disposable database only. Existing authenticated privileges are prerequisites;
-- this test and the new migration do not grant legacy users any new access.
begin;
insert into public.meetups(id,created_by,title,starts_at,ends_at,member_ids)
values('e0000000-0000-0000-0000-000000000001','legacy-owner','Legacy plan','2099-01-01 10:00Z','2099-01-01 11:00Z',array['legacy-guest']);
insert into public.meetup_time_proposals(id,meetup_id,proposed_by,proposed_by_name,starts_at,base_starts_at,base_ends_at)
values('e0000000-0000-0000-0000-000000000099','e0000000-0000-0000-0000-000000000001','legacy-guest','Guest','2099-01-03 10:00Z','2099-01-01 10:00Z','2099-01-01 11:00Z');
insert into public.meetup_time_votes(meetup_id,user_id,proposal_id)
values('e0000000-0000-0000-0000-000000000001','legacy-guest','e0000000-0000-0000-0000-000000000099');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"legacy-owner","role":"authenticated"}',true);
do $$ declare changed integer; begin
 update public.meetups set title='Legacy edited',starts_at='2099-01-02 10:00Z',ends_at='2099-01-02 11:00Z' where id='e0000000-0000-0000-0000-000000000001';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Expand phase broke legacy owner UPDATE'; end if;
 if not exists(select 1 from public.meetups where id='e0000000-0000-0000-0000-000000000001' and version=2 and title='Legacy edited') then raise exception 'Legacy edit did not retain version trigger'; end if;
 if not exists(select 1 from public.meetup_time_proposals where id='e0000000-0000-0000-0000-000000000099' and state='closed') or exists(select 1 from public.meetup_time_votes where meetup_id='e0000000-0000-0000-0000-000000000001') then raise exception 'Legacy edit did not invalidate its old scheduling round'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"legacy-guest","role":"authenticated"}',true);
insert into public.meetup_rsvps(meetup_id,user_id,user_name,response)
values('e0000000-0000-0000-0000-000000000001','legacy-guest','Guest','going');
-- Same statement shape as the old hosted client's upsert.
insert into public.meetup_rsvps(meetup_id,user_id,user_name,response,responded_at)
values('e0000000-0000-0000-0000-000000000001','legacy-guest','Guest','declined',now())
on conflict(meetup_id,user_id) do update set response=excluded.response,responded_at=excluded.responded_at;
do $$ begin
 if not exists(select 1 from public.meetup_rsvps where meetup_id='e0000000-0000-0000-0000-000000000001' and user_id='legacy-guest' and response='declined') then raise exception 'Expand phase broke legacy RSVP INSERT/UPDATE'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"legacy-outsider","role":"authenticated"}',true);
do $$ declare changed integer; denied boolean:=false; begin
 update public.meetups set title='Unauthorized edit' where id='e0000000-0000-0000-0000-000000000001';
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Legacy RLS allowed outsider plan update'; end if;
 begin
  insert into public.meetup_rsvps(meetup_id,user_id,response) values('e0000000-0000-0000-0000-000000000001','legacy-outsider','going');
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Legacy RLS allowed outsider RSVP'; end if;
 if exists(select 1 from public.meetups where id='e0000000-0000-0000-0000-000000000001') then raise exception 'Legacy RLS leaked private plan'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"legacy-owner","role":"authenticated"}',true);
do $$ declare changed integer; begin
 update public.meetups set cancelled=true where id='e0000000-0000-0000-0000-000000000001';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Expand phase broke legacy cancellation'; end if;
end $$;
rollback;
