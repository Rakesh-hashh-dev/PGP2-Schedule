-- Campus Travel Board
-- Students post cab-pooling / auto-sharing listings when leaving campus.
-- WhatsApp is used for direct coordination; no in-app chat needed.

create table public.travel_listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,                        -- Clerk sub
  user_name     text not null,
  journey_date  date not null,
  depart_time   time not null,
  origin        text not null check (char_length(origin) between 2 and 80),
  destination   text not null check (char_length(destination) between 2 and 80),
  mode          text not null check (mode in ('cab','auto','bus','other')),
  onward        text not null check (char_length(onward) between 2 and 120),
  seats         int  not null default 1 check (seats between 1 and 6),
  note          text check (note is null or char_length(note) <= 200),
  wa_number     text not null check (wa_number ~ '^[0-9]{10,15}$'),
  created_at    timestamptz not null default now(),
  -- Auto-expire: listings older than 1 day past the journey date are hidden
  -- by the RLS policy; a nightly cron can delete them for cleanliness.
  constraint origin_ne_destination check (origin <> destination)
);

-- Indexes
create index travel_listings_date_idx on public.travel_listings (journey_date, depart_time);
create index travel_listings_user_idx on public.travel_listings (user_id);

-- RLS
alter table public.travel_listings enable row level security;

-- Everyone (authenticated) can read listings that are still live:
-- journey_date >= today (allow same-day listings throughout the day)
create policy travel_listings_read on public.travel_listings
  for select to authenticated
  using (journey_date >= current_date - interval '1 day');

-- Users can insert their own listings
create policy travel_listings_insert on public.travel_listings
  for insert to authenticated
  with check (user_id = (auth.jwt() ->> 'sub'));

-- Users can delete only their own listings
create policy travel_listings_delete on public.travel_listings
  for delete to authenticated
  using (user_id = (auth.jwt() ->> 'sub'));

-- Admins can delete any (for moderation) — handled via service role in admin dashboard

