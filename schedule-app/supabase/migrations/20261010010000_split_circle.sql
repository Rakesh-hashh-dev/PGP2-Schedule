-- Stage A: expand only. Existing writes, invite links and public receipt access stay unchanged.
-- Stage B is intentionally outside the automatic migration directory.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.split_groups add column if not exists default_shares jsonb not null default '{}';
alter table public.split_expenses add column if not exists expense_date date;
alter table public.split_expenses add column if not exists version integer not null default 1;
alter table public.split_expenses add column if not exists original_currency text;
alter table public.split_expenses add column if not exists original_shares jsonb;
alter table public.split_expenses add column if not exists recurrence_interval text not null default 'never';
alter table public.split_expenses add column if not exists original_amount numeric(12,2);
alter table public.split_expenses add column if not exists exchange_rate numeric(20,8);
alter table public.split_expenses add column if not exists item_details jsonb not null default '[]';
alter table public.split_expenses add column if not exists adjustment numeric(12,2) not null default 0;
alter table public.split_expenses add column if not exists import_key text;
alter table public.split_expenses add column if not exists request_key text;
update public.split_expenses set expense_date=(created_at at time zone 'Asia/Kolkata')::date where expense_date is null;
alter table public.split_expenses alter column expense_date set default (now() at time zone 'Asia/Kolkata')::date;
alter table public.split_expenses alter column expense_date set not null;
alter table public.split_expenses drop constraint if exists split_expenses_split_type_check;
alter table public.split_expenses add constraint split_expenses_split_type_check check (split_type in ('equal','exact','percent','shares','items'));
create unique index if not exists split_expense_request on public.split_expenses(group_id,created_by,request_key) where request_key is not null;
create unique index if not exists split_expense_import on public.split_expenses(group_id,import_key) where import_key is not null;
create index if not exists split_expense_date on public.split_expenses(group_id,expense_date desc);

