-- Apply in Supabase Dashboard SQL Editor before enabling cloud memory sync.
-- Additive, independent of pet_state, XP, cosmetics and friend-pet RPCs.
begin;
create table if not exists public.companion_memory_events (
 user_id text not null,
 event_id text not null check (length(event_id) between 1 and 150),
 payload jsonb not null check (coalesce(
  jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 4096
  and payload ->> 'id' = event_id
  and payload ->> 'kind' in ('visit','interaction','bond','discovery','album')
  and jsonb_typeof(payload -> 'at') = 'number'
  and length(payload ->> 'petKey') between 1 and 32
 ,false)),
 created_at timestamptz not null default now(),
 primary key (user_id,event_id)
);
alter table public.companion_memory_events enable row level security;
drop policy if exists companion_memory_read on public.companion_memory_events;
create policy companion_memory_read on public.companion_memory_events for select to authenticated using ((select auth.jwt()->>'sub') = user_id);
drop policy if exists companion_memory_insert on public.companion_memory_events;
create policy companion_memory_insert on public.companion_memory_events for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);
-- Immutable events: duplicate uploads use ON CONFLICT DO NOTHING. Another
-- device can append memories, never rewrite a favourite or erase an album.
revoke all on public.companion_memory_events from anon;
revoke all on public.companion_memory_events from authenticated;
grant select,insert on public.companion_memory_events to authenticated;
commit;
