begin;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
select public.admin_set_role('new-schedule','schedule_editor');
select public.admin_set_role('new-comms','communications_editor');
select public.admin_set_role('new-moderator','moderator');
select set_config('request.jwt.claims','{"sub":"new-schedule"}',true);
do $$ begin
  if not public.admin_has_capability('schedule.publish') or public.can_write_config() then raise exception 'Activated role permissions incorrect'; end if;
  begin perform public.admin_set_role('outsider','superadmin'); raise exception 'Scoped editor granted roles'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Scoped role activation preserves strict capability boundaries' as result;
