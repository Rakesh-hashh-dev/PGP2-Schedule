-- ============================================================
-- Meetup plans — turn a free slot into a plan (time + place + RSVPs)
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; safe on the live app.
--
-- A meetup is created by one user with an invitee list (member_ids = friends'
-- Clerk ids, creator excluded). Invitees RSVP going/declined. Invites and RSVP
-- notices are client-inserted `notifications` rows (scoped policy below);
-- the T-15min reminder is inserted by the class-reminders sweep (service role)
-- so it lands in the inbox at fire time, not at creation time.
--
-- Trust model: tighter than polls — member_ids IS server-side here, so reads
-- are scoped to creator + invitees rather than all signed-in users.
-- ============================================================

create table if not exists public.meetups (
  id              uuid primary key default gen_random_uuid(),
  created_by      text not null,  -- Clerk subject (auth.jwt()->>'sub')
  created_by_name text,
  title           text not null check (char_length(title) between 1 and 80),
  place           text check (char_length(place) <= 60),
  starts_at       timestamptz not null,
  group_id        text,           -- client-side group id, when planned from a group
  group_name      text,
  member_ids      text[] not null default '{}',  -- invitee Clerk ids (creator excluded)
  cancelled       boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.meetup_rsvps (
  meetup_id    uuid not null references public.meetups (id) on delete cascade,
  user_id      text not null,
  user_name    text,
  response     text not null check (response in ('going','declined')),
  responded_at timestamptz not null default now(),
  primary key (meetup_id, user_id)  -- one row per invitee; changing = upsert
);

alter table public.meetups enable row level security;
alter table public.meetup_rsvps enable row level security;

-- Meetups: visible to the creator and invitees only; creator pinned on insert;
-- only the creator may edit (cancel) or delete.
drop policy if exists meetups_select on public.meetups;
create policy meetups_select on public.meetups
  for select using (
    auth.jwt()->>'sub' = created_by
    or auth.jwt()->>'sub' = any(member_ids)
  );
drop policy if exists meetups_insert on public.meetups;
create policy meetups_insert on public.meetups
  for insert with check (auth.jwt()->>'sub' = created_by);
drop policy if exists meetups_update on public.meetups;
create policy meetups_update on public.meetups
  for update using (auth.jwt()->>'sub' = created_by)
  with check (auth.jwt()->>'sub' = created_by);
drop policy if exists meetups_delete on public.meetups;
create policy meetups_delete on public.meetups
  for delete using (auth.jwt()->>'sub' = created_by);

-- RSVPs: readable by anyone who can see the parent meetup; writable only as
-- yourself, and only if you're an invitee (or the creator) of that meetup.
drop policy if exists meetup_rsvps_select on public.meetup_rsvps;
create policy meetup_rsvps_select on public.meetup_rsvps
  for select using (
    exists (
      select 1 from public.meetups m
      where m.id = meetup_id
        and (auth.jwt()->>'sub' = m.created_by or auth.jwt()->>'sub' = any(m.member_ids))
    )
  );
drop policy if exists meetup_rsvps_insert on public.meetup_rsvps;
create policy meetup_rsvps_insert on public.meetup_rsvps
  for insert with check (
    auth.jwt()->>'sub' = user_id
    and exists (
      select 1 from public.meetups m
      where m.id = meetup_id
        and (auth.jwt()->>'sub' = m.created_by or auth.jwt()->>'sub' = any(m.member_ids))
    )
  );
drop policy if exists meetup_rsvps_update on public.meetup_rsvps;
create policy meetup_rsvps_update on public.meetup_rsvps
  for update using (auth.jwt()->>'sub' = user_id)
  with check (auth.jwt()->>'sub' = user_id);
drop policy if exists meetup_rsvps_delete on public.meetup_rsvps;
create policy meetup_rsvps_delete on public.meetup_rsvps
  for delete using (auth.jwt()->>'sub' = user_id);

create index if not exists meetups_starts_idx on public.meetups (starts_at);
create index if not exists meetups_creator_idx on public.meetups (created_by, starts_at desc);
create index if not exists meetups_members_idx on public.meetups using gin (member_ids);
create index if not exists meetup_rsvps_meetup_idx on public.meetup_rsvps (meetup_id);

-- Live RSVP counts + cancellations for subscribed clients
-- Idempotent add to the realtime publication (a plain `add table` errors if the
-- table is already a member — this whole file is safe to re-run in the SQL Editor).
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='meetups') then
    alter publication supabase_realtime add table public.meetups;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='meetup_rsvps') then
    alter publication supabase_realtime add table public.meetup_rsvps;
  end if;
end $$;

-- ── Client-inserted meetup notifications ─────────────────────────────────────
-- meetup_invite (creator → each invitee), meetup_rsvp (invitee → creator),
-- meetup_cancelled (creator → each invitee). data.from_id stays pinned to the
-- caller. meetup_reminder is NOT here — the class-reminders sweep inserts it
-- with the service role at T-15min.
-- NOTE: polls (20260719120000), this migration, and board (20260720120000) all
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
