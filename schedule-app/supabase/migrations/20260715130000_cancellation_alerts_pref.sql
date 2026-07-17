-- ============================================================
-- Dedicated opt-out for cancellation push alerts
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; existing users default to ON.
--
-- Cancellation pushes (class-reminders edge function) gate on this column
-- instead of reusing class_reminders, so a user can keep per-class reminders
-- off while still being told when a class is cancelled — or vice versa.
-- ============================================================

alter table public.push_prefs
  add column if not exists cancellation_alerts boolean not null default true;
