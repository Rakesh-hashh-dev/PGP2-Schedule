-- Plan-scoped scheduling for both direct invitations and group plans.
-- All mutations lock the parent plan: voting and applying cannot race.
create table public.meetup_time_proposals (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  proposed_by text not null,
  proposed_by_name text not null,
  starts_at timestamptz not null,
  base_starts_at timestamptz not null,
  base_ends_at timestamptz,
  state text not null default 'open' check(state in ('open','applied','closed')),
  created_at timestamptz not null default now(),
  unique(meetup_id,id)
);
create unique index meetup_time_unique_open on public.meetup_time_proposals(meetup_id,starts_at) where state='open';
create table public.meetup_time_votes (
  meetup_id uuid not null,
  user_id text not null,
  proposal_id uuid not null,
  voted_at timestamptz not null default now(),
  primary key(meetup_id,user_id),
  foreign key(meetup_id,proposal_id) references public.meetup_time_proposals(meetup_id,id) on delete cascade
);
alter table public.meetup_time_proposals enable row level security;
alter table public.meetup_time_votes enable row level security;
create policy meetup_time_proposals_read on public.meetup_time_proposals for select to authenticated using (
  exists(select 1 from public.meetups m where m.id=meetup_id and (m.created_by=auth.jwt()->>'sub' or auth.jwt()->>'sub'=any(m.member_ids)))
);
create policy meetup_time_votes_read on public.meetup_time_votes for select to authenticated using (
  exists(select 1 from public.meetups m where m.id=meetup_id and (m.created_by=auth.jwt()->>'sub' or auth.jwt()->>'sub'=any(m.member_ids)))
);
-- No direct-write policies: RPCs enforce membership, state and concurrency.
revoke all on public.meetup_time_proposals,public.meetup_time_votes from anon,authenticated;
grant select on public.meetup_time_proposals,public.meetup_time_votes to authenticated;

-- Editing the underlying plan invalidates the old scheduling round, even if
-- the organizer later restores its original time or invitation list.
create function public.invalidate_meetup_time_round() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.member_ids is distinct from old.member_ids or new.cancelled is distinct from old.cancelled then
    update public.meetup_time_proposals set state='closed' where meetup_id=new.id and state='open';
    delete from public.meetup_time_votes where meetup_id=new.id;
  end if;
  return new;
end $$;
revoke all on function public.invalidate_meetup_time_round() from public,anon,authenticated;
create trigger invalidate_meetup_time_round after update on public.meetups for each row execute function public.invalidate_meetup_time_round();

create function public.propose_meetup_times(p_meetup_id uuid,p_times timestamptz[],p_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.meetups; subject text:=auth.jwt()->>'sub'; t timestamptz; proposal uuid; added integer:=0; batch uuid:=gen_random_uuid();
begin
  select * into m from public.meetups where id=p_meetup_id for update;
  if subject is null or m.id is null or (m.created_by=subject or subject=any(m.member_ids)) is not true then raise exception 'Only the organizer and invitees can suggest times'; end if;
  if m.cancelled or m.starts_at<=now() then raise exception 'This plan is no longer open for scheduling'; end if;
  if cardinality(p_times) is null or cardinality(p_times) not between 1 and 6 then raise exception 'Choose one to six times'; end if;
  update public.meetup_time_proposals set state='closed' where meetup_id=m.id and state='open' and (starts_at<=now() or base_starts_at is distinct from m.starts_at or base_ends_at is distinct from m.ends_at);
  foreach t in array p_times loop
    if t is null or not isfinite(t) or t<=now() then raise exception 'Choose future times'; end if;
    if exists(select 1 from public.meetup_time_proposals where meetup_id=m.id and state='open' and starts_at=t) then continue; end if;
    if (select count(*) from public.meetup_time_proposals where meetup_id=m.id and state='open')>=12 then raise exception 'This plan already has twelve time options'; end if;
    insert into public.meetup_time_proposals(meetup_id,proposed_by,proposed_by_name,starts_at,base_starts_at,base_ends_at)
      values(m.id,subject,left(coalesce(nullif(trim(p_name),''),'Someone'),80),t,m.starts_at,m.ends_at)
      on conflict(meetup_id,starts_at) where state='open' do nothing returning id into proposal;
    if proposal is not null then added:=added+1; end if;
  end loop;
  if added=0 then return jsonb_build_object('saved',false,'reason','duplicate'); end if;
  insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key)
    select distinct recipient,'meetup_invite','Choose a time: '||m.title,'New time suggestions are ready. Open the plan to vote.','/?view=friends','/icon-192.png',
      jsonb_build_object('from_id',subject,'meetup_id',m.id,'expires_at',m.starts_at),'meetup_times:'||batch::text
    from unnest(array_append(m.member_ids,m.created_by)) recipient where recipient<>subject
    on conflict(user_id,dedup_key) do nothing;
  return jsonb_build_object('saved',true,'added',added);
