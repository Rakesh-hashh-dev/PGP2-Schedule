begin;
insert into public.admin_audit_logs(admin_id,action,details,created_at)
select 'admin-one','search_fixture_'||n,'{"secret":"must not appear"}',now()-interval '1 minute' from generate_series(1,65) n;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
do $$ declare first_page jsonb; next_page jsonb; last_row jsonb; begin
  first_page:=public.admin_operational_search('audit','search_fixture_');
  if first_page->>'total'<>'65' or first_page->>'has_more'<>'true' or jsonb_array_length(first_page->'rows')<>50 then raise exception 'First page incorrect: %',first_page; end if;
  if first_page::text like '%must not appear%' then raise exception 'Unprojected data leaked'; end if;
  last_row:=first_page->'rows'->49;
  next_page:=public.admin_operational_search('audit','search_fixture_',now()-interval '1 day',now(),(last_row->>'at')::timestamptz,last_row->>'key');
  if jsonb_array_length(next_page->'rows')<>15 then raise exception 'Cursor page incorrect'; end if;
  begin perform public.admin_operational_search('push_subscriptions'); raise exception 'Unlisted table allowed'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
do $$ begin
  begin perform public.admin_operational_search('students'); raise exception 'Student data browsing allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Projected fields, literal search, cursor tie handling, full totals, allowlist and access checks passed' as result;
