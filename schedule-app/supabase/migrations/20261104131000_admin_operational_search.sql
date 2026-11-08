begin;
create index if not exists admin_audit_page_idx on public.admin_audit_logs(created_at desc,id desc);
create index if not exists admin_feedback_page_idx on public.feedback(created_at desc,id desc);
create function public.admin_operational_search(p_dataset text,p_query text default '',p_from timestamptz default now()-interval '30 days',p_to timestamptz default now(),p_before timestamptz default null,p_before_key text default null,p_status text default null,p_actor text default null,p_export boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare table_name text; fields text[]; capability text; time_key text; id_key text; sql_text text; source_sql text; output jsonb; cap integer:=case when p_export then 1000 else 50 end;
begin
  case p_dataset
    when 'audit' then table_name:='admin_audit_logs'; fields:=array['id','admin_id','action','created_at']; capability:='diagnostics.read';time_key:='created_at';id_key:='id';
    when 'feedback' then table_name:='feedback'; fields:=array['id','user_id','message','status','owner_id','severity','created_at'];capability:='support.read';time_key:='created_at';id_key:='id';
    when 'versions' then table_name:='admin_publication_versions';fields:=array['id','domain','revision','created_by','created_at'];capability:='admin.read';time_key:='created_at';id_key:='id';
    when 'students' then table_name:='profiles';fields:=array['user_id','name','email','last_seen_at','courses'];capability:='support.read';time_key:='last_seen_at';id_key:='user_id';
    when 'notifications' then table_name:='notifications';fields:=array['id','user_id','type','title','push_delivery_state','created_at'];capability:='diagnostics.read';time_key:='created_at';id_key:='id';
    else raise exception 'Dataset is not allowlisted' using errcode='22023';
  end case;
  if not public.admin_has_capability(capability) then raise exception 'Dataset permission required' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' or length(coalesce(p_query,''))>200 then raise exception 'Choose a range of at most 366 days and a search up to 200 characters' using errcode='22023'; end if;
  -- Table and field names come exclusively from the fixed mapping above. Search
  -- uses bound parameters and only the projected, authorized fields.
  source_sql:=case when p_dataset='feedback' then 'select to_jsonb(t)||jsonb_build_object(''status'',coalesce(triage.status,t.status),''owner_id'',triage.owner_id,''severity'',triage.severity) raw from public.feedback t left join public.admin_feedback_triage triage on triage.feedback_id=t.id::text'
    when p_dataset='students' then 'select to_jsonb(t)||jsonb_build_object(''name'',coalesce(nullif(to_jsonb(t)->''name'',''null''::jsonb),t.courses->''_name'')) raw from public.profiles t'
    else format('select to_jsonb(t) raw from public.%I t',table_name) end;
  sql_text:=format($query$
    with source as(%s), projected as(
      select raw->>$1 key,coalesce((raw->>$2)::timestamptz,'1970-01-01'::timestamptz) at,
        (select coalesce(jsonb_object_agg(k,raw->k),'{}') from unnest($3::text[]) k) data from source
    ), filtered as(select * from projected where (at >= $4 and at < $5 or $11='students' and at='1970-01-01'::timestamptz)
      and (coalesce($6,'')='' or strpos(lower(data::text),lower($6))>0)
      and ($7 is null or data->>'status'=$7) and ($8 is null or coalesce(data->>'admin_id',data->>'created_by')=$8)),
    page as(select * from filtered where $9::timestamptz is null or (at,key)<($9,$10) order by at desc,key desc limit $12+1)
    select jsonb_build_object('total',(select count(*) from filtered),'has_more',(select count(*)>$12 from page),
      'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by at desc,key desc),'[]') from (select * from page order by at desc,key desc limit $12) r))
  $query$,source_sql);
  execute sql_text into output using id_key,time_key,fields,p_from,p_to,p_query,p_status,p_actor,p_before,p_before_key,p_dataset,cap;
  if p_dataset in ('students','feedback') or p_export then
    insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub',case when p_export then 'data_export' else 'data_lookup' end,jsonb_build_object('dataset',p_dataset,'searched',coalesce(p_query,'')<>'','rows',jsonb_array_length(output->'rows')));
  end if;
  return output;
end $$;
revoke all on function public.admin_operational_search(text,text,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from public,anon;
grant execute on function public.admin_operational_search(text,text,timestamptz,timestamptz,timestamptz,text,text,text,boolean) to authenticated;
create function public.admin_publication_version(p_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_has_capability('admin.read') then raise exception 'Admin access required' using errcode='42501'; end if;
  return (select to_jsonb(v) from public.admin_publication_versions v where id=p_id);
end $$;
revoke all on function public.admin_publication_version(bigint) from public,anon;
grant execute on function public.admin_publication_version(bigint) to authenticated;
commit;
