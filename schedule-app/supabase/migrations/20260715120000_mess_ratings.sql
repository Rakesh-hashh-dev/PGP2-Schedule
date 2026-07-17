-- ============================================================
-- Mess meal ratings — cohort "what's good today" thumbs up/down
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push`)
-- Additive only; safe on the live app.
--
-- One row per (user, day, meal). user_id is the Clerk subject, matching
-- profiles/attendance (Clerk session token → auth.jwt()->>'sub'). Aggregate
-- counts are read through a SECURITY DEFINER RPC so clients never need to see
-- individual rows (no leaking who rated what).
-- ============================================================

create table if not exists public.mess_ratings (
  user_id    text     not null,
  day        date     not null,
  meal       text     not null check (meal in ('breakfast','lunch','snacks','dinner')),
  rating     smallint not null check (rating in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, meal)
);

alter table public.mess_ratings enable row level security;

-- Each user can read/write only their own ratings.
drop policy if exists "mess_ratings own rows" on public.mess_ratings;
create policy "mess_ratings own rows" on public.mess_ratings
  for all
  using (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);

-- Aggregate counts for a given day, safe to expose to everyone.
create or replace function public.get_mess_meal_stats(p_day date)
returns table(meal text, up int, down int)
language sql
security definer
set search_path = public
as $$
  select meal,
    count(*) filter (where rating = 1)::int  as up,
    count(*) filter (where rating = -1)::int as down
  from public.mess_ratings
  where day = p_day
  group by meal;
$$;

grant execute on function public.get_mess_meal_stats(date) to anon, authenticated;
