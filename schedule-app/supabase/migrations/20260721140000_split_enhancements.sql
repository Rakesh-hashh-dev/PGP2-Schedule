-- ============================================================
-- TermFlow Split — enhancements: receipt photos + join-by-link
-- Run in: Supabase Dashboard → SQL Editor (or apply via Management API)
-- Additive only; safe on the live app. Run AFTER 20260721120000_split.sql
-- ============================================================

-- ── Receipt photo on an expense ───────────────────────────────────────────────
alter table public.split_expenses add column if not exists image_path text;

-- Public-read bucket for receipts; uploads path-scoped to the caller's own
-- user-id folder (client resizes to ≤1280px webp before upload). 3MB backstop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('split-receipts', 'split-receipts', true, 3145728, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists split_receipts_read on storage.objects;
create policy split_receipts_read on storage.objects
  for select using (bucket_id = 'split-receipts');
drop policy if exists split_receipts_insert on storage.objects;
create policy split_receipts_insert on storage.objects
  for insert with check (
    bucket_id = 'split-receipts'
    and (storage.foldername(name))[1] = auth.jwt()->>'sub'
  );
drop policy if exists split_receipts_delete on storage.objects;
create policy split_receipts_delete on storage.objects
  for delete using (
    bucket_id = 'split-receipts'
    and (storage.foldername(name))[1] = auth.jwt()->>'sub'
  );

-- ── Join a split group by invite link ─────────────────────────────────────────
-- The group RLS only lets the creator edit member_ids. To let someone join via a
-- shared link, this SECURITY DEFINER RPC appends the caller (and their display
-- name) to the group's member list. Idempotent — re-joining is a no-op.
create or replace function public.join_split_group(p_group_id uuid, p_name text)
returns public.split_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.jwt()->>'sub';
  v_row public.split_groups;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update split_groups
  set member_ids  = case when v_uid = any(member_ids) then member_ids else array_append(member_ids, v_uid) end,
      member_names = case when member_names ? v_uid then member_names
                          else member_names || jsonb_build_object(v_uid, coalesce(nullif(trim(p_name), ''), 'Member')) end
  where id = p_group_id
  returning * into v_row;
  if not found then
    raise exception 'group not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.join_split_group(uuid, text) to authenticated;