create table if not exists public.split_preferences (
 user_id text primary key, budget numeric(12,2) not null default 15000 check(budget>=0), currency text not null default 'INR'
);
create table if not exists public.split_comments (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.split_groups(id) on delete cascade,
 expense_id uuid not null references public.split_expenses(id) on delete cascade,
 user_id text not null, author text not null, body text not null check(char_length(trim(body)) between 1 and 2000), created_at timestamptz not null default now()
);
create table if not exists public.split_audit (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.split_groups(id) on delete cascade,
 record_id uuid not null, actor text not null, action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table if not exists public.split_invitations (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.split_groups(id) on delete cascade,
 token_hash text not null unique, invited_user text, expires_at timestamptz not null default now()+interval '7 days',
 created_by text not null, used_by text, revoked boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.split_recurring (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.split_groups(id) on delete cascade,
 expense_id uuid not null unique references public.split_expenses(id) on delete cascade, created_by text not null,
 interval text not null check(interval in ('weekly','monthly')), anchor_date date not null, next_date date not null,
 active boolean not null default true, template jsonb not null
);
alter table public.split_expenses add column if not exists recurring_id uuid references public.split_recurring(id) on delete set null;
alter table public.split_expenses add column if not exists recurring_date date;
create unique index if not exists split_recurring_occurrence on public.split_expenses(recurring_id,recurring_date) where recurring_id is not null;
create index if not exists split_comments_expense on public.split_comments(expense_id,created_at);
create index if not exists split_audit_group on public.split_audit(group_id,created_at desc);

alter table public.split_preferences enable row level security;
alter table public.split_comments enable row level security;
alter table public.split_audit enable row level security;
alter table public.split_invitations enable row level security;
alter table public.split_recurring enable row level security;
create policy split_preferences_own on public.split_preferences for all to authenticated using(user_id=auth.jwt()->>'sub') with check(user_id=auth.jwt()->>'sub' and currency in ('INR','USD','EUR','GBP','AUD','CAD','JPY','SGD','AED'));
create policy split_comments_read on public.split_comments for select to authenticated using(public.is_split_member(group_id));
create policy split_comments_add on public.split_comments for insert to authenticated with check(user_id=auth.jwt()->>'sub' and public.is_split_member(group_id) and exists(select 1 from public.split_expenses e where e.id=expense_id and e.group_id=split_comments.group_id));
create policy split_audit_read on public.split_audit for select to authenticated using(public.is_split_member(group_id));
create policy split_invites_read on public.split_invitations for select to authenticated using(created_by=auth.jwt()->>'sub' and public.is_split_member(group_id));
create policy split_recurring_read on public.split_recurring for select to authenticated using(public.is_split_member(group_id));
grant select,insert,update,delete on public.split_preferences to authenticated;
grant select,insert on public.split_comments to authenticated;
grant select on public.split_audit,public.split_invitations,public.split_recurring to authenticated;

create or replace function public.split_audit_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row jsonb; after_row jsonb; gid uuid; rid uuid; who text;
begin
 if tg_op<>'INSERT' then before_row=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row=to_jsonb(new); end if;
 gid=coalesce((after_row->>'group_id')::uuid,(before_row->>'group_id')::uuid);
 rid=coalesce((after_row->>'id')::uuid,(before_row->>'id')::uuid);
 who=coalesce(auth.jwt()->>'sub','system');
 if exists(select 1 from public.split_groups where id=gid) then
  insert into public.split_audit(group_id,record_id,actor,action,before_data,after_data)
   values(gid,rid,who,(case when tg_table_name='settlements' then 'Payment ' else 'Expense ' end)||lower(tg_op),before_row,after_row);
 end if;
 return coalesce(new,old);
end $$;

create or replace function public.split_features() returns jsonb language sql stable as $$ select '{"version":0,"phase":"expanded"}'::jsonb $$;
create or replace function public.split_next_date(p_date date,p_interval text,p_anchor date) returns date language sql immutable as $$
 select case when p_interval='weekly' then p_date+7 else (date_trunc('month',p_date)+interval '1 month')::date + (least(extract(day from p_anchor)::integer,extract(day from date_trunc('month',p_date)+interval '2 months'-interval '1 day')::integer)-1) end
$$;

create or replace function public.split_allocate(p_cents numeric,p_weights jsonb) returns jsonb language sql immutable as $$
 with weights as(select key,(value#>>'{}')::numeric as n from jsonb_each(p_weights)), total as(select sum(n) as n from weights),
 floors as(select key,floor(p_cents*weights.n/total.n) as n,(p_cents*weights.n/total.n-floor(p_cents*weights.n/total.n)) as frac from weights,total),
 numbered as(select *,row_number() over(order by frac desc,key collate "C") as rank from floors)
 select jsonb_object_agg(key,n+case when rank<=p_cents-(select sum(n) from floors) then 1 else 0 end) from numbered
$$;

create or replace function public.save_split_expense(p_group uuid,p_data jsonb,p_expense_id uuid default null,p_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid text=auth.jwt()->>'sub'; g public.split_groups; e public.split_expenses; cents numeric; total numeric=0;
 pair record; item jsonb; participant text; item_total numeric=0; original_total numeric; orig_shares jsonb;
 rate numeric; cur text; base_cur text; d date; repeat_value text; request_value text; expected jsonb; raw numeric; adj numeric; item_weights jsonb; allocation jsonb; adjusted jsonb; item_count integer;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select * into g from public.split_groups where id=p_group for share;
 if not found or not(uid=any(g.member_ids)) then raise exception 'Group access denied'; end if;
 request_value=p_data->>'requestKey';
 if p_expense_id is null then
  if request_value is null or char_length(request_value)>100 then raise exception 'Missing retry key'; end if;
  perform pg_advisory_xact_lock(hashtext(p_group::text||uid||request_value));
  select * into e from public.split_expenses where group_id=p_group and created_by=uid and request_key=request_value;
  if found then return to_jsonb(e)||'{"replayed":true}'::jsonb; end if;
  if nullif(p_data->>'importKey','') is not null then
   perform pg_advisory_xact_lock(hashtext(p_group::text||(p_data->>'importKey')));
   select * into e from public.split_expenses where group_id=p_group and (import_key=p_data->>'importKey' or id::text=p_data->>'importKey');
   if found then return to_jsonb(e)||'{"replayed":true}'::jsonb; end if;
  end if;
 else
  select * into e from public.split_expenses where id=p_expense_id and group_id=p_group for update;
  if not found or e.created_by<>uid then raise exception 'Only the author can edit this expense'; end if;
  if p_version is null or e.version<>p_version then raise exception 'This expense changed. Refresh before editing; your draft is still open.'; end if;
 end if;
 if jsonb_typeof(p_data->'shares')<>'object' or jsonb_typeof(p_data->'amountPaise')<>'number' then raise exception 'Invalid expense shares'; end if;
 cents=(p_data->>'amountPaise')::numeric;
 if cents<1 or cents>999999999999 or cents<>trunc(cents) then raise exception 'Invalid amount'; end if;
 for pair in select * from jsonb_each(p_data->'shares') loop
  if not(pair.key=any(g.member_ids)) or jsonb_typeof(pair.value)<>'number' then raise exception 'Choose group participants'; end if;
  raw=(pair.value#>>'{}')::numeric;
  if raw<0 or raw<>trunc(raw) then raise exception 'Invalid share'; end if;
  total=total+raw;
 end loop;
 if total<>cents then raise exception 'Shares must equal the amount'; end if;
 if not(coalesce(p_data->>'paidBy','')=any(g.member_ids)) then raise exception 'Payer must belong to the group'; end if;
 if char_length(trim(coalesce(p_data->>'description','')))<1 or char_length(p_data->>'description')>100 or char_length(coalesce(p_data->>'notes',''))>300 then raise exception 'Check description and notes'; end if;
 if coalesce(p_data->>'splitType','equal') not in ('equal','exact','percent','shares','items') or coalesce(p_data->>'category','other') not in ('food','travel','groceries','stay','shopping','utilities','entertainment','other') then raise exception 'Invalid split or category'; end if;
 if p_data->>'imagePath' is not null and p_data->>'imagePath'<>coalesce(e.image_path,'') and split_part(p_data->>'imagePath','/',1)<>uid then raise exception 'Receipt belongs to another account'; end if;
 if coalesce(p_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Choose an expense date'; end if;
 d=(p_data->>'date')::date;
 cur=coalesce(p_data->>'originalCurrency','INR'); rate=coalesce((p_data->>'rate')::numeric,1);
 base_cur=case g.currency when '₹' then 'INR' when '$' then 'USD' when '€' then 'EUR' when '£' then 'GBP' else g.currency end;
 if cur not in ('INR','USD','EUR','GBP','AUD','CAD','JPY','SGD','AED') or rate<=0 or rate>1000000 or round(rate,8)<>rate then raise exception 'Invalid currency or rate'; end if;
 original_total=coalesce((p_data->>'originalPaise')::numeric,cents);
 if original_total<1 or original_total>999999999999 or original_total<>trunc(original_total) or round(original_total*rate)<>cents or (cur=base_cur and rate<>1) then raise exception 'Conversion does not match the saved amount'; end if;
 orig_shares=coalesce(p_data->'originalShares',p_data->'shares');
 if jsonb_typeof(orig_shares)<>'object' then raise exception 'Invalid original shares'; end if;
 total=0;
 for pair in select * from jsonb_each(orig_shares) loop
  if not(pair.key=any(g.member_ids)) or jsonb_typeof(pair.value)<>'number' then raise exception 'Invalid original participant'; end if;
  raw=(pair.value#>>'{}')::numeric; if raw<0 or raw<>trunc(raw) then raise exception 'Invalid original share'; end if; total=total+raw;
 end loop;
 if total<>original_total then raise exception 'Original shares do not match'; end if;
 -- Reproduce largest-remainder FX allocation instead of trusting submitted converted shares.
 expected=public.split_allocate(cents,orig_shares);
 -- Non-FX allocations are already resolved and must be preserved exactly.
 if rate<>1 and expected<>p_data->'shares' then raise exception 'Converted shares do not match'; end if;
 adj=coalesce((p_data->>'adjustment')::numeric,0);
 if p_data->>'splitType'='items' then
  if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 100 then raise exception 'Add 1–100 items'; end if;
  select jsonb_object_agg(id,0) into expected from unnest(g.member_ids) as id;
  for item in select * from jsonb_array_elements(p_data->'items') loop
   raw=(item->>'amount')::numeric*100;
   if char_length(trim(coalesce(item->>'name','')))<1 or raw<=0 or raw<>trunc(raw) or jsonb_typeof(item->'members')<>'array' or jsonb_array_length(item->'members')<1 then raise exception 'Invalid item'; end if;
   if (select count(distinct value) from jsonb_array_elements_text(item->'members'))<>jsonb_array_length(item->'members') then raise exception 'Duplicate item participants'; end if;
   for participant in select * from jsonb_array_elements_text(item->'members') loop
    if not(participant=any(g.member_ids)) then raise exception 'Invalid item participant'; end if;
   end loop;
   select jsonb_object_agg(id,1) into item_weights from jsonb_array_elements_text(item->'members') as id;
   allocation=public.split_allocate(raw,item_weights);
   for pair in select * from jsonb_each(allocation) loop expected=jsonb_set(expected,array[pair.key],to_jsonb((expected->>pair.key)::numeric+(pair.value#>>'{}')::numeric)); end loop;
   item_total=item_total+raw;
  end loop;
  if adj*100<>trunc(adj*100) or round((item_total/100+adj)*100)<>original_total then raise exception 'Items and adjustment do not match the total'; end if;
  if adj<>0 then
   adjusted=public.split_allocate(abs(adj*100),expected);
   for pair in select * from jsonb_each(adjusted) loop expected=jsonb_set(expected,array[pair.key],to_jsonb((expected->>pair.key)::numeric+sign(adj)*(pair.value#>>'{}')::numeric)); end loop;
  end if;
  if expected<>orig_shares then raise exception 'Item shares do not match assigned participants'; end if;
 end if;
 if p_expense_id is null then
  insert into public.split_expenses(group_id,description,amount,paid_by,split_type,category,notes,created_by,image_path,expense_date,original_currency,original_shares,recurrence_interval,original_amount,exchange_rate,item_details,adjustment,import_key,request_key)
   values(p_group,trim(p_data->>'description'),cents/100,p_data->>'paidBy',coalesce(p_data->>'splitType','equal'),coalesce(p_data->>'category','other'),p_data->>'notes',uid,p_data->>'imagePath',d,cur,orig_shares,coalesce(p_data->>'repeat','never'),original_total/100,rate,coalesce(p_data->'items','[]'),adj,p_data->>'importKey',request_value) returning * into e;
 else
  update public.split_expenses set description=trim(p_data->>'description'),amount=cents/100,paid_by=p_data->>'paidBy',split_type=p_data->>'splitType',category=p_data->>'category',notes=p_data->>'notes',image_path=p_data->>'imagePath',expense_date=d,original_currency=cur,original_shares=orig_shares,recurrence_interval=coalesce(p_data->>'repeat','never'),original_amount=original_total/100,exchange_rate=rate,item_details=coalesce(p_data->'items','[]'),adjustment=adj,version=version+1 where id=p_expense_id returning * into e;
  delete from public.split_shares where expense_id=e.id;
 end if;
 insert into public.split_shares(expense_id,user_id,amount) select e.id,key,(value#>>'{}')::numeric/100 from jsonb_each(p_data->'shares') where (value#>>'{}')::numeric>0;
 repeat_value=coalesce(p_data->>'repeat','never');
 if repeat_value not in ('never','weekly','monthly') then raise exception 'Invalid recurrence'; end if;
 if repeat_value<>'never' then
  insert into public.split_recurring(group_id,expense_id,created_by,interval,anchor_date,next_date,template)
   values(p_group,e.id,uid,repeat_value,d,public.split_next_date(d,repeat_value,d),p_data)
   on conflict(expense_id) do update set template=excluded.template,interval=excluded.interval,active=true,
    anchor_date=case when split_recurring.interval=excluded.interval then split_recurring.anchor_date else d end,
    next_date=case when split_recurring.interval=excluded.interval then split_recurring.next_date else public.split_next_date(d,repeat_value,d) end;
 else
  update public.split_recurring set active=false where expense_id=e.id;
 end if;
 return to_jsonb(e);
end $$;

create or replace function public.post_split_recurring(p_schedule uuid,p_due date) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.split_recurring; data jsonb; row_data jsonb;
begin
 select * into s from public.split_recurring where id=p_schedule for update;
 if not found or s.created_by is distinct from auth.jwt()->>'sub' or not public.is_split_member(s.group_id) then raise exception 'Schedule access denied'; end if;
 select to_jsonb(e) into row_data from public.split_expenses e where recurring_id=s.id and recurring_date=p_due;
 if found then return row_data||'{"replayed":true}'::jsonb; end if;
 if not s.active or s.next_date<>p_due or p_due>(now() at time zone 'Asia/Kolkata')::date then raise exception 'This occurrence is not due'; end if;
 data=s.template||jsonb_build_object('date',p_due,'repeat','never','requestKey','recurring:'||s.id||':'||p_due);
 row_data=public.save_split_expense(s.group_id,data);
 update public.split_expenses set recurring_id=s.id,recurring_date=p_due where id=(row_data->>'id')::uuid;
 update public.split_recurring set next_date=public.split_next_date(p_due,s.interval,s.anchor_date) where id=s.id;
 return row_data;
end $$;
create or replace function public.stop_split_recurring(p_schedule uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.split_recurring set active=false where id=p_schedule and created_by=auth.jwt()->>'sub' and public.is_split_member(group_id);
 if not found then raise exception 'Schedule access denied'; end if;
end $$;

create or replace function public.create_split_invite(p_group uuid,p_user text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare token text; iid uuid;
begin
 if not exists(select 1 from public.split_groups where id=p_group and created_by=auth.jwt()->>'sub' and public.is_split_member(id)) then raise exception 'Only the group owner can invite'; end if;
 token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.split_invitations(group_id,token_hash,invited_user,created_by) values(p_group,encode(sha256(convert_to(token,'UTF8')),'hex'),p_user,auth.jwt()->>'sub') returning id into iid;
 return jsonb_build_object('id',iid,'token',token,'expires_at',now()+interval '7 days');
end $$;
create or replace function public.revoke_split_invite(p_invite uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.split_invitations set revoked=true where id=p_invite and created_by=auth.jwt()->>'sub' and used_by is null and public.is_split_member(group_id);
 if not found then raise exception 'Invitation unavailable'; end if;
end $$;
create or replace function public.accept_split_invite(p_token text,p_name text) returns public.split_groups language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.split_invitations; g public.split_groups; uid text=auth.jwt()->>'sub';
begin
 if uid is null or char_length(p_token)<>64 then raise exception 'Invalid invitation'; end if;
 select * into i from public.split_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or i.revoked or i.expires_at<now() or (i.used_by is not null and i.used_by<>uid) or (i.invited_user is not null and i.invited_user<>uid) then raise exception 'Invitation expired, revoked or assigned to another person'; end if;
 select * into g from public.split_groups where id=i.group_id for update;
 if not(uid=any(g.member_ids)) then
  update public.split_groups set member_ids=array_append(member_ids,uid),member_names=member_names||jsonb_build_object(uid,left(coalesce(nullif(trim(p_name),''),'Member'),100)) where id=i.group_id returning * into g;
 end if;
 update public.split_invitations set used_by=uid where id=i.id;
 return g;
end $$;
-- Defaults cannot reference unrelated people, carry negative weights or contain non-numeric values.
create or replace function public.validate_split_group() returns trigger language plpgsql as $$
declare pair record;
begin
 if not(new.created_by=any(new.member_ids)) then raise exception 'Keep the owner in the group'; end if;
 if tg_op='UPDATE' then
  if new.created_by<>old.created_by then raise exception 'Group owner cannot be changed'; end if;
  if new.currency<>old.currency and exists(select 1 from public.split_expenses where group_id=old.id) then raise exception 'Existing group currency cannot change'; end if;
  if new.member_ids<>old.member_ids and (exists(select 1 from public.split_expenses e where e.group_id=old.id and not(e.paid_by=any(new.member_ids))) or exists(select 1 from public.split_expenses e join public.split_shares s on s.expense_id=e.id where e.group_id=old.id and not(s.user_id=any(new.member_ids))) or exists(select 1 from public.settlements s where s.group_id=old.id and (not(s.from_user=any(new.member_ids)) or not(s.to_user=any(new.member_ids))))) then raise exception 'Keep members with recorded shares in this group'; end if;
 end if;
 if jsonb_typeof(new.default_shares)<>'object' then raise exception 'Invalid default shares'; end if;
 for pair in select * from jsonb_each(new.default_shares) loop
  if not(pair.key=any(new.member_ids)) or jsonb_typeof(pair.value)<>'number' or (pair.value#>>'{}')::numeric<0 then raise exception 'Invalid default participant ratio'; end if;
 end loop;
 return new;
end $$;

revoke all on function public.save_split_expense(uuid,jsonb,uuid,integer),public.post_split_recurring(uuid,date),public.stop_split_recurring(uuid),public.create_split_invite(uuid,text),public.revoke_split_invite(uuid),public.accept_split_invite(text,text),public.split_features() from public;
grant execute on function public.save_split_expense(uuid,jsonb,uuid,integer),public.post_split_recurring(uuid,date),public.stop_split_recurring(uuid),public.create_split_invite(uuid,text),public.revoke_split_invite(uuid),public.accept_split_invite(text,text),public.split_features() to authenticated;
revoke all on function public.split_audit_write() from public;
do $$ declare t text; begin
 foreach t in array array['split_comments','split_audit','split_recurring'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;
