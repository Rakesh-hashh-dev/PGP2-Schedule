-- ============================================================
-- Campus Board — lost & found + buy/sell listings
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; safe on the live app. Run AFTER 20260719120000_polls.sql
-- (both migrations recreate notif_social_insert; this one's list is a superset).
--
-- Moderation model:
--   * anyone can report a post (SECURITY DEFINER RPC, one report per user);
--     at 3 distinct reports the post auto-flips to status='removed'.
--   * admins (matched by profiles.email against the same list the client's
--     ADMIN_EMAILS uses) can update/delete any post via is_termflow_admin().
--     Caveat: profiles.email is self-stamped by the client on login, so this
--     is a raised bar, not a hard boundary — consistent with the app's
--     client-gated admin posture everywhere else.
-- ============================================================

create or replace function public.is_termflow_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.jwt()->>'sub'
      and email in ('mba25rakeshb@iimsambalpur.ac.in', 'test@iimsambalpur.ac.in')
  );
$$;

create table if not exists public.board_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,   -- Clerk subject
  user_name   text,
  kind        text not null check (kind in ('lost','found','sell','ask')),
  title       text not null check (char_length(title) between 1 and 80),
  body        text check (char_length(body) <= 500),
  price       int check (price is null or price >= 0),  -- rupees; sell/ask only
  image_path  text,            -- storage path in board-images
  contact     text check (char_length(contact) <= 80),  -- optional phone/room; else in-app ping
  status      text not null default 'open' check (status in ('open','resolved','removed')),
  reported_by jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

alter table public.board_posts enable row level security;

-- Read: everyone signed-in sees live posts; owners and admins also see removed
-- ones (owner: so they know it's gone; admin: the moderation queue).
drop policy if exists board_select on public.board_posts;
create policy board_select on public.board_posts
  for select using (
    auth.jwt()->>'sub' is not null
    and (status <> 'removed' or user_id = auth.jwt()->>'sub' or is_termflow_admin())
  );
drop policy if exists board_insert on public.board_posts;
create policy board_insert on public.board_posts
  for insert with check (auth.jwt()->>'sub' = user_id);
drop policy if exists board_update on public.board_posts;
create policy board_update on public.board_posts
  for update using (auth.jwt()->>'sub' = user_id or is_termflow_admin())
  with check (auth.jwt()->>'sub' = user_id or is_termflow_admin());
drop policy if exists board_delete on public.board_posts;
create policy board_delete on public.board_posts
  for delete using (auth.jwt()->>'sub' = user_id or is_termflow_admin());

create index if not exists board_posts_feed_idx on public.board_posts (status, created_at desc);

-- One report per user, server-side; 3 distinct reporters auto-hide the post.
-- SECURITY DEFINER so reporters don't need UPDATE rights on others' rows.
create or replace function public.report_board_post(p_post_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter text := auth.jwt()->>'sub';
  v_count int;
begin
  if v_reporter is null then
    raise exception 'not authenticated';
  end if;
  update board_posts
  set reported_by = reported_by || to_jsonb(v_reporter)
  where id = p_post_id
    and not reported_by ? v_reporter
    and user_id <> v_reporter;
  select jsonb_array_length(reported_by) into v_count from board_posts where id = p_post_id;
  if v_count >= 3 then
    update board_posts set status = 'removed' where id = p_post_id and status <> 'removed';
  end if;
  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.report_board_post(uuid) to authenticated;

alter publication supabase_realtime add table public.board_posts;

-- ── Storage: post images ──────────────────────────────────────────────────────
-- Public-read bucket; uploads path-scoped to the caller's own user-id folder
-- (client resizes to ≤1280px webp before upload). 2MB cap as a backstop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board-images', 'board-images', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists board_images_read on storage.objects;
create policy board_images_read on storage.objects
  for select using (bucket_id = 'board-images');
drop policy if exists board_images_insert on storage.objects;
create policy board_images_insert on storage.objects
  for insert with check (
    bucket_id = 'board-images'
    and (storage.foldername(name))[1] = auth.jwt()->>'sub'
  );
drop policy if exists board_images_delete on storage.objects;
create policy board_images_delete on storage.objects
  for delete using (
    bucket_id = 'board-images'
    and ((storage.foldername(name))[1] = auth.jwt()->>'sub' or is_termflow_admin())
  );

-- ── "I'm interested" pings ────────────────────────────────────────────────────
-- Buyer/finder taps Contact → one `board_contact` notifications row for the
-- poster. Extends the scoped social INSERT policy (superset of the polls
-- migration's list); data.from_id stays pinned to the caller.
-- NOTE: polls (20260719120000), meetups (20260719140000) and this migration all
-- recreate this policy. Each carries the FULL union of client-insertable types
-- so they are safe to run in any order.
drop policy if exists notif_social_insert on public.notifications;
create policy notif_social_insert on public.notifications
  for insert
  with check (
    type in ('friend_request','friend_accepted','group_invite','friend_removed','group_poll',
             'board_contact','meetup_invite','meetup_rsvp','meetup_cancelled')
    and (data->>'from_id') = (auth.jwt()->>'sub')
  );
