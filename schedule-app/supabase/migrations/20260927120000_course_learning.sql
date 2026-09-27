-- Private course essentials, topics and class notes share the existing user-scoped rows.
alter table public.course_hub_items
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.course_hub_items
  drop constraint if exists course_hub_items_kind_check;

alter table public.course_hub_items
  add constraint course_hub_items_kind_check
  check (kind in ('link', 'prep', 'essentials', 'topic', 'note'));
