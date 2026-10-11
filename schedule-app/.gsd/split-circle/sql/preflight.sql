begin transaction isolation level repeatable read read only;
set local statement_timeout='20s';
select jsonb_build_object(
 'checked_at',now(),'postgres_version',current_setting('server_version'),
 'counts',jsonb_build_object('groups',(select count(*) from public.split_groups),'expenses',(select count(*) from public.split_expenses),'shares',(select count(*) from public.split_shares),'settlements',(select count(*) from public.settlements),'receipt_objects',(select count(*) from storage.objects where bucket_id='split-receipts')),
 'totals',jsonb_build_object('expenses',(select coalesce(sum(amount),0) from public.split_expenses),'shares',(select coalesce(sum(amount),0) from public.split_shares),'settlements',(select coalesce(sum(amount),0) from public.settlements)),
 'anomalies',jsonb_build_object(
  'share_total_mismatches',(select count(*) from public.split_expenses e where e.amount<>coalesce((select sum(s.amount) from public.split_shares s where s.expense_id=e.id),0)),
  'payers_outside_group',(select count(*) from public.split_expenses e join public.split_groups g on g.id=e.group_id where not(e.paid_by=any(g.member_ids))),
  'shares_outside_group',(select count(*) from public.split_shares s join public.split_expenses e on e.id=s.expense_id join public.split_groups g on g.id=e.group_id where not(s.user_id=any(g.member_ids))),
  'settlements_outside_group',(select count(*) from public.settlements s join public.split_groups g on g.id=s.group_id where not(s.from_user=any(g.member_ids)) or not(s.to_user=any(g.member_ids))),
  'owners_outside_group',(select count(*) from public.split_groups where not(created_by=any(member_ids))),
  'missing_receipt_objects',(select count(*) from public.split_expenses e where e.image_path is not null and not exists(select 1 from storage.objects o where o.bucket_id='split-receipts' and o.name=e.image_path))),
 'bucket',(select to_jsonb(b) from storage.buckets b where id='split-receipts'),
 'new_objects',jsonb_build_object('preferences',to_regclass('public.split_preferences'),'comments',to_regclass('public.split_comments'),'audit',to_regclass('public.split_audit'),'invitations',to_regclass('public.split_invitations'),'recurring',to_regclass('public.split_recurring'),'save_rpc',to_regprocedure('public.save_split_expense(uuid,jsonb,uuid,integer)')),
 'columns',(select jsonb_agg(to_jsonb(c)) from information_schema.columns c where table_schema='public' and table_name in ('split_groups','split_expenses','split_shares','settlements')),
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where (schemaname='public' and tablename in ('split_groups','split_expenses','split_shares','settlements')) or (schemaname='storage' and tablename='objects')),
 'grants',(select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema='public' and table_name in ('split_groups','split_expenses','split_shares','settlements')),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'identity',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'split_%' or p.proname in ('join_split_group','is_split_member','validate_split_group','save_split_expense','post_split_recurring','stop_split_recurring','create_split_invite','revoke_split_invite','accept_split_invite'))),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c where c.conrelid in ('public.split_groups'::regclass,'public.split_expenses'::regclass,'public.split_shares'::regclass,'public.settlements'::regclass)),
 'triggers',(select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.split_groups'::regclass,'public.split_expenses'::regclass,'public.split_shares'::regclass,'public.settlements'::regclass)),
 'table_sizes',(select jsonb_agg(jsonb_build_object('table',rel::text,'bytes',pg_total_relation_size(rel))) from unnest(array['public.split_groups'::regclass,'public.split_expenses'::regclass,'public.split_shares'::regclass,'public.settlements'::regclass]) rel),
 'publications',(select jsonb_agg(to_jsonb(p)) from pg_publication_tables p where schemaname='public' and (tablename like 'split_%' or tablename='settlements')),
 'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)
) as preflight;
commit;
