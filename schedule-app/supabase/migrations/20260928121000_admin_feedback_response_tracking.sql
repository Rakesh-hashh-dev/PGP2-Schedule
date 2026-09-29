-- Records response targets and when the first reply push was queued.
-- This does not claim push delivery or reading by the student.
alter table public.admin_feedback_triage
  add column if not exists response_target_hours integer not null default 48
    check (response_target_hours in (12, 24, 48, 72, 168)),
  add column if not exists first_reply_queued_at timestamptz;
