-- ============================================================
-- Scheduled nudges — "ping me when free" (social plan Phase C)
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; safe on the live app.
--
-- A one-shot, self-targeted reminder: while a friend is in class, the
-- subscriber's client computes when that class ends (the friend's timetable
-- is already shared client-side) and inserts a row. The class-reminders sweep
-- drains due rows into `notifications` (type free_nudge) and deletes them.
-- Nothing here reveals anything the subscriber can't already see.
-- ============================================================

create table if not exists public.scheduled_nudges (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,   -- the subscriber (push recipient), pinned by RLS
  about_user_id text,            -- friend's cloud id (or local id — informational)
  about_name    text not null,
  fire_at       timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table public.scheduled_nudges enable row level security;

-- Strictly self-service: you see, create and cancel only your own nudges.
drop policy if exists nudges_select on public.scheduled_nudges;
create policy nudges_select on public.scheduled_nudges
  for select using (auth.jwt()->>'sub' = user_id);
drop policy if exists nudges_insert on public.scheduled_nudges;
create policy nudges_insert on public.scheduled_nudges
  for insert with check (auth.jwt()->>'sub' = user_id);
drop policy if exists nudges_delete on public.scheduled_nudges;
create policy nudges_delete on public.scheduled_nudges
  for delete using (auth.jwt()->>'sub' = user_id);

-- The sweep's "due now" scan
create index if not exists nudges_fire_idx on public.scheduled_nudges (fire_at);
