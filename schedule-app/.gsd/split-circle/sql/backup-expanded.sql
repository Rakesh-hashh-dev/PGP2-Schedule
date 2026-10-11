begin transaction isolation level repeatable read read only;
set local statement_timeout='20s';
select jsonb_build_object('format','termflow-split-production-backup-v2','captured_at',now(),
 'tables',jsonb_build_object(
 'split_groups',(select coalesce(jsonb_agg(to_jsonb(g) order by id),'[]') from public.split_groups g),
 'split_expenses',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.split_expenses e),
 'split_shares',(select coalesce(jsonb_agg(to_jsonb(s) order by expense_id,user_id),'[]') from public.split_shares s),
 'settlements',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.settlements s),
 'split_preferences',(select coalesce(jsonb_agg(to_jsonb(s) order by user_id),'[]') from public.split_preferences s),
 'split_comments',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.split_comments s),
 'split_audit',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.split_audit s),
 'split_invitations',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.split_invitations s),
 'split_recurring',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.split_recurring s)),
 'bucket',(select to_jsonb(b) from storage.buckets b where id='split-receipts'),
 'receipt_objects',(select coalesce(jsonb_agg(to_jsonb(o) order by name),'[]') from storage.objects o where bucket_id='split-receipts')) as backup;
commit;
