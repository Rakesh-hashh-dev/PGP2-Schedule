-- ============================================================
-- Campus Board comments — one public thread per post.
-- Additive only. Requires 20260720120000_board.sql.
--
-- Visibility follows the parent post: board_posts RLS applies inside the
-- EXISTS sub-selects below, so a removed post's thread disappears with it.
-- Writing is only allowed while the post is open and unexpired, which is
-- what "resolved locks the thread, reopening unlocks it" means server-side.
-- Moderation mirrors posts: delete own; the post's owner can delete any
-- comment on their post; admins can delete/restore; 3 distinct reports
-- hide a comment.
-- ============================================================

create table if not exists public.board_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.board_posts(id) on delete cascade,
  user_id     text not null,   -- Clerk subject
  user_name   text,
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  reported_by jsonb not null default '[]',
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists board_comments_post_idx on public.board_comments (post_id, created_at);

alter table public.board_comments enable row level security;

drop policy if exists board_comments_select on public.board_comments;
create policy board_comments_select on public.board_comments
  for select using (
    auth.jwt()->>'sub' is not null
    and (not hidden or user_id = auth.jwt()->>'sub' or is_termflow_admin())
    and exists (select 1 from public.board_posts p where p.id = post_id)
  );

drop policy if exists board_comments_insert on public.board_comments;
create policy board_comments_insert on public.board_comments
  for insert with check (
    auth.jwt()->>'sub' = user_id
    and hidden = false
    and reported_by = '[]'::jsonb
    and exists (
      select 1 from public.board_posts p
      where p.id = post_id and p.status = 'open' and p.expires_at > now()
    )
  );

drop policy if exists board_comments_delete on public.board_comments;
create policy board_comments_delete on public.board_comments
  for delete using (
    auth.jwt()->>'sub' = user_id
    or is_termflow_admin()
    or exists (select 1 from public.board_posts p where p.id = post_id and p.user_id = auth.jwt()->>'sub')
  );

-- Only admins edit comments (to restore a hidden one); nobody edits text.
drop policy if exists board_comments_admin_update on public.board_comments;
create policy board_comments_admin_update on public.board_comments
  for update using (is_termflow_admin()) with check (is_termflow_admin());

-- One report per user; 3 distinct reporters hide the comment.
create or replace function public.report_board_comment(p_comment_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter text := auth.jwt()->>'sub';
  v_count int;
begin
  if v_reporter is null then
    raise exception 'not authenticated';
  end if;
  update board_comments
  set reported_by = reported_by || to_jsonb(v_reporter)
  where id = p_comment_id
    and not reported_by ? v_reporter
    and user_id <> v_reporter;
  select jsonb_array_length(reported_by) into v_count from board_comments where id = p_comment_id;
  if v_count >= 3 then
    update board_comments set hidden = true where id = p_comment_id and not hidden;
  end if;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.report_board_comment(uuid) from public, anon;
grant execute on function public.report_board_comment(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.board_comments;
exception when duplicate_object then null;
end;
$$;

-- Comment notifications. Recreates the scoped social INSERT policy with the
-- FULL union of client-insertable types (live list as of 2026-10-27 plus
-- board_comment / board_reply); data.from_id stays pinned to the caller.
drop policy if exists notif_social_insert on public.notifications;
create policy notif_social_insert on public.notifications
  for insert
  with check (
    type in ('friend_request','friend_accepted','group_invite','friend_removed','group_poll',
             'board_contact','meetup_invite','meetup_rsvp','meetup_cancelled',
             'board_comment','board_reply')
    and (data->>'from_id') = (auth.jwt()->>'sub')
  );
