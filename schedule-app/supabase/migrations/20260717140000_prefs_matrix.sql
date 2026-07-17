-- Phase 5 (notification redesign): per-type channel matrix + quiet hours.
--
-- Extends push_prefs from a handful of booleans into a per-type { push, inapp }
-- matrix plus a quiet-hours window. The dispatcher consults `prefs[row.type]`
-- before pushing (skip push but keep the in-app record when push=false), and
-- suppresses push during quiet hours for non-urgent types only.
--
-- Back-compat: the legacy boolean columns are LEFT IN PLACE and still read by
-- class-reminders. This migration is additive + a one-time backfill; readers that
-- don't know about `prefs` keep working. See docs/notification-architecture.md §Phase 5.

alter table push_prefs add column if not exists quiet_start text;  -- IST "HH:mm", e.g. "22:00"
alter table push_prefs add column if not exists quiet_end   text;  -- IST "HH:mm", e.g. "07:00"
alter table push_prefs add column if not exists prefs jsonb not null default '{}'::jsonb;

-- One-time backfill: project the existing booleans into the matrix. Only fills
-- rows still on the empty default so re-running is idempotent and never clobbers
-- a matrix a user has since edited.
update push_prefs set prefs = jsonb_build_object(
  'class_reminder',  jsonb_build_object('push', coalesce(class_reminders, true),   'inapp', true,
                                        'lead', coalesce(lead_minutes, 30)),
  'class_cancelled', jsonb_build_object('push', coalesce(cancellation_alerts, true),'inapp', true),
  'daily_summary',   jsonb_build_object('push', coalesce(daily_summary, false),     'inapp', true,
                                        'time', coalesce(summary_time, '07:20')),
  'schedule_change', jsonb_build_object('push', false, 'inapp', true),
  'admin_broadcast', jsonb_build_object('push', true,  'inapp', true),
  'friend_request',  jsonb_build_object('push', true,  'inapp', true),
  'friend_accepted', jsonb_build_object('push', true,  'inapp', true),
  'group_invite',    jsonb_build_object('push', true,  'inapp', true)
)
where prefs = '{}'::jsonb;
