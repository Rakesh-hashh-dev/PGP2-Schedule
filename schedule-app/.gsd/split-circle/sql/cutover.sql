-- Stage B: explicit cutover after v7.3 is deployed, backups verified and rollback rehearsed.
-- NOT in supabase/migrations: a routine db push must not activate this stage.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.save_split_expense(uuid,jsonb,uuid,integer)') is null then raise exception 'Apply expansion first'; end if;
end $$;
-- New expenses and resolved shares must be written together through the RPC.
revoke insert,update on public.split_expenses from authenticated;
revoke update on public.settlements from authenticated;
revoke insert,update,delete on public.split_shares from authenticated;
drop policy if exists split_expenses_delete on public.split_expenses;
create policy split_expenses_delete on public.split_expenses for delete to authenticated using(created_by=auth.jwt()->>'sub' and public.is_split_member(group_id));
drop policy if exists settlements_insert on public.settlements;
create policy settlements_insert on public.settlements for insert to authenticated with check(created_by=auth.jwt()->>'sub' and (created_by=from_user or created_by=to_user) and from_user<>to_user and public.is_split_member(group_id) and exists(select 1 from public.split_groups g where g.id=group_id and from_user=any(g.member_ids) and to_user=any(g.member_ids)));
drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements for delete to authenticated using(created_by=auth.jwt()->>'sub' and public.is_split_member(group_id));

create trigger split_expense_audit after insert or update or delete on public.split_expenses for each row execute function public.split_audit_write();
create trigger split_payment_audit after insert or update or delete on public.settlements for each row execute function public.split_audit_write();
create trigger split_group_validate before insert or update on public.split_groups for each row execute function public.validate_split_group();

-- Group IDs are no longer bearer credentials. Existing group/notification deep-links still open groups.
create or replace function public.join_split_group(p_group_id uuid,p_name text) returns public.split_groups language plpgsql as $$ begin raise exception 'Ask the owner for a new secure invitation link'; end $$;

-- Receipts stay in the current bucket; replace public URLs with short-lived authorized signed URLs.
update storage.buckets set public=false where id='split-receipts';
drop policy if exists split_receipts_read on storage.objects;
create policy split_receipts_read on storage.objects for select to authenticated using(bucket_id='split-receipts' and ((storage.foldername(name))[1]=auth.jwt()->>'sub' or exists(select 1 from public.split_expenses e where e.image_path=storage.objects.name and public.is_split_member(e.group_id))));

create or replace function public.split_features() returns jsonb language sql stable as $$ select '{"version":1,"phase":"active"}'::jsonb $$;
commit;
