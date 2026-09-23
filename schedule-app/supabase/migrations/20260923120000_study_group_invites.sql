-- Owner-approved, non-friend study-circle invites. Apply before enabling the UI.
create table if not exists public.study_group_invites (
  group_id text primary key,
  owner_id text not null,
  token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.study_group_join_requests (
  group_id text not null references public.study_group_invites(group_id) on delete cascade,
  requester_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  primary key (group_id, requester_id)
);
alter table public.study_group_invites enable row level security;
alter table public.study_group_join_requests enable row level security;
revoke all on public.study_group_invites, public.study_group_join_requests from anon, authenticated;

create or replace function public.study_group_invite(p_action text, p_group_id text default null, p_token uuid default null, p_requester_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid text := auth.jwt()->>'sub';
  v_inv public.study_group_invites%rowtype;
  v_groups jsonb;
  v_group jsonb;
  v_request public.study_group_join_requests%rowtype;
  v_name text;
  v_owner_name text;
  v_member_ids jsonb;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  if p_action = 'create' then
    select coalesce(groups, '[]'::jsonb) into v_groups from public.profiles where user_id = v_uid;
    select value into v_group from jsonb_array_elements(coalesce(v_groups, '[]'::jsonb))
      where value->>'id' = p_group_id and coalesce(value->>'isReceived', 'false') <> 'true' limit 1;
    if v_group is null then raise exception 'Only the group owner can create an invite'; end if;
    insert into public.study_group_invites (group_id, owner_id) values (p_group_id, v_uid)
      on conflict (group_id) do nothing;
    select * into v_inv from public.study_group_invites where group_id = p_group_id;
    if v_inv.owner_id <> v_uid then raise exception 'Group ID belongs to another owner'; end if;
    return jsonb_build_object('token', v_inv.token, 'enabled', v_inv.enabled);
  elsif p_action = 'preview' or p_action = 'request' then
    select * into v_inv from public.study_group_invites where token = p_token and enabled;
    if not found then raise exception 'Invite link is invalid or disabled'; end if;
    select coalesce(groups, '[]'::jsonb), coalesce(courses->>'_name', 'Student')
      into v_groups, v_owner_name from public.profiles where user_id = v_inv.owner_id;
    select value into v_group from jsonb_array_elements(coalesce(v_groups, '[]'::jsonb))
      where value->>'id' = v_inv.group_id and coalesce(value->>'isReceived', 'false') <> 'true' limit 1;
    if v_group is null then raise exception 'This group is no longer available'; end if;
    if p_action = 'request' and v_uid <> v_inv.owner_id then
      insert into public.study_group_join_requests (group_id, requester_id, status)
        values (v_inv.group_id, v_uid, 'pending')
        on conflict (group_id, requester_id) do update set status =
          case when study_group_join_requests.status = 'approved' then 'approved' else 'pending' end;
    end if;
    select * into v_request from public.study_group_join_requests
      where group_id = v_inv.group_id and requester_id = v_uid;
    return jsonb_build_object('groupId', v_inv.group_id, 'groupName', v_group->>'name',
      'ownerName', v_owner_name, 'status', case when v_uid = v_inv.owner_id then 'owner' else coalesce(v_request.status, 'new') end);
  elsif p_action = 'list' then
    if not exists (select 1 from public.study_group_invites where group_id = p_group_id and owner_id = v_uid) then
      return '[]'::jsonb;
    end if;
    return coalesce((select jsonb_agg(jsonb_build_object('userId', r.requester_id,
      'name', coalesce(p.courses->>'_name', 'Student'), 'status', r.status))
      from public.study_group_join_requests r left join public.profiles p on p.user_id = r.requester_id
      where r.group_id = p_group_id and r.status in ('pending', 'approved')), '[]'::jsonb);
  elsif p_action = 'approve' or p_action = 'decline' then
    select * into v_inv from public.study_group_invites where group_id = p_group_id and owner_id = v_uid;
    if not found then raise exception 'Only the owner can review requests'; end if;
    select * into v_request from public.study_group_join_requests
      where group_id = p_group_id and requester_id = p_requester_id and status = 'pending' for update;
    if not found then raise exception 'Pending request not found'; end if;
    if p_action = 'decline' then
      update public.study_group_join_requests set status = 'declined'
        where group_id = p_group_id and requester_id = p_requester_id;
      return jsonb_build_object('status', 'declined');
    end if;
    select coalesce(courses->>'_name', 'Student') into v_name from public.profiles where user_id = p_requester_id;
    if not found then raise exception 'Requester profile not found'; end if;
    select coalesce(groups, '[]'::jsonb), coalesce(courses->>'_name', 'Student')
      into v_groups, v_owner_name from public.profiles where user_id = v_uid for update;
    select value into v_group from jsonb_array_elements(v_groups)
      where value->>'id' = p_group_id and coalesce(value->>'isReceived', 'false') <> 'true' limit 1;
    if v_group is null then raise exception 'Group not found'; end if;
    v_member_ids := coalesce(v_group->'inviteMembers', '[]'::jsonb);
    if not exists (select 1 from jsonb_array_elements(v_member_ids) m where m->>'userId' = p_requester_id) then
      v_member_ids := v_member_ids || jsonb_build_array(jsonb_build_object('userId', p_requester_id, 'name', v_name));
    end if;
    update public.profiles set groups = (
      select jsonb_agg(case when g->>'id' = p_group_id and coalesce(g->>'isReceived', 'false') <> 'true'
        then g || jsonb_build_object('inviteMembers', v_member_ids) else g end)
      from jsonb_array_elements(v_groups) g) where user_id = v_uid;
    select coalesce(groups, '[]'::jsonb) into v_groups from public.profiles where user_id = p_requester_id for update;
    update public.profiles set groups = (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from jsonb_array_elements(v_groups) g where g->>'id' <> p_group_id
    ) || jsonb_build_array(jsonb_build_object('id', p_group_id, 'name', v_group->>'name',
      'memberIds', '[]'::jsonb, 'cloudMemberIds', jsonb_build_array(v_uid, p_requester_id),
      'visibility', 'shared', 'isReceived', true, 'ownerId', v_uid, 'ownerName', v_owner_name,
      'createdAt', coalesce(v_group->>'createdAt', now()::text))) where user_id = p_requester_id;
    update public.study_group_join_requests set status = 'approved'
      where group_id = p_group_id and requester_id = p_requester_id;
    return jsonb_build_object('status', 'approved', 'userId', p_requester_id, 'name', v_name);
  elsif p_action = 'leave' then
    select * into v_inv from public.study_group_invites where group_id = p_group_id;
    if found and v_inv.owner_id <> v_uid then
      update public.study_group_join_requests set status = 'declined'
        where group_id = p_group_id and requester_id = v_uid and status = 'approved';
      update public.profiles p set groups = (
        select coalesce(jsonb_agg(case when g->>'id' = p_group_id
          then g || jsonb_build_object('inviteMembers',
            coalesce((select jsonb_agg(m) from jsonb_array_elements(coalesce(g->'inviteMembers','[]'::jsonb)) m
              where m->>'userId' <> v_uid), '[]'::jsonb)) else g end), '[]'::jsonb)
        from jsonb_array_elements(coalesce(p.groups, '[]'::jsonb)) g)
        where p.user_id = v_inv.owner_id;
    end if;
    return jsonb_build_object('left', true);
  elsif p_action = 'close' then
    select * into v_inv from public.study_group_invites where group_id = p_group_id and owner_id = v_uid;
    if not found then raise exception 'Only the owner can close an invite'; end if;
    update public.study_group_invites set enabled = false where group_id = p_group_id;
    update public.profiles p set groups = (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from jsonb_array_elements(coalesce(p.groups, '[]'::jsonb)) g
      where g->>'id' <> p_group_id)
      where p.user_id in (select requester_id from public.study_group_join_requests
        where group_id = p_group_id and status = 'approved');
    return jsonb_build_object('closed', true);
  end if;
  raise exception 'Unknown group invite action';
end;
$$;
revoke all on function public.study_group_invite(text, text, uuid, text) from public;
grant execute on function public.study_group_invite(text, text, uuid, text) to authenticated;

-- Existing group chats were open to all signed-in users. Preserve legacy groups,
-- but gate invite-enabled groups on owner, approved requester, or an existing
-- friend-share recorded in the owner's own group row.
create or replace function public.study_group_can_access(p_group_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.jwt()->>'sub' is null then false
    when not exists (select 1 from public.study_group_invites i where i.group_id = p_group_id) then true
    else exists (
      select 1 from public.study_group_invites i
      where i.group_id = p_group_id and i.enabled and (
        i.owner_id = auth.jwt()->>'sub'
        or exists (select 1 from public.study_group_join_requests r
          where r.group_id = p_group_id and r.requester_id = auth.jwt()->>'sub' and r.status = 'approved')
        or exists (select 1 from public.profiles p, jsonb_array_elements(coalesce(p.groups, '[]'::jsonb)) g
          where p.user_id = i.owner_id and g->>'id' = p_group_id
          and coalesce(g->>'isReceived', 'false') <> 'true'
          and coalesce(g->'cloudMemberIds', '[]'::jsonb) ? (auth.jwt()->>'sub'))
      )
    ) end;
$$;
revoke all on function public.study_group_can_access(text) from public;
grant execute on function public.study_group_can_access(text) to authenticated;

drop policy if exists group_msg_select on public.group_messages;
create policy group_msg_select on public.group_messages for select
  using (public.study_group_can_access(group_id));
drop policy if exists group_msg_insert on public.group_messages;
create policy group_msg_insert on public.group_messages for insert
  with check (auth.jwt()->>'sub' = from_id and public.study_group_can_access(group_id));

drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select
  using (auth.jwt()->>'sub' is not null and (scope <> 'group' or public.study_group_can_access(group_id)));
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls for insert
  with check (auth.jwt()->>'sub' = created_by and (scope <> 'group' or public.study_group_can_access(group_id)));
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select
  using (auth.jwt()->>'sub' is not null and exists
    (select 1 from public.polls p where p.id = poll_id));
drop policy if exists poll_votes_upsert on public.poll_votes;
create policy poll_votes_upsert on public.poll_votes for insert
  with check (auth.jwt()->>'sub' = user_id and exists
    (select 1 from public.polls p where p.id = poll_id));
drop policy if exists poll_votes_update on public.poll_votes;
create policy poll_votes_update on public.poll_votes for update
  using (auth.jwt()->>'sub' = user_id and exists
    (select 1 from public.polls p where p.id = poll_id))
  with check (auth.jwt()->>'sub' = user_id and exists
    (select 1 from public.polls p where p.id = poll_id));
