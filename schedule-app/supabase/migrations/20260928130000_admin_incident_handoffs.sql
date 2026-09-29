-- Link an operational signal to one active handoff note and retain its completion time.
alter table public.admin_handoff_notes
  add column if not exists incident_key text,
  add column if not exists resolved_at timestamptz;

create unique index if not exists admin_handoff_one_open_incident_idx
  on public.admin_handoff_notes (incident_key)
  where incident_key is not null and status = 'open';
