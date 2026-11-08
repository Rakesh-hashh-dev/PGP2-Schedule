begin;
alter table public.admin_publication_drafts drop constraint admin_publication_drafts_domain_fkey;
alter table public.admin_publication_drafts add constraint workspace_draft_domain_check check(domain in ('schedule','communications','system','mess','navigation','dashboard'));
do $$ begin
  if to_regclass('public.app_controls_drafts') is not null then
    insert into public.admin_publication_drafts(user_id,domain,payload,base_payload,base_revision,draft_revision)
    select d.updated_by,d.section,d.payload,
      coalesce((select v.payload->d.section from public.app_controls_versions v where v.revision=d.base_revision),case when c.revision=d.base_revision then c.payload->d.section end,'null'::jsonb),d.base_revision,1
    from public.app_controls_drafts d cross join public.app_controls c where c.id='global' and exists(select 1 from public.admins a where a.user_id=d.updated_by)
    on conflict do nothing;
    insert into public.admin_private_config_archive(source_id,payload)
      select 'legacy-control-draft:'||section,to_jsonb(d) from public.app_controls_drafts d;
    delete from public.app_controls_drafts;
  end if;
end $$;
create function public.admin_load_workspace_draft(p_domain text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return (select to_jsonb(d) from public.admin_publication_drafts d where user_id=auth.jwt()->>'sub' and domain=p_domain);
end $$;
create function public.admin_save_workspace_draft(p_domain text,p_payload jsonb,p_base jsonb,p_base_revision bigint,p_draft_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved public.admin_publication_drafts; actor text:=auth.jwt()->>'sub'; capability text;
begin
  capability:=case when p_domain in ('mess','navigation','dashboard') then 'system.publish' else p_domain||'.publish' end;
  if not public.admin_has_capability(capability) then raise exception 'Draft write permission required' using errcode='42501'; end if;
  if p_base_revision is null or p_base_revision<0 or p_draft_revision is null or p_draft_revision<0 then raise exception 'Valid draft revisions required' using errcode='22023'; end if;
  -- A comparison base may predate today's schema; never republish it without
  -- validating the merged proposal. Keep it bounded and free of private keys.
  if p_base is null or octet_length(p_base::text)>1000000 or public.admin_strip_private_config(p_base) is distinct from p_base then raise exception 'Invalid comparison base' using errcode='22023'; end if;
  if p_domain in ('mess','navigation','dashboard') then
    perform public.validate_app_controls(p_domain,p_payload);
  else
    perform public.admin_validate_publication(p_domain,p_payload);
  end if;
  insert into public.admin_publication_drafts(user_id,domain,payload,base_payload,base_revision,draft_revision)
    values(actor,p_domain,p_payload,p_base,p_base_revision,0) on conflict(user_id,domain) do nothing;
  select * into saved from public.admin_publication_drafts where user_id=actor and domain=p_domain for update;
  if saved.draft_revision<>p_draft_revision then raise exception 'This draft changed in another tab. Your current edits are preserved. Reload the saved draft before retrying.' using errcode='40001'; end if;
  update public.admin_publication_drafts set payload=p_payload,base_payload=p_base,base_revision=p_base_revision,
    draft_revision=draft_revision+1,updated_at=clock_timestamp() where user_id=actor and domain=p_domain returning * into saved;
  return to_jsonb(saved);
end $$;
create function public.admin_discard_workspace_draft(p_domain text,p_draft_revision bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_has_capability(case when p_domain in ('mess','navigation','dashboard') then 'system.publish' else p_domain||'.publish' end) then raise exception 'Draft write permission required' using errcode='42501'; end if;
  delete from public.admin_publication_drafts where user_id=auth.jwt()->>'sub' and domain=p_domain and draft_revision=p_draft_revision;
  if not found and exists(select 1 from public.admin_publication_drafts where user_id=auth.jwt()->>'sub' and domain=p_domain) then raise exception 'Draft changed in another tab. Reload first.' using errcode='40001'; end if;
end $$;
revoke all on function public.admin_load_workspace_draft(text),public.admin_save_workspace_draft(text,jsonb,jsonb,bigint,bigint),public.admin_discard_workspace_draft(text,bigint) from public,anon;
grant execute on function public.admin_load_workspace_draft(text),public.admin_save_workspace_draft(text,jsonb,jsonb,bigint,bigint),public.admin_discard_workspace_draft(text,bigint) to authenticated;
create or replace function public.admin_save_controls_draft(p_section text,p_payload jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path=public as $$
begin raise exception 'Reload Admin Tools to use identity-scoped, versioned private drafts.' using errcode='22023'; end $$;
commit;
