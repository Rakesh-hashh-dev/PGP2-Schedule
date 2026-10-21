-- Soft rollback before any advanced records exist; retains all additive schema.
-- After advanced records exist, use rollback-cutover.sql and keep v7.3 deployed instead.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$ begin
 if exists(select 1 from public.split_expenses where split_type='items' or original_currency is not null or recurring_id is not null) or exists(select 1 from public.split_comments) or exists(select 1 from public.split_recurring) or exists(select 1 from public.split_invitations) or exists(select 1 from public.split_preferences) then
  raise exception 'Advanced data exists: preserve v7.3 and use compatibility rollback';
 end if;
end $$;
create or replace function public.split_features() returns jsonb language sql stable as $$ select '{"version":0,"phase":"expanded"}'::jsonb $$;
commit;
