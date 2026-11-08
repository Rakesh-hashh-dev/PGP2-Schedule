begin;
create table public.admin_content_reports(
  id uuid primary key default gen_random_uuid(), target_type text not null check(target_type in ('board_post','board_comment','poll','group_message')),
  target_id uuid not null, reporter_id text not null, reason text not null, detail text not null default '',
  evidence jsonb not null, status text not null default 'open' check(status in ('open','resolved','dismissed')),
  owner_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(target_type,target_id,reporter_id)
);
create table public.admin_moderation_decisions(
  id bigint generated always as identity primary key, target_type text not null,target_id uuid not null,
  action text not null, reason text not null, actor text not null, created_at timestamptz not null default now()
);
create table public.admin_content_states(target_type text not null,target_id uuid not null,previous_status text,primary key(target_type,target_id));
alter table public.admin_content_reports enable row level security;
alter table public.admin_moderation_decisions enable row level security;
alter table public.admin_content_states enable row level security;
revoke all on public.admin_content_reports,public.admin_moderation_decisions,public.admin_content_states from public,anon,authenticated;
create index admin_reports_queue_idx on public.admin_content_reports(status,created_at,id);
create index admin_decisions_target_idx on public.admin_moderation_decisions(target_type,target_id,id desc);
alter table public.polls add column moderation_hidden boolean not null default false;
alter table public.group_messages add column moderation_hidden boolean not null default false;

create function admin_internal.content_source(p_type text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; table_name text;
begin
  table_name:=case p_type when 'board_post' then 'board_posts' when 'board_comment' then 'board_comments' when 'poll' then 'polls' when 'group_message' then 'group_messages' end;
  if table_name is null then raise exception 'Unknown report target' using errcode='22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1',table_name) into result using p_id;
  if result is null then raise exception 'Content is no longer available' using errcode='22023'; end if;
  return result;
end $$;
create function admin_internal.report_group_member(p_group text,p_user text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.study_group_invites i where i.group_id=p_group and i.enabled and
    (i.owner_id=p_user or exists(select 1 from public.study_group_join_requests r where r.group_id=p_group and r.requester_id=p_user and r.status='approved')
      or exists(select 1 from public.profiles p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.groups)='array' then p.groups else '[]' end) g where p.user_id=i.owner_id and g->>'id'=p_group and coalesce(g->>'isReceived','false')<>'true' and coalesce(g->'cloudMemberIds','[]')?p_user)));
$$;
create function admin_internal.set_content_hidden(p_type text,p_id uuid,p_hidden boolean) returns void language plpgsql security definer set search_path=public as $$
declare source jsonb; previous text;
begin
  source:=admin_internal.content_source(p_type,p_id);
  perform pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
  if p_type='board_post' then
    if p_hidden then
      insert into public.admin_content_states values(p_type,p_id,case when source->>'status'='removed' then 'open' else source->>'status' end) on conflict do nothing;
      update public.board_posts set status='removed' where id=p_id;
    else
      select previous_status into previous from public.admin_content_states where target_type=p_type and target_id=p_id;
      update public.board_posts set status=coalesce(previous,'open') where id=p_id;
      delete from public.admin_content_states where target_type=p_type and target_id=p_id;
    end if;
  elsif p_type='board_comment' then update public.board_comments set hidden=p_hidden where id=p_id;
  elsif p_type='poll' then update public.polls set moderation_hidden=p_hidden where id=p_id;
  elsif p_type='group_message' then update public.group_messages set moderation_hidden=p_hidden where id=p_id;
  end if;
end $$;
revoke all on function admin_internal.content_source(text,uuid),admin_internal.report_group_member(text,text),admin_internal.set_content_hidden(text,uuid,boolean) from public,anon,authenticated;

