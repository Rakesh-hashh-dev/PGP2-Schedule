create table public.notifications(id uuid primary key default gen_random_uuid(),user_id text not null,type text not null,title text,body text,url text,icon text,data jsonb,dedup_key text,
  created_at timestamptz not null default now(),delivered_push_at timestamptz,scheduled_for timestamptz,push_delivery_state text,read_at timestamptz,unique(user_id,dedup_key));
alter table public.notifications enable row level security;
grant select,update on public.notifications to authenticated;
create policy own_inbox on public.notifications for all to authenticated using(user_id=auth.jwt()->>'sub');
insert into public.notifications(user_id,type,title,push_delivery_state,delivered_push_at) values('student-one','class_reminder','Class reminder','delivered',now());
insert into public.notifications(user_id,type,title) values('student-two','health_alert','Old unknown evidence');
