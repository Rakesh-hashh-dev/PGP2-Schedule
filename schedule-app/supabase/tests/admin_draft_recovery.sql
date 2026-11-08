begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
do $$ begin
  if public.admin_load_workspace_draft('mess')->>'user_id'<>'admin-one' then raise exception 'Legacy control draft not migrated to its author'; end if;
end $$;
select public.admin_save_workspace_draft('schedule','{"flags":{"classOverrides":{}}}','{"flags":{}}',0,0);
do $$ begin
  if public.admin_load_workspace_draft('schedule')->>'draft_revision'<>'1' then raise exception 'Draft save not recorded'; end if;
  begin perform public.admin_save_workspace_draft('schedule','{"flags":{}}','{"flags":{}}',0,0); raise exception 'Second tab overwrote draft'; exception when serialization_failure then null; end;
  begin perform public.admin_discard_workspace_draft('schedule',0); raise exception 'Stale discard allowed'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"admin-two"}',true);
do $$ begin
  if public.admin_load_workspace_draft('schedule') is not null then raise exception 'Another admins draft visible'; end if;
  if public.admin_load_workspace_draft('mess') is not null then raise exception 'Legacy control draft exposed to another admin'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"observer"}',true);
do $$ begin
  begin perform public.admin_save_workspace_draft('schedule','{"flags":{}}','{"flags":{}}',0,0); raise exception 'Monitor saved draft'; exception when insufficient_privilege then null; end;
  begin perform public.admin_discard_workspace_draft('schedule',0); raise exception 'Monitor deleted draft'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
select public.admin_discard_workspace_draft('schedule',1);
do $$ begin
  if public.admin_load_workspace_draft('schedule') is not null then raise exception 'Discard failed'; end if;
end $$;
reset role;
rollback;
select 'Draft ownership, revision conflicts, Monitor denial and safe discard passed' as result;
