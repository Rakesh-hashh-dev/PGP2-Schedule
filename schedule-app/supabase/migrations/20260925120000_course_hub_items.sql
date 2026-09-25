-- Private course links and preparation checklist items.
-- Apply through the Supabase SQL editor after review; this is additive.
create table if not exists public.course_hub_items (
  user_id text not null,
  id text not null,
  term text not null,
  course_code text not null,
  kind text not null check (kind in ('link', 'prep')),
  title text not null check (char_length(title) between 1 and 120),
  url text check (url is null or char_length(url) <= 2048),
  session_key text,
  done boolean not null default false,
  deleted boolean not null default false,
  updated_at bigint not null,
  primary key (user_id, id)
);

create index if not exists course_hub_items_user_course_idx
  on public.course_hub_items (user_id, term, course_code);

alter table public.course_hub_items enable row level security;

create policy course_hub_select on public.course_hub_items
  for select using (auth.jwt()->>'sub' = user_id);
create policy course_hub_insert on public.course_hub_items
  for insert with check (auth.jwt()->>'sub' = user_id);
create policy course_hub_update on public.course_hub_items
  for update using (auth.jwt()->>'sub' = user_id)
  with check (auth.jwt()->>'sub' = user_id);

grant select, insert, update on public.course_hub_items to authenticated;
