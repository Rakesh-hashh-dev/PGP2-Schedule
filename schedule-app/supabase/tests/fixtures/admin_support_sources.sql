create table public.feedback(id uuid primary key default gen_random_uuid(),user_id text,message text,status text,created_at timestamptz default now());
create table public.admin_feedback_triage(feedback_id text primary key,status text,severity text,owner_id text,updated_by text default 'fixture',updated_at timestamptz default now());