create function public.report_content(p_type text,p_id uuid,p_reason text,p_detail text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare source jsonb; reporter text:=auth.jwt()->>'sub'; report_id uuid; evidence jsonb; count_open integer;
begin
  if reporter is null then raise exception 'Sign in to report content' using errcode='42501'; end if;
  if p_reason is null or p_reason not in ('spam','harassment','inappropriate','misleading','other') or p_detail is null or length(p_detail)>1000 then raise exception 'Choose a valid report reason and a detail up to 1000 characters' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
  source:=admin_internal.content_source(p_type,p_id);
  if (p_type='group_message' or (p_type='poll' and source->>'scope'='group')) and not admin_internal.report_group_member(source->>'group_id',reporter) then
    raise exception 'Verified group membership is required to report this content' using errcode='42501';
  end if;
  evidence:=jsonb_build_object('id',p_id,'text',left(coalesce(source->>'title',source->>'question','')||E'\n'||coalesce(source->>'body',source->>'text',''),2000),
    'author',coalesce(source->>'user_id',source->>'created_by',source->>'from_id'),'group_id',source->>'group_id','status',source->>'status');
  insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,detail,evidence) values(p_type,p_id,reporter,p_reason,p_detail,evidence)
    on conflict(target_type,target_id,reporter_id) do nothing returning id into report_id;
  if report_id is null then select id into report_id from public.admin_content_reports where target_type=p_type and target_id=p_id and reporter_id=reporter; end if;
  select count(*) into count_open from public.admin_content_reports where target_type=p_type and target_id=p_id and status='open';
  if count_open>=3 then perform admin_internal.set_content_hidden(p_type,p_id,true); end if;
  return report_id;
end $$;
create function public.admin_moderate_content(p_report uuid,p_action text,p_reason text,p_owner text default null)
returns void language plpgsql security definer set search_path=public as $$
declare report public.admin_content_reports;
begin
  if not public.admin_has_capability('moderation.write') then raise exception 'Moderation permission required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('hide','restore','dismiss','resolve','assign') or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'An action and decision reason are required' using errcode='22023'; end if;
  if p_action='assign' and p_owner is not null and not exists(select 1 from public.admins where user_id=p_owner and role in ('moderator','superadmin')) then raise exception 'Choose an authorized moderator' using errcode='22023'; end if;
  select * into report from public.admin_content_reports where id=p_report;
  if not found then raise exception 'Report unavailable' using errcode='22023'; end if;
  -- Serialise decisions and automatic hiding for the same content.
  perform pg_advisory_xact_lock(hashtextextended(report.target_type||report.target_id::text,0));
  select * into report from public.admin_content_reports where id=p_report for update;
  if p_action in ('hide','restore') then perform admin_internal.set_content_hidden(report.target_type,report.target_id,p_action='hide'); end if;
  update public.admin_content_reports set status=case when p_action='dismiss' then 'dismissed' when p_action in ('resolve','restore') then 'resolved' else status end,
    owner_id=case when p_action='assign' then p_owner else owner_id end,updated_at=clock_timestamp() where target_type=report.target_type and target_id=report.target_id;
  insert into public.admin_moderation_decisions(target_type,target_id,action,reason,actor) values(report.target_type,report.target_id,p_action,p_reason,auth.jwt()->>'sub');
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','content_moderated',jsonb_build_object('report',p_report,'action',p_action,'target_type',report.target_type,'target_id',report.target_id));
end $$;
create function public.admin_report_queue(p_status text default 'open',p_before timestamptz default now(),p_limit integer default 30,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not (public.admin_has_capability('moderation.write') or coalesce(public.admin_role()='monitor',false)) then raise exception 'Moderation access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
    select id,target_type,target_id,reason,detail,evidence,status,owner_id,created_at,
      (select coalesce(jsonb_agg(jsonb_build_object('action',d.action,'reason',d.reason,'actor',d.actor,'at',d.created_at) order by d.id desc),'[]') from (select * from public.admin_moderation_decisions where target_type=c.target_type and target_id=c.target_id order by id desc limit 20) d) history
    from public.admin_content_reports c where (p_status='all' or status=p_status) and (p_before_id is null and created_at<=p_before or p_before_id is not null and (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit least(greatest(p_limit,1),50)
  ) r);
end $$;

-- Registered moderation authority replaces the old self-stamped email helper.
create or replace function public.is_termflow_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.admin_has_capability('moderation.write'); $$;
-- Restrictive policies compose with existing membership/ownership policies.
create policy moderation_poll_visibility on public.polls as restrictive for select to authenticated using(not moderation_hidden or created_by=auth.jwt()->>'sub');
create policy moderation_message_visibility on public.group_messages as restrictive for select to authenticated using(not moderation_hidden or from_id=auth.jwt()->>'sub');

-- Preserve legacy reports privately before clearing public reporter identities.
insert into public.admin_private_config_archive(source_id,payload)
select 'legacy-board-reporters:'||id,jsonb_build_object('type','board_post','reported_by',reported_by) from public.board_posts where reported_by<>'[]'::jsonb;
insert into public.admin_private_config_archive(source_id,payload)
select 'legacy-comment-reporters:'||id,jsonb_build_object('type','board_comment','reported_by',reported_by) from public.board_comments where reported_by<>'[]'::jsonb;
insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,evidence)
select 'board_post',b.id,reporter#>>'{}','legacy',jsonb_build_object('id',b.id,'text',left(b.title||E'\n'||coalesce(b.body,''),2000),'author',b.user_id)
from public.board_posts b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.reported_by)='array' then b.reported_by else '[]' end) reporter where jsonb_typeof(reporter)='string' on conflict do nothing;
insert into public.admin_content_reports(target_type,target_id,reporter_id,reason,evidence)
select 'board_comment',b.id,reporter#>>'{}','legacy',jsonb_build_object('id',b.id,'text',left(b.body,2000),'author',b.user_id)
from public.board_comments b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.reported_by)='array' then b.reported_by else '[]' end) reporter where jsonb_typeof(reporter)='string' on conflict do nothing;
update public.board_posts set reported_by='[]'; update public.board_comments set reported_by='[]';
create or replace function public.report_board_post(p_post_id uuid) returns integer language plpgsql security definer set search_path=public as $$
begin perform public.report_content('board_post',p_post_id,'other','Reported from an older app version'); return (select count(*)::integer from public.admin_content_reports where target_type='board_post' and target_id=p_post_id); end $$;
create or replace function public.report_board_comment(p_comment_id uuid) returns integer language plpgsql security definer set search_path=public as $$
begin perform public.report_content('board_comment',p_comment_id,'other','Reported from an older app version'); return (select count(*)::integer from public.admin_content_reports where target_type='board_comment' and target_id=p_comment_id); end $$;

