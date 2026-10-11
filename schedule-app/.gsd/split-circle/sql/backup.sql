begin transaction isolation level repeatable read read only;
set local statement_timeout='20s';
select jsonb_build_object('format','termflow-split-production-backup-v1','captured_at',now(),
 'tables',jsonb_build_object(
 'split_groups',(select coalesce(jsonb_agg(to_jsonb(g) order by id),'[]') from public.split_groups g),
 'split_expenses',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.split_expenses e),
 'split_shares',(select coalesce(jsonb_agg(to_jsonb(s) order by expense_id,user_id),'[]') from public.split_shares s),
 'settlements',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.settlements s)),
 'bucket',(select to_jsonb(b) from storage.buckets b where id='split-receipts'),
 'receipt_objects',(select coalesce(jsonb_agg(to_jsonb(o) order by name),'[]') from storage.objects o where bucket_id='split-receipts')) as backup;
commit;
