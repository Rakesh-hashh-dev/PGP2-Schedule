-- ============================================================
-- Allow 'celebrate' as a board_posts kind
-- The client-side BOARD_KINDS already includes 'celebrate', but the
-- original CHECK constraint on board_posts.kind only allows
-- ('lost','found','sell','ask'). This adds 'celebrate' so
-- Celebrations posts can actually be inserted.
-- Additive only; safe on the live app.
-- ============================================================

-- Drop the old implicit check constraint and recreate with the new kind.
-- Postgres names the inline check "board_posts_kind_check".
alter table public.board_posts drop constraint if exists board_posts_kind_check;
alter table public.board_posts
  add constraint board_posts_kind_check
  check (kind in ('lost','found','sell','ask','celebrate'));

