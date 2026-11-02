-- Student-readable published state; drafts and history remain admin-only.
create table public.app_controls (
  id text primary key check (id = 'global'), revision bigint not null default 0,
  payload jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
insert into public.app_controls(id) values ('global');
create table public.app_controls_drafts (
  section text primary key check (section in ('mess','navigation','dashboard')),
  payload jsonb not null, base_revision bigint not null,
  updated_by text not null, updated_at timestamptz not null default now()
);
create table public.app_controls_versions (
  revision bigint primary key, section text not null, payload jsonb not null,
  created_by text not null, created_at timestamptz not null default now()
);
alter table public.app_controls enable row level security;
alter table public.app_controls_drafts enable row level security;
alter table public.app_controls_versions enable row level security;
grant select on public.app_controls to anon, authenticated;
grant select on public.app_controls_drafts, public.app_controls_versions to authenticated;
revoke insert, update, delete on public.app_controls, public.app_controls_drafts, public.app_controls_versions from anon, authenticated;
create policy "Published controls readable" on public.app_controls for select using (true);
create policy "Admin drafts readable" on public.app_controls_drafts for select to authenticated using (public.is_admin());
create policy "Admin versions readable" on public.app_controls_versions for select to authenticated using (public.is_admin());

-- Reject unknown keys at every level. Validation also runs on draft save.
create function public.controls_keys(v jsonb, allowed text[]) returns boolean
language sql immutable set search_path = public as $$
 select jsonb_typeof(v) = 'object' and not exists(select 1 from jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k where not (k = any(allowed)));
$$;
create function public.controls_date(v text) returns boolean language plpgsql immutable set search_path=public as $$
begin
 return v ~ '^\d{4}-\d{2}-\d{2}$' and to_char(v::date,'YYYY-MM-DD')=v;
exception when others then return false; end;
$$;
create function public.controls_times(v jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare meal text; t jsonb; s text; e text; prev text := '00:00'; i int := 0;
 starts text[] := array['08:30','13:00','17:30','20:00']; ends text[] := array['10:30','15:00','18:30','22:30'];
begin
 if not public.controls_keys(v,array['breakfast','lunch','snacks','dinner']) then return false; end if;
 foreach meal in array array['breakfast','lunch','snacks','dinner'] loop
  i:=i+1; t:=v->meal;
  if t is not null and (not public.controls_keys(t,array['start','end']) or jsonb_typeof(t->'start') is distinct from 'string' or jsonb_typeof(t->'end') is distinct from 'string') then return false; end if;
  s:=coalesce(t->>'start', starts[i]); e:=coalesce(t->>'end', ends[i]);
  if s !~ '^([01]\d|2[0-3]):[0-5]\d$' or e !~ '^([01]\d|2[0-3]):[0-5]\d$' or s>=e or s<prev then return false; end if;
  prev:=e;
 end loop; return true;
end;
$$;
create function public.validate_app_controls(section text, v jsonb) returns void
language plpgsql set search_path=public as $$
declare entry record; meal record; item jsonb; area text; allowed text[]; d text; n jsonb;
 nav text[] := array['today','tomorrow','fullSchedule','courseHub','planner','attendance','exams','assignments','notifications','friends','board','messMenu','split','pet','wrapped'];
 cards text[] := array['upcoming','summary','timeline','mess','todayCommand','deadlines'];
begin
 if v is null or jsonb_typeof(v) <> 'object' or octet_length(v::text)>150000 then raise exception 'Invalid controls payload'; end if;
 if section='mess' then
  if not public.controls_keys(v,array['weekly','dates','timings','datedTimings','notices','anchor','feedUrl']) then raise exception 'Invalid mess fields'; end if;
  foreach area in array array['weekly','dates'] loop
   n:=coalesce(v->area,'{}');
   if jsonb_typeof(n)<>'object' then raise exception 'Invalid menu map'; end if;
   if (select count(*) from jsonb_object_keys(n)) > (case when area='weekly' then 7 else 120 end) then raise exception 'Too many menu entries'; end if;
   for entry in select * from jsonb_each(n) loop
    if (area='weekly' and entry.key !~ '^[0-6]$') or (area='dates' and not public.controls_date(entry.key)) then raise exception 'Invalid menu date'; end if;
    allowed:=case when area='weekly' then array['breakfast','lunch','snacksW13','snacksW24','dinner'] else array['breakfast','lunch','snacks','dinner'] end;
    if not public.controls_keys(entry.value,allowed) then raise exception 'Invalid meal'; end if;
    for meal in select * from jsonb_each(entry.value) loop
     if jsonb_typeof(meal.value)<>'array' or jsonb_array_length(meal.value)>40 then raise exception 'Invalid dishes'; end if;
     for item in select * from jsonb_array_elements(meal.value) loop
      if jsonb_typeof(item)<>'string' or length(btrim(item#>>'{}'))=0 or length(item#>>'{}')>160 then raise exception 'Invalid dish'; end if;
     end loop;
     if (select count(*)<>count(distinct x) from jsonb_array_elements(meal.value) x) then raise exception 'Duplicate dish'; end if;
    end loop;
   end loop;
  end loop;
  if v ? 'anchor' and (jsonb_typeof(v->'anchor')<>'string' or not public.controls_date(v->>'anchor') or extract(isodow from (v->>'anchor')::date)<>1) then raise exception 'Anchor must be Monday'; end if;
  if v ? 'feedUrl' and (jsonb_typeof(v->'feedUrl')<>'string' or ((v->>'feedUrl')<>'' and (v->>'feedUrl') !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$')) then raise exception 'Invalid source URL'; end if;
  if not public.controls_times(coalesce(v->'timings','{}')) then raise exception 'Invalid timings'; end if;
  n:=coalesce(v->'datedTimings','{}');
  if jsonb_typeof(n)<>'object' then raise exception 'Invalid dated timings'; end if;
  if (select count(*) from jsonb_object_keys(n))>120 then raise exception 'Too many dated timings'; end if;
  for entry in select * from jsonb_each(n) loop
   if not public.controls_date(entry.key) or not public.controls_keys(entry.value,array['breakfast','lunch','snacks','dinner']) or not public.controls_times(coalesce(v->'timings','{}') || entry.value) then raise exception 'Invalid dated timings'; end if;
  end loop;
  n:=coalesce(v->'notices','[]');
  if jsonb_typeof(n)<>'array' or jsonb_array_length(n)>30 then raise exception 'Invalid notices'; end if;
  for item in select * from jsonb_array_elements(n) loop
   if not public.controls_keys(item,array['id','text','start','end']) or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 80 or jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 1 and 300 or jsonb_typeof(item->'start') is distinct from 'string' or jsonb_typeof(item->'end') is distinct from 'string' then raise exception 'Invalid notice'; end if;
   if (item->>'start') !~ '(Z|[+-]\d\d:\d\d)$' or (item->>'end') !~ '(Z|[+-]\d\d:\d\d)$' or (item->>'start')::timestamptz >= (item->>'end')::timestamptz then raise exception 'Invalid notice window'; end if;
  end loop;
 elsif section='navigation' then
  if not public.controls_keys(v,array['items','order']) or not public.controls_keys(coalesce(v->'items','{}'),nav) then raise exception 'Invalid navigation fields'; end if;
  for entry in select * from jsonb_each(coalesce(v->'items','{}')) loop
   if not public.controls_keys(entry.value,array['label','visible']) then raise exception 'Invalid navigation item'; end if;
   if entry.value ? 'label' and (jsonb_typeof(entry.value->'label')<>'string' or length(btrim(entry.value->>'label')) not between 1 and 40) then raise exception 'Invalid navigation label'; end if;
   if entry.value ? 'visible' and jsonb_typeof(entry.value->'visible')<>'boolean' then raise exception 'Invalid visibility'; end if;
   if entry.key='today' and entry.value->>'visible'='false' then raise exception 'Today must remain visible'; end if;
  end loop;
 elsif section='dashboard' then
  if not public.controls_keys(v,array['order','visible','density','weekPanel']) or not public.controls_keys(coalesce(v->'visible','{}'),array['summary','todayCommand','upcoming','mess','weather','deadlines']) then raise exception 'Invalid dashboard fields'; end if;
  for item in select value from jsonb_each(coalesce(v->'visible','{}')) loop
   if jsonb_typeof(item)<>'boolean' then raise exception 'Invalid widget visibility'; end if;
  end loop;
  if v ? 'density' and (jsonb_typeof(v->'density')<>'string' or v->>'density' not in ('compact','comfortable')) then raise exception 'Invalid density'; end if;
  if v ? 'weekPanel' and jsonb_typeof(v->'weekPanel')<>'boolean' then raise exception 'Invalid week panel'; end if;
 else raise exception 'Unknown controls section'; end if;
 if section in ('navigation','dashboard') and v ? 'order' then
  n:=v->'order'; allowed:=case when section='navigation' then nav else cards end;
  if jsonb_typeof(n)<>'array' then raise exception 'Invalid order'; end if;
  for item in select * from jsonb_array_elements(n) loop
   d:=item#>>'{}'; if jsonb_typeof(item)<>'string' or not d=any(allowed) then raise exception 'Invalid order item'; end if;
  end loop;
  if (select count(*)<>count(distinct x) from jsonb_array_elements(n) x) then raise exception 'Duplicate order item'; end if;
 end if;
end;
$$;

create function public.admin_save_controls_draft(p_section text, p_payload jsonb, p_revision bigint) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.jwt()->>'sub' is null or not public.can_write_config() then raise exception 'Superadmin permission required' using errcode='42501'; end if;
 perform public.validate_app_controls(p_section,p_payload);
 insert into public.app_controls_drafts(section,payload,base_revision,updated_by) values(p_section,p_payload,p_revision,auth.jwt()->>'sub')
 on conflict(section) do update set payload=excluded.payload,base_revision=excluded.base_revision,updated_by=excluded.updated_by,updated_at=now();
end;
$$;
create function public.admin_publish_controls(p_section text, p_payload jsonb, p_revision bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare current_row public.app_controls; next_payload jsonb; next_revision bigint;
begin
 if auth.jwt()->>'sub' is null or not public.can_write_config() then raise exception 'Superadmin permission required' using errcode='42501'; end if;
 perform public.validate_app_controls(p_section,p_payload);
 select * into current_row from public.app_controls where id='global' for update;
 if p_revision is null or current_row.revision<>p_revision then raise exception 'Settings changed. Reload and review before publishing.' using errcode='40001'; end if;
 next_revision:=current_row.revision+1; next_payload:=jsonb_set(current_row.payload,array[p_section],p_payload,true);
 insert into public.app_controls_versions(revision,section,payload,created_by) values(next_revision,p_section,next_payload,auth.jwt()->>'sub');
 update public.app_controls set payload=next_payload,revision=next_revision,updated_at=now() where id='global';
 insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','app_controls_publish',jsonb_build_object('section',p_section,'revision',next_revision,'before',current_row.payload->p_section,'after',p_payload));
 delete from public.app_controls_drafts where section=p_section and payload=p_payload and base_revision=p_revision;
 return next_revision;
end;
$$;
revoke all on function public.admin_save_controls_draft(text,jsonb,bigint), public.admin_publish_controls(text,jsonb,bigint) from public, anon;
grant execute on function public.admin_save_controls_draft(text,jsonb,bigint), public.admin_publish_controls(text,jsonb,bigint) to authenticated;
