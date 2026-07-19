-- ============================================================
-- Polls — quick votes in group chat + admin cohort-wide polls
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; safe on the live app.
--
-- Two scopes:
--   * scope='group'  — created by any member, rendered inline in that group's
--     chat (a "__poll:<id>" marker row in group_messages points at it).
--   * scope='cohort' — admin-authored, surfaced on the Announcements page.
--
-- Trust model matches group_messages: group membership is client-side, so
-- there is no server-side membership to RLS against — any authenticated user
-- can read polls and vote, but created_by / user_id are pinned to the caller.
-- Cohort-poll creation is client-gated to admins (same posture as the rest of
-- the admin tooling); tighten with a server-side admin check if/when one exists.
-- ============================================================

create table if not exists public.polls (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null check (scope in ('group','cohort')),
  group_id        text,          -- client-side group id (scope='group' only)
  created_by      text not null, -- Clerk subject (auth.jwt()->>'sub')
  created_by_name text,
  question        text not null check (char_length(question) between 1 and 200),
  options         jsonb not null, -- ["Yes","No",...] — 2..6 strings
  multi           boolean not null default false,
  closed          boolean not null default false,
  closes_at       timestamptz,   -- null = open until creator closes
  created_at      timestamptz not null default now(),
  constraint polls_options_count check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  constraint polls_group_scope check (scope <> 'group' or group_id is not null)
);

create table if not exists public.poll_votes (
  poll_id  uuid not null references public.polls (id) on delete cascade,
  user_id  text not null,
  user_name text,
  choice   smallint[] not null, -- indices into polls.options; single-choice = 1 element
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)  -- one row per voter; changing a vote = upsert
);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- Polls: everyone signed-in can read; author pinned on insert; only the author
-- may close/edit or delete their poll.
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls
  for select using (auth.jwt()->>'sub' is not null);
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls
  for insert with check (auth.jwt()->>'sub' = created_by);
drop policy if exists polls_update on public.polls;
create policy polls_update on public.polls
  for update using (auth.jwt()->>'sub' = created_by)
  with check (auth.jwt()->>'sub' = created_by);
drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls
  for delete using (auth.jwt()->>'sub' = created_by);

-- Votes: readable by everyone signed-in (client aggregates counts; group polls
-- also show voter names to the group), writable only as yourself.
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
  for select using (auth.jwt()->>'sub' is not null);
drop policy if exists poll_votes_upsert on public.poll_votes;
create policy poll_votes_upsert on public.poll_votes
  for insert with check (auth.jwt()->>'sub' = user_id);
drop policy if exists poll_votes_update on public.poll_votes;
create policy poll_votes_update on public.poll_votes
  for update using (auth.jwt()->>'sub' = user_id)
  with check (auth.jwt()->>'sub' = user_id);
drop policy if exists poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes
  for delete using (auth.jwt()->>'sub' = user_id);

create index if not exists polls_group_idx on public.polls (group_id, created_at desc);
create index if not exists polls_scope_idx on public.polls (scope, created_at desc);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- Live vote counts + open/close state for subscribed clients
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;

-- ── Notify group members when a poll is posted ────────────────────────────────
-- The poll creator inserts one `group_poll` notifications row per cloud member
-- (client-side, same trust model as friend_request). Extend the scoped social
-- INSERT policy from 20260717120000 to allow the new type; data.from_id stays
-- pinned to the caller.
--
-- NOTE: polls (this file), meetups (20260719140000) and board (20260720120000)
-- all recreate this policy. Each carries the FULL union of client-insertable
-- types so the three migrations are safe to run/re-run in any order.
drop policy if exists notif_social_insert on public.notifications;
create policy notif_social_insert on public.notifications
  for insert
  with check (
    type in ('friend_request','friend_accepted','group_invite','friend_removed','group_poll',
             'board_contact','meetup_invite','meetup_rsvp','meetup_cancelled')
    and (data->>'from_id') = (auth.jwt()->>'sub')
  );
