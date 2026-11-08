-- Scoped publication and moderation are available before grants are enabled.
begin;
create or replace function public.admin_set_role(p_user_id text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(611041210);
  if not public.admin_has_capability('roles.manage') then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if p_user_id is null or btrim(p_user_id)='' or p_role is null or p_role not in ('monitor','superadmin','schedule_editor','communications_editor','moderator') then raise exception 'A user and valid role are required' using errcode='22023'; end if;
  if p_role<>'superadmin' and exists(select 1 from public.admins where user_id=p_user_id and role='superadmin') and (select count(*) from public.admins where role='superadmin')<=1 then raise exception 'Cannot demote the last superadmin' using errcode='23514'; end if;
  insert into public.admins(user_id,role,added_by) values(p_user_id,p_role,auth.jwt()->>'sub') on conflict(user_id) do update set role=excluded.role,added_by=excluded.added_by;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','admin_role_changed',jsonb_build_object('user_id',p_user_id,'role',p_role));
end $$;
commit;
