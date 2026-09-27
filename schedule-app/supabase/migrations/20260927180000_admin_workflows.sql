-- Private workflow records for Admin Tools. The public feedback row remains
-- student-owned; internal ownership and severity are never stored in config.
create table if not exists public.admin_feedback_triage (
  feedback_id text primary key,
  status text not null default 'pending' check (status in ('pending', 'investigating', 'planned', 'resolved', 'duplicate')),
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high')),
  owner_id text,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_handoff_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  detail text not null default '',
  next_action text not null check (char_length(trim(next_action)) between 1 and 500),
  owner_id text,
  expires_at date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_handoff_notes_open_idx
  on public.admin_handoff_notes (status, expires_at, created_at desc);

alter table public.admin_feedback_triage enable row level security;
alter table public.admin_handoff_notes enable row level security;

create policy "Admins read feedback triage" on public.admin_feedback_triage
  for select to authenticated using (public.is_admin());
create policy "Writing admins create feedback triage" on public.admin_feedback_triage
  for insert to authenticated with check (public.can_write_config() and updated_by = auth.jwt()->>'sub');
create policy "Writing admins update feedback triage" on public.admin_feedback_triage
  for update to authenticated using (public.can_write_config())
  with check (public.can_write_config() and updated_by = auth.jwt()->>'sub');

create policy "Admins read handoff notes" on public.admin_handoff_notes
  for select to authenticated using (public.is_admin());
create policy "Writing admins create handoff notes" on public.admin_handoff_notes
  for insert to authenticated with check (public.can_write_config() and created_by = auth.jwt()->>'sub' and updated_by = auth.jwt()->>'sub');
create policy "Writing admins update handoff notes" on public.admin_handoff_notes
  for update to authenticated using (public.can_write_config())
  with check (public.can_write_config() and updated_by = auth.jwt()->>'sub');

grant select, insert, update on public.admin_feedback_triage to authenticated;
grant select, insert, update on public.admin_handoff_notes to authenticated;