create function public.admin_guard_moderation_fields() returns trigger language plpgsql as $$
begin
  if current_user in ('anon','authenticated') then
    if to_jsonb(new)->'reported_by' is not null and to_jsonb(new)->'reported_by'<>'[]'::jsonb then raise exception 'Report identities are private' using errcode='42501'; end if;
    if tg_op='UPDATE' and not public.admin_has_capability('moderation.write') and
      ((to_jsonb(old)->'moderation_hidden') is distinct from (to_jsonb(new)->'moderation_hidden')
       or (to_jsonb(old)->'hidden') is distinct from (to_jsonb(new)->'hidden')
       or (to_jsonb(old)->>'status'='removed' and to_jsonb(new)->>'status'<>'removed')) then raise exception 'Moderation permission required' using errcode='42501'; end if;
  end if; return new;
end $$;
create trigger protect_board_moderation before insert or update on public.board_posts for each row execute function public.admin_guard_moderation_fields();
create trigger protect_comment_moderation before insert or update on public.board_comments for each row execute function public.admin_guard_moderation_fields();
create trigger protect_poll_moderation before insert or update on public.polls for each row execute function public.admin_guard_moderation_fields();
create trigger protect_message_moderation before insert or update on public.group_messages for each row execute function public.admin_guard_moderation_fields();
revoke all on function public.report_content(text,uuid,text,text),public.admin_moderate_content(uuid,text,text,text),public.admin_report_queue(text,timestamptz,integer,uuid) from public,anon;
grant execute on function public.report_content(text,uuid,text,text),public.admin_moderate_content(uuid,text,text,text),public.admin_report_queue(text,timestamptz,integer,uuid) to authenticated;
commit;
