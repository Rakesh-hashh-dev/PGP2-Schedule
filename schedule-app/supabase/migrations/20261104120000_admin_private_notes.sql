-- Notes must never ride in the publicly readable configuration, even in history.
begin;

create table public.admin_student_notes (
  user_id text primary key,
  body text not null default '',
  revision bigint not null default 0 check (revision >= 0),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create table public.admin_private_config_archive (
  id bigint generated always as identity primary key,
  source_id text not null,
  payload jsonb not null,
  archived_at timestamptz not null default now()
);
alter table public.admin_student_notes enable row level security;
alter table public.admin_private_config_archive enable row level security;
revoke all on public.admin_student_notes, public.admin_private_config_archive from anon, authenticated;
grant select on public.admin_student_notes to authenticated;
create policy "Registered admins read student notes" on public.admin_student_notes
  for select to authenticated using (public.admin_role() in ('monitor', 'superadmin'));
-- Archive has no client policies: historical notes can be recovered by a DBA,
-- never exported through ordinary config history or the student API.

create or replace function public.admin_strip_private_config(p_value jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare result jsonb; pair record;
begin
  case jsonb_typeof(p_value)
  when 'object' then
    result := '{}'::jsonb;
    for pair in select key, value from jsonb_each(p_value) loop
      if pair.key not in ('adminNotes', 'adminRoles') then
        result := result || jsonb_build_object(pair.key, public.admin_strip_private_config(pair.value));
      end if;
    end loop;
    return result;
  when 'array' then
    select coalesce(jsonb_agg(public.admin_strip_private_config(value) order by ord), '[]'::jsonb)
      into result from jsonb_array_elements(p_value) with ordinality as a(value, ord);
    return result;
  else return p_value;
  end case;
end;
$$;

-- Archive the entire affected payload before stripping nested snapshots. This
-- preserves older note versions without making them ordinary restore targets.
insert into public.admin_private_config_archive(source_id, payload)
select id::text, flags from public.system_config
where flags is distinct from public.admin_strip_private_config(flags);

insert into public.admin_student_notes(user_id, body, revision, updated_by)
select e.key, e.value #>> '{}', 1, 'migration:private-notes'
from public.system_config sc
cross join lateral jsonb_each(case when jsonb_typeof(sc.flags->'adminNotes') = 'object'
  then sc.flags->'adminNotes' else '{}'::jsonb end) e
where sc.id = 'global' and jsonb_typeof(e.value) = 'string';

update public.system_config set flags = public.admin_strip_private_config(flags)
where flags is distinct from public.admin_strip_private_config(flags);

create or replace function public.admin_reject_private_config()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.flags is distinct from public.admin_strip_private_config(new.flags) then
    raise exception 'Private admin fields cannot be published. Reload Admin Tools and save notes in Private admin notes.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger reject_private_admin_config before insert or update on public.system_config
for each row execute function public.admin_reject_private_config();

create or replace function public.admin_save_student_note(p_user_id text, p_body text, p_revision bigint)
returns public.admin_student_notes language plpgsql security definer set search_path = public as $$
declare current_note public.admin_student_notes; actor text := auth.jwt()->>'sub';
begin
  if coalesce(public.admin_role(), '') <> 'superadmin' then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_user_id is null or btrim(p_user_id) = '' or length(p_user_id) > 256
    or p_body is null or length(p_body) > 20000 or p_revision is null or p_revision < 0 then
    raise exception 'A student, note of at most 20000 characters, and revision are required' using errcode = '22023';
  end if;
  insert into public.admin_student_notes(user_id, updated_by) values (p_user_id, actor)
    on conflict (user_id) do nothing;
  select * into current_note from public.admin_student_notes where user_id = p_user_id for update;
  if current_note.revision <> p_revision then
    raise exception 'Another admin saved this note. Copy your changes, reload the saved note, and reconcile before saving.' using errcode = '40001';
  end if;
  update public.admin_student_notes set body = p_body, revision = revision + 1,
    updated_by = actor, updated_at = clock_timestamp() where user_id = p_user_id returning * into current_note;
  -- Body text deliberately stays out of the general audit stream.
  insert into public.admin_audit_logs(admin_id, action, details)
    values (actor, 'student_note_saved', jsonb_build_object('user_id', p_user_id, 'revision', current_note.revision));
  return current_note;
end;
$$;
revoke all on function public.admin_save_student_note(text, text, bigint) from public, anon;
grant execute on function public.admin_save_student_note(text, text, bigint) to authenticated;
commit;