end $$;

create function public.vote_meetup_time(p_meetup_id uuid,p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.meetups; subject text:=auth.jwt()->>'sub';
begin
  select * into m from public.meetups where id=p_meetup_id for update;
  if subject is null or m.id is null or (m.created_by=subject or subject=any(m.member_ids)) is not true then raise exception 'Only the organizer and invitees can vote'; end if;
  if m.cancelled or m.starts_at<=now() then raise exception 'This plan is no longer open for scheduling'; end if;
  if not exists(select 1 from public.meetup_time_proposals p where p.id=p_proposal_id and p.meetup_id=m.id and p.state='open' and p.starts_at>now() and p.base_starts_at=m.starts_at and p.base_ends_at is not distinct from m.ends_at) then raise exception 'This suggestion is stale. Refresh the plan'; end if;
  insert into public.meetup_time_votes(meetup_id,user_id,proposal_id) values(m.id,subject,p_proposal_id)
    on conflict(meetup_id,user_id) do update set proposal_id=excluded.proposal_id,voted_at=now();
  return jsonb_build_object('saved',true);
end $$;

create function public.apply_meetup_time(p_meetup_id uuid,p_proposal_id uuid,p_resolve_tie boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.meetups; p public.meetup_time_proposals; subject text:=auth.jwt()->>'sub'; best bigint; chosen bigint; ties bigint; duration interval;
begin
  select * into m from public.meetups where id=p_meetup_id for update;
  if subject is null or m.id is null or m.created_by<>subject then raise exception 'Only the organizer can confirm a winning time'; end if;
  if m.cancelled or m.starts_at<=now() then raise exception 'This plan is no longer open for scheduling'; end if;
  select * into p from public.meetup_time_proposals where id=p_proposal_id and meetup_id=m.id;
  if p.id is null or p.state<>'open' or p.starts_at<=now() or p.base_starts_at is distinct from m.starts_at or p.base_ends_at is distinct from m.ends_at then raise exception 'This suggestion was applied or is stale. Refresh the plan'; end if;
  with counts as (
    select option.id,count(v.user_id) as votes from public.meetup_time_proposals option
    left join public.meetup_time_votes v on v.proposal_id=option.id and (v.user_id=m.created_by or v.user_id=any(m.member_ids))
    where option.meetup_id=m.id and option.state='open' and option.starts_at>now() and option.base_starts_at=m.starts_at and option.base_ends_at is not distinct from m.ends_at group by option.id
  ) select max(votes),max(votes) filter(where id=p.id) into best,chosen from counts;
  if coalesce(best,0)=0 then raise exception 'At least one vote is required before confirming a time'; end if;
  if chosen is distinct from best then raise exception 'Choose a winning time'; end if;
  select count(*) into ties from (
    select option.id from public.meetup_time_proposals option left join public.meetup_time_votes v on v.proposal_id=option.id and (v.user_id=m.created_by or v.user_id=any(m.member_ids))
    where option.meetup_id=m.id and option.state='open' and option.starts_at>now() and option.base_starts_at=m.starts_at and option.base_ends_at is not distinct from m.ends_at group by option.id having count(v.user_id)=best
  ) winners;
  if ties>1 and not coalesce(p_resolve_tie,false) then raise exception 'Times are tied. Explicitly choose a tied winner'; end if;
  duration:=coalesce(m.ends_at-m.starts_at,interval '1 hour');
  update public.meetup_time_proposals set state=case when id=p.id then 'applied' else 'closed' end where meetup_id=m.id and state='open';
  update public.meetups set starts_at=p.starts_at,ends_at=p.starts_at+duration where id=m.id;
  if p.starts_at is distinct from m.starts_at then delete from public.meetup_rsvps where meetup_id=m.id; end if;
  delete from public.meetup_time_votes where meetup_id=m.id;
  insert into public.notifications(user_id,type,title,body,url,icon,data,dedup_key)
    select distinct recipient,'meetup_invite','Time confirmed: '||m.title,'The organizer confirmed the voted time. Please review the plan and RSVP again.','/?view=friends','/icon-192.png',
      jsonb_build_object('from_id',subject,'meetup_id',m.id,'expires_at',p.starts_at),'meetup_time_applied:'||p.id::text
    from unnest(m.member_ids) recipient where recipient<>subject on conflict(user_id,dedup_key) do nothing;
  return jsonb_build_object('saved',true,'starts_at',p.starts_at,'ends_at',p.starts_at+duration);
end $$;
revoke all on function public.propose_meetup_times(uuid,timestamptz[],text),public.vote_meetup_time(uuid,uuid),public.apply_meetup_time(uuid,uuid,boolean) from public,anon;
grant execute on function public.propose_meetup_times(uuid,timestamptz[],text),public.vote_meetup_time(uuid,uuid),public.apply_meetup_time(uuid,uuid,boolean) to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.meetup_time_proposals,public.meetup_time_votes;
end $$;
