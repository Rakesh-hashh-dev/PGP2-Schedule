begin;
select set_config('request.jwt.claims','{"sub":"admin-one"}',true);
do $$
declare payload jsonb; preview jsonb; target jsonb; copy jsonb; result jsonb; stored record;
  day text:=((now() at time zone 'Asia/Kolkata')::date+1)::text;
begin
  -- Preview is generated from the actual previous effective session, not feed defaults.
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,
    jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','B203','start','10:30')))));
  preview:=public.admin_preview_schedule_notices(payload,0,'Please arrive early.');
  copy:=preview#>'{classes,0,copy}';
  if copy->>'title'<>'BMD moved to 10:30 AM' then raise exception 'New time absent from title: %',copy; end if;
  if position('9:00 AM → 10:30 AM' in copy->>'body')=0 or position('Room A101 → B203' in copy->>'body')=0
    or position('Tomorrow' in copy->>'body')=0 or position('Section A' in copy->>'body')=0
    or right(copy->>'body',20)<>'Please arrive early.' then raise exception 'Essential details lost to custom note: %',copy; end if;
  result:=public.admin_publish_schedule_with_notice(payload,0,(preview->>'id')::uuid);
  select title,body into stored from public.notifications where dedup_key like 'publication:1:%' and user_id='student-one';
  if stored.title is distinct from copy->>'title' or stored.body is distinct from copy->>'body' then raise exception 'Preview differs from stored inbox'; end if;
  if result->>'notice_count'<>'2' then raise exception 'Recipient count changed'; end if;
  -- A subsequent room edit compares to the already-published room, not A101.
  payload:=jsonb_build_object('flags',jsonb_build_object('classOverrides',jsonb_build_object(day,
    jsonb_build_object('BMD_A@09:00',jsonb_build_object('room','C303','start','10:30')))));
  preview:=public.admin_preview_schedule_notices(payload,1,null);
  copy:=preview#>'{classes,0,copy}';
  if copy->>'title'<>'BMD room changed' or position('Room B203 → C303' in copy->>'body')=0 then raise exception 'Previous override not retained: %',copy; end if;
  -- Cancellation preserves original time and explicit tomorrow wording.
  target:=jsonb_build_object('code','BMD','date',day,'before',jsonb_build_object('start','09:00'),
    'effective',jsonb_build_object('type','cancelled','start','10:30','section','A'));
  copy:=admin_internal.schedule_notice_copy(target,'Faculty unavailable.');
  if copy->>'title'<>'BMD cancelled tomorrow' or position('9:00 AM' in copy->>'body')=0
    or position('Faculty unavailable.' in copy->>'body')=0 then raise exception 'Cancellation context lost: %',copy; end if;
  -- Unknown room/time values remain unknown; do not fabricate before-values.
  copy:=admin_internal.schedule_notice_copy(jsonb_build_object('code','BMD','date',day,'effective',jsonb_build_object('room','C303')),null);
  if position('Room C303' in copy->>'body')=0 or position('→' in copy->>'body')>0 then raise exception 'Fabricated old room: %',copy; end if;
  if admin_internal.notice_time('99:00') is not null or admin_internal.notice_time('00:00')<>'12:00 AM' then raise exception 'Invalid clock formatting'; end if;
end $$;
rollback;
