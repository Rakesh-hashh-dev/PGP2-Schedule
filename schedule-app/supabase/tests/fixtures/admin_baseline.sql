-- Minimal existing-contract fixture. Run ONLY in an isolated verification DB.
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
create table public.admins(user_id text primary key, role text not null, added_by text,
  added_at timestamptz default now(), constraint admins_role_check check(role in ('monitor','superadmin')));
insert into public.admins(user_id, role) values ('admin-one','superadmin'), ('admin-two','superadmin'), ('observer','monitor');
create function public.admin_role() returns text language sql stable security definer set search_path=public as $$
  select role from public.admins where user_id=auth.jwt()->>'sub';
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admins where user_id=auth.jwt()->>'sub');
$$;
create function public.can_write_config() returns boolean language sql stable security definer set search_path=public as $$
  select public.admin_role()='superadmin';
$$;
create table public.system_config(id text primary key, flags jsonb, announcement text, updated_at timestamptz default now());
create table public.admin_audit_logs(id bigint generated always as identity primary key,
  admin_id text not null, action text not null, details jsonb, created_at timestamptz default now());
alter table public.system_config enable row level security;
create policy "Public config" on public.system_config for select using(true);
create policy "Admin config" on public.system_config for all to authenticated using(public.can_write_config()) with check(public.can_write_config());
grant select on public.system_config to anon, authenticated;
grant insert,update on public.system_config to authenticated;
insert into public.system_config(id,flags) values('global', '{"enabled":true,"adminNotes":{"student-one":"Current private note"},"configHistory":[{"flags":{"adminNotes":{"student-one":"Older private note"},"enabled":false}}],"scheduledConfigDeploys":[{"flags":{"adminNotes":{"student-two":"Scheduled private note"},"room":"A101"}}]}');
create function public.get_admin_stats() returns jsonb language sql security definer as $$ select '{"total":3}'::jsonb; $$;
create function public.get_push_broadcast_stats() returns table(total bigint) language sql security definer as $$ select 4::bigint; $$;
create function public.get_cron_health() returns table(job text) language sql security definer as $$ select 'dispatch'::text; $$;
