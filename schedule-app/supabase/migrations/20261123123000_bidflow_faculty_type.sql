-- Preserve the optional Visiting/Internal value from imported course catalogs.
create or replace function public.admin_publish_bidflow(p_payload jsonb, p_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.app_controls;
  v_revision bigint;
  v_next_payload jsonb;
  v_course jsonb;
  v_code text;
  v_term text;
  v_identity text;
  v_range record;
  v_seen text[] := array[]::text[];
  v_total_min jsonb := p_payload->'totalMinCredits';
  v_total_max jsonb := p_payload->'totalMaxCredits';
begin
  if not coalesce(public.admin_has_capability('schedule.publish'), false) or auth.jwt()->>'sub' is null then
    raise exception 'Schedule publish permission required' using errcode = '42501';
  end if;

  if p_payload is null or not public.controls_keys(p_payload, array['enabled','cohort','term','sheetUrl','minCredits','maxCredits','totalMinCredits','totalMaxCredits','termCreditRanges','rulesText','courses','updatedAt'])
    or not (p_payload ?& array['enabled','cohort','term','minCredits','maxCredits','rulesText','courses','updatedAt'])
    or jsonb_typeof(p_payload->'enabled') <> 'boolean'
    or jsonb_typeof(p_payload->'cohort') <> 'string'
    or char_length(btrim(p_payload->>'cohort')) not between 1 and 40
    or jsonb_typeof(p_payload->'term') <> 'string'
    or char_length(btrim(p_payload->>'term')) not between 1 and 40
    or coalesce(p_payload->>'sheetUrl', '') <> ''
    or jsonb_typeof(p_payload->'rulesText') <> 'string'
    or char_length(p_payload->>'rulesText') > 2000
    or jsonb_typeof(p_payload->'updatedAt') <> 'string'
    or char_length(p_payload->>'updatedAt') not between 1 and 40
    or jsonb_typeof(p_payload->'courses') <> 'array'
    or jsonb_typeof(p_payload->'minCredits') <> 'number'
    or jsonb_typeof(p_payload->'maxCredits') <> 'number' then
    raise exception 'Invalid BidFlow catalog settings' using errcode = '22023';
  end if;

  if (p_payload->>'minCredits')::numeric < 0
    or (p_payload->>'maxCredits')::numeric <= 0
    or (p_payload->>'maxCredits')::numeric < (p_payload->>'minCredits')::numeric
    or jsonb_array_length(p_payload->'courses') > 500
    or ((p_payload->>'enabled')::boolean and jsonb_array_length(p_payload->'courses') = 0) then
    raise exception 'Invalid BidFlow credit range or catalog size' using errcode = '22023';
  end if;

  if coalesce(v_total_min, 'null'::jsonb) <> 'null'::jsonb or coalesce(v_total_max, 'null'::jsonb) <> 'null'::jsonb then
    if jsonb_typeof(v_total_min) is distinct from 'number' or jsonb_typeof(v_total_max) is distinct from 'number' then
      raise exception 'Set both overall credit limits or leave both blank' using errcode = '22023';
    end if;
    if v_total_min::numeric < 0 or v_total_max::numeric <= 0 or v_total_max::numeric < v_total_min::numeric then
      raise exception 'Invalid overall credit range' using errcode = '22023';
    end if;
  end if;

  if p_payload ? 'termCreditRanges' then
    if jsonb_typeof(p_payload->'termCreditRanges') <> 'object' then
      raise exception 'Invalid credit ranges by term' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_object_keys(p_payload->'termCreditRanges')) > 20 then
      raise exception 'Too many term credit ranges' using errcode = '22023';
    end if;
    for v_range in select key, value from jsonb_each(p_payload->'termCreditRanges') loop
      if char_length(btrim(v_range.key)) not between 1 and 40
        or not public.controls_keys(v_range.value, array['min','max'])
        or not (v_range.value ?& array['min','max'])
        or jsonb_typeof(v_range.value->'min') <> 'number'
        or jsonb_typeof(v_range.value->'max') <> 'number' then
        raise exception 'Invalid credit range by term' using errcode = '22023';
      end if;
      if (v_range.value->>'min')::numeric < 0 or (v_range.value->>'max')::numeric <= 0
        or (v_range.value->>'max')::numeric < (v_range.value->>'min')::numeric then
        raise exception 'Invalid credit range by term' using errcode = '22023';
      end if;
    end loop;
  end if;

  for v_course in select value from jsonb_array_elements(p_payload->'courses') loop
    if not public.controls_keys(v_course, array['code','name','area','credits','faculty','facultyType','term','slots','description'])
      or not (v_course ?& array['code','name','area','credits'])
      or jsonb_typeof(v_course->'code') <> 'string'
      or jsonb_typeof(v_course->'name') <> 'string'
      or char_length(btrim(v_course->>'name')) not between 1 and 250
      or jsonb_typeof(v_course->'area') <> 'string'
      or char_length(btrim(v_course->>'area')) not between 1 and 80
      or jsonb_typeof(v_course->'credits') <> 'number'
      or coalesce(jsonb_typeof(v_course->'faculty'), 'string') <> 'string'
      or char_length(v_course->>'faculty') > 200
      or coalesce(jsonb_typeof(v_course->'facultyType'), 'string') <> 'string'
      or char_length(v_course->>'facultyType') > 80
      or coalesce(jsonb_typeof(v_course->'term'), 'string') <> 'string'
      or char_length(v_course->>'term') > 40
      or coalesce(jsonb_typeof(v_course->'description'), 'string') <> 'string'
      or char_length(v_course->>'description') > 2000
      or coalesce(jsonb_typeof(v_course->'slots'), 'null') not in ('null','number') then
      raise exception 'Invalid BidFlow course details' using errcode = '22023';
    end if;
    v_code := v_course->>'code';
    v_term := upper(regexp_replace(btrim(coalesce(nullif(btrim(v_course->>'term'), ''), p_payload->>'term')), '^term[[:space:]]+', '', 'i'));
    v_term := case v_term when '1' then 'I' when '2' then 'II' when '3' then 'III' when '4' then 'IV' when '5' then 'V' when '6' then 'VI' else v_term end;
    v_identity := jsonb_build_array(v_term, v_code)::text;
    if char_length(v_code) not between 1 and 40 or v_code <> upper(btrim(v_code)) or btrim(v_code) = ''
      or v_identity = any(v_seen) or (v_course->>'credits')::numeric <= 0 then
      raise exception 'Course codes must be unique within a term and have positive credits' using errcode = '22023';
    end if;
    if jsonb_typeof(v_course->'slots') = 'number' and ((v_course->>'slots')::numeric < 0 or mod((v_course->>'slots')::numeric, 1) <> 0) then
      raise exception 'Invalid course seat count' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_identity);
  end loop;

  select * into strict v_current from public.app_controls where id = 'global' for update;
  if p_revision is null or v_current.revision <> p_revision then
    raise exception 'Settings changed. Reload and review before publishing.' using errcode = '40001';
  end if;

  v_revision := v_current.revision + 1;
  v_next_payload := jsonb_set(v_current.payload, array['bidflow'], p_payload);
  insert into public.app_controls_versions(revision, section, payload, created_by)
    values (v_revision, 'bidflow', v_next_payload, auth.jwt()->>'sub');
  update public.app_controls set payload = v_next_payload, revision = v_revision, updated_at = now()
    where id = 'global';
  insert into public.admin_audit_logs(admin_id, action, details)
    values (auth.jwt()->>'sub', 'app_controls_publish', jsonb_build_object('section', 'bidflow', 'revision', v_revision, 'before', v_current.payload->'bidflow', 'after', p_payload));
  return v_revision;
end;
$$;

revoke all on function public.admin_publish_bidflow(jsonb, bigint) from public, anon;
grant execute on function public.admin_publish_bidflow(jsonb, bigint) to authenticated;

notify pgrst, 'reload schema';
