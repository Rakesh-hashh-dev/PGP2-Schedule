-- Phase 1 (notification redesign): the unified event store.
--
-- One row per (user, event). Single source of truth for every notifiable event —
-- class reminders, cancellations, daily summaries, schedule changes, admin
-- broadcasts, and (Phase 3) friend/group events. Replaces reminder_log (dedup via
-- dedup_key) and eventually friend_pings. Powers BOTH the in-app inbox
-- (read_at) and push delivery (delivered_push_at) so the two can never diverge.
--
-- Producers only INSERT here (Phase 2); a single dispatch fn owns push delivery.
-- See docs/notification-architecture.md.

create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  type              text not null,          -- class_reminder | class_cancelled |
                                            -- daily_summary | schedule_change |
                                            -- admin_broadcast | friend_request |
                                            -- friend_accepted | group_invite | group_chat
  title             text not null,
  body              text,
  url               text,
  icon              text,
  data              jsonb,                  -- type-specific metadata (code, section, fromCode…)
  dedup_key         text not null,          -- one event per user; replaces reminder_log
  scheduled_for     timestamptz,            -- null = immediate; set for scheduled/admin pushes
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  delivered_push_at timestamptz,
  unique (user_id, dedup_key)
);

alter table notifications enable row level security;

-- Users read and update (mark read) only their own rows.
create policy notif_own_select on notifications
  for select using (auth.jwt()->>'sub' = user_id);
create policy notif_own_update on notifications
  for update using (auth.jwt()->>'sub' = user_id)
  with check (auth.jwt()->>'sub' = user_id);  -- can't reassign a row to another user
-- No client INSERT/DELETE policy: producers write via the service role (Phase 2).
-- Phase 3 adds a scoped INSERT policy for client-originated social events.

-- Inbox query (newest first per user) and the dispatcher's "not yet pushed" scan.
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);
create index if not exists notifications_undelivered_idx
  on notifications (delivered_push_at) where delivered_push_at is null;

-- Live in-app inbox: stream inserts/updates to the owning client.
alter publication supabase_realtime add table notifications;
