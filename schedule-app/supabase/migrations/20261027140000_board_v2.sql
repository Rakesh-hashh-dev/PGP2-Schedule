-- ============================================================
-- Campus Board v2 — location, negotiable flag, multi-photo, renewals
-- Additive only; safe on the live app. Requires 20260720120000_board.sql.
-- The client retries writes without the new columns until this is applied,
-- so it can ship before or after the frontend.
-- ============================================================

alter table public.board_posts
  add column if not exists location    text check (char_length(location) <= 60),
  add column if not exists negotiable  boolean not null default false,
  add column if not exists image_paths jsonb not null default '[]';

-- Backfill: single-photo posts become a one-element gallery.
update public.board_posts
set image_paths = jsonb_build_array(image_path)
where image_path is not null and image_paths = '[]'::jsonb;

-- Gallery size cap (client allows 3).
alter table public.board_posts drop constraint if exists board_posts_image_paths_max;
alter table public.board_posts
  add constraint board_posts_image_paths_max
  check (jsonb_typeof(image_paths) = 'array' and jsonb_array_length(image_paths) <= 3);

-- Owners renew a post by writing expires_at. Clamp it so nobody can pin a
-- post for months: at most 30 days from now, on insert and on update.
create or replace function public.board_posts_clamp_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.expires_at > now() + interval '30 days' then
    new.expires_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists board_posts_clamp_expiry on public.board_posts;
create trigger board_posts_clamp_expiry
  before insert or update of expires_at on public.board_posts
  for each row execute function public.board_posts_clamp_expiry();
