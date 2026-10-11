-- Additive Social enhancements. Deploy separately after local validation.
begin;
alter table public.meetups add column if not exists ends_at timestamptz;
alter table public.meetups add column if not exists series_id uuid;
alter table public.meetups add column if not exists series_index integer;
alter table public.meetups add column if not exists template_id text;
alter table public.meetups add constraint meetups_valid_end check (ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '4 hours'));
alter table public.meetups add constraint meetups_valid_series check ((series_id is null and series_index is null) or (series_id is not null and series_index is not null and series_index between 0 and 7));
create unique index if not exists meetups_series_occurrence_idx on public.meetups(series_id, series_index) where series_id is not null;

-- Require a real owner record and membership recorded by that owner. Do not
-- use study_group_can_access's permissive legacy-group fallback for new data.
create or replace function public.social_group_member(p_group_id text, p_owner_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.jwt()->>'sub' is not null and exists (
    select 1 from public.study_group_invites i join public.profiles p on p.user_id = i.owner_id,
      jsonb_array_elements(coalesce(p.groups,'[]'::jsonb)) g
    where i.group_id = p_group_id and i.enabled and g->>'id' = p_group_id
      and coalesce(g->>'isReceived','false') <> 'true'
      and (i.owner_id = auth.jwt()->>'sub' or (not p_owner_only and (
        (coalesce(g->>'visibility','private') in ('shared','global') and coalesce(g->'cloudMemberIds','[]'::jsonb) ? (auth.jwt()->>'sub'))
        or exists (select 1 from public.study_group_join_requests r where r.group_id = p_group_id and r.requester_id = auth.jwt()->>'sub' and r.status = 'approved')
      )))
  );
$$;
revoke all on function public.social_group_member(text,boolean) from public;
grant execute on function public.social_group_member(text,boolean) to authenticated;

create table public.social_group_pins (
  id uuid primary key default gen_random_uuid(), group_id text not null references public.study_group_invites(group_id),
  created_by text not null, created_by_name text,
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text not null default '' check (char_length(body) <= 1500),
  url text check (url is null or (char_length(url) <= 2048 and url ~* '^https?://')),
  message_id uuid, created_at timestamptz not null default now()
);
create index social_group_pins_group_idx on public.social_group_pins(group_id, created_at desc);
alter table public.social_group_pins enable row level security;
grant select, insert, delete on public.social_group_pins to authenticated;
revoke all on public.social_group_pins from anon;
create policy social_pins_read on public.social_group_pins for select to authenticated using (public.social_group_member(group_id));
create policy social_pins_add on public.social_group_pins for insert to authenticated with check (created_by = auth.jwt()->>'sub' and public.social_group_member(group_id));
create policy social_pins_remove on public.social_group_pins for delete to authenticated using (public.social_group_member(group_id) and (created_by = auth.jwt()->>'sub' or public.social_group_member(group_id,true)));

create table public.social_group_reads (
  user_id text not null, group_id text not null, seen_at timestamptz not null default now(), primary key(user_id,group_id)
);
alter table public.social_group_reads enable row level security;
revoke all on public.social_group_reads from anon, authenticated;
grant select on public.social_group_reads to authenticated;
create policy social_reads_own on public.social_group_reads for select to authenticated using (user_id = auth.jwt()->>'sub');
create or replace function public.social_mark_group_read(p_group_id text, p_seen_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.social_group_member(p_group_id) then raise exception 'Group membership required'; end if;
  insert into public.social_group_reads(user_id,group_id,seen_at) values(auth.jwt()->>'sub',p_group_id,least(p_seen_at,now()))
    on conflict(user_id,group_id) do update set seen_at = greatest(social_group_reads.seen_at, excluded.seen_at);
end;
$$;
revoke all on function public.social_mark_group_read(text,timestamptz) from public;
grant execute on function public.social_mark_group_read(text,timestamptz) to authenticated;

-- Atomic JSON-key mutation preserves concurrent status/course updates.
create or replace function public.social_set_buddy_preferences(p_preferences jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.jwt()->>'sub' is null then raise exception 'Sign in required'; end if;
  if jsonb_typeof(p_preferences) is distinct from 'object' or octet_length(p_preferences::text) > 4096
    or jsonb_typeof(p_preferences->'subjects') is distinct from 'array' or jsonb_typeof(p_preferences->'interests') is distinct from 'array'
    or jsonb_typeof(p_preferences->'purposes') is distinct from 'array' or jsonb_typeof(p_preferences->'discoverable') is distinct from 'boolean' then raise exception 'Invalid preferences'; end if;
  update public.profiles set courses = jsonb_set(coalesce(courses,'{}'::jsonb),'{_buddy_preferences}',p_preferences,true) where user_id = auth.jwt()->>'sub';
  if not found then raise exception 'Profile not found'; end if;
  return p_preferences;
end;
$$;
revoke all on function public.social_set_buddy_preferences(jsonb) from public;
grant execute on function public.social_set_buddy_preferences(jsonb) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.social_group_pins, public.social_group_reads;
  end if;
end $$;
commit;