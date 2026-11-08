begin;
create function public.admin_student_support(p_user_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare profile jsonb; subscribed integer; course_count integer; feedback_rows jsonb; interventions jsonb;
begin
  if not public.admin_has_capability('support.read') then raise exception 'Student support permission required' using errcode='42501'; end if;
  if p_user_id is null or length(p_user_id) not between 1 and 256 then raise exception 'A student ID is required' using errcode='22023'; end if;
  select jsonb_build_object('user_id',p.user_id,'name',coalesce(nullif(to_jsonb(p)->'name','null'::jsonb),p.courses->'_name'),'email',to_jsonb(p)->'email','courses',p.courses,'last_seen_at',to_jsonb(p)->'last_seen_at') into profile from public.profiles p where p.user_id=p_user_id;
  insert into public.admin_audit_logs(admin_id,action,details) values(auth.jwt()->>'sub','student_support_lookup',jsonb_build_object('user_id',p_user_id,'available',profile is not null));
  if profile is null then return jsonb_build_object('available',false,'user_id',p_user_id); end if;
  select count(*) into subscribed from public.push_subscriptions where user_id=p_user_id;
  select count(*) into course_count from jsonb_each(case when jsonb_typeof(profile->'courses')='object' then profile->'courses' else '{}' end) where left(key,1)<>'_';
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into feedback_rows from (select f.id,f.message,coalesce(t.status,f.status,'pending') status,t.owner_id,t.severity,f.created_at from public.feedback f left join public.admin_feedback_triage t on t.feedback_id=f.id::text where f.user_id=p_user_id order by f.created_at desc limit 10) r;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into interventions from (select id,action,admin_id,created_at from public.admin_audit_logs where (details->>'user_id'=p_user_id or details->>'target_user'=p_user_id) and action not in ('student_support_lookup','notification_lookup','data_lookup') and action not like 'interaction:%' order by created_at desc,id desc limit 10) r;
  return jsonb_build_object('available',true,'profile',profile,'course_count',course_count,'push_devices',subscribed,'feedback',feedback_rows,'interventions',interventions,
    'push_preferences',(select jsonb_build_object('class_reminders',to_jsonb(p)->'class_reminders','cancellation_alerts',p.cancellation_alerts,'types',p.prefs) from public.push_prefs p where p.user_id=p_user_id),'checked_at',clock_timestamp());
end $$;
revoke all on function public.admin_student_support(text) from public,anon;
grant execute on function public.admin_student_support(text) to authenticated;
commit;
