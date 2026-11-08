-- Reuse Campus Board ownership, image storage, comments, and moderation.
begin;
alter table public.board_posts drop constraint if exists board_posts_kind_check;
alter table public.board_posts add constraint board_posts_kind_check
  check (kind in ('lost','found','sell','ask','celebrate'));
-- Celebration posts do not carry marketplace prices or phone/contact fields.
alter table public.board_posts add constraint board_celebration_fields_check
  check (kind <> 'celebrate' or (price is null and contact is null));
commit;
