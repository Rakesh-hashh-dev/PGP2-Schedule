-- Phase 4 (notification redesign): server-side schedule-diff snapshot store.
--
-- The `schedule-diff` producer compares each live-feed fetch against the previous
-- fetch to detect added / moved classes, then inserts schedule_change
-- notification rows for affected students — a SERVER source of truth so every
-- device agrees and read-state syncs via notifications.read_at (today the
-- Announcements feed is client-derived per device).
--
-- Kept separate from schedule_cache (which class-reminders overwrites every run
-- as a live-feed fallback); this table holds the *previous* snapshot to diff
-- against. Single row, id = 'latest'. Written only by the service role.
-- See docs/notification-architecture.md §Phase 4.

create table if not exists schedule_snapshots (
  id         text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table schedule_snapshots enable row level security;
-- No client policy: producer writes via the service role; nothing reads it client-side.
