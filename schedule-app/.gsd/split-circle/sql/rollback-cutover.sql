-- Restore the pre-cutover access contract captured from PGP2 production on 2026-10-10.
-- Keeps all schema and data. Restores the PREVIOUS (less restrictive) security behavior.
-- Invoke during incident response only; never drop new tables/columns to roll back.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
drop trigger if exists split_expense_audit on public.split_expenses;
drop trigger if exists split_payment_audit on public.settlements;
drop trigger if exists split_group_validate on public.split_groups;
drop policy if exists "split_expenses_delete" on "public"."split_expenses";
create policy "split_expenses_delete" on "public"."split_expenses" as PERMISSIVE for DELETE to public using (((auth.jwt() ->> 'sub'::text) = created_by));
drop policy if exists "settlements_insert" on "public"."settlements";
create policy "settlements_insert" on "public"."settlements" as PERMISSIVE for INSERT to public with check ((((auth.jwt() ->> 'sub'::text) = created_by) AND (((auth.jwt() ->> 'sub'::text) = from_user) OR ((auth.jwt() ->> 'sub'::text) = to_user)) AND is_split_member(group_id)));
drop policy if exists "settlements_delete" on "public"."settlements";
create policy "settlements_delete" on "public"."settlements" as PERMISSIVE for DELETE to public using (((auth.jwt() ->> 'sub'::text) = created_by));
drop policy if exists "split_receipts_read" on "storage"."objects";
create policy "split_receipts_read" on "storage"."objects" as PERMISSIVE for SELECT to public using ((bucket_id = 'split-receipts'::text));
grant insert,update on public.split_expenses to authenticated;
grant update on public.settlements to authenticated;
grant insert,update,delete on public.split_shares to authenticated;
CREATE OR REPLACE FUNCTION public.join_split_group(p_group_id uuid, p_name text)
 RETURNS split_groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
update storage.buckets set public=true where id='split-receipts';
-- Preserve the v7.3 RPC path for existing advanced rows during rollback.
create or replace function public.split_features() returns jsonb language sql stable as $$ select '{"version":1,"phase":"compatibility"}'::jsonb $$;
commit;
