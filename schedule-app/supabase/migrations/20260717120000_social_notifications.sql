-- Phase 3 (notification redesign): migrate friend_pings' social events into the
-- unified notifications store, and give group chat its own table.
--
-- friend_pings was overloaded: user-targeted social notifications
-- (friend_request, friend_accepted, group_invite), a control signal
-- (friend_removed), and group chat (type:'group_chat') — all with the event type
-- packed as JSON in from_name. This splits by concern:
--   * social events  -> notifications rows (scoped client INSERT policy below)
--   * group chat      -> group_messages table (own volume / retention)
-- See docs/notification-architecture.md §Phase 3.

-- ── Scoped client INSERT policy for social events ──────────────────────────────
-- The sender writes a row targeting someone else (that's the nature of a friend
-- request). Target may be anyone, but data.from_id is pinned to the caller so a
-- sender can't be spoofed — same trust model as friend_pings, minus the fragile
-- JSON-in-from_name. Producers (service role) bypass RLS and are unaffected.
create policy notif_social_insert on notifications
  for insert
  with check (
    type in ('friend_request','friend_accepted','group_invite','friend_removed')
    and (data->>'from_id') = (auth.jwt()->>'sub')
  );

-- ── Group chat table ───────────────────────────────────────────────────────────
-- Chat targets a group (not a user) and has different volume + retention, so it
-- stays out of notifications entirely.
create table if not exists group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   text not null,
  from_id    text not null,
  from_name  text,
  text       text not null,
  created_at timestamptz not null default now()
);

alter table group_messages enable row level security;

-- Group membership currently lives client-side (localStorage + the shared-copy
-- rows in profiles.groups), so there is no server-side membership source to RLS
-- against yet. Until that exists, allow any authenticated user to read/insert but
-- pin from_id to the caller (can't post as someone else). Tighten to a membership
-- check when the group model is server-authoritative.
create policy group_msg_select on group_messages
  for select using (auth.jwt()->>'sub' is not null);
create policy group_msg_insert on group_messages
  for insert with check (auth.jwt()->>'sub' = from_id);

create index if not exists group_messages_group_created_idx
  on group_messages (group_id, created_at);

alter publication supabase_realtime add table group_messages;
