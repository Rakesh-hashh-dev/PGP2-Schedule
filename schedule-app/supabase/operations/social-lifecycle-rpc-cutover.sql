-- CONTRACT PHASE: post-frontend-release ONLY.
-- Apply manually only after the released frontend uses social_manage_meetup
-- and social_rsvp_meetup and its edit/cancel/RSVP flows have been verified.
-- This is deliberately outside migrations: database-first deployment MUST
-- retain legacy privileges until that separate frontend release is complete.
begin;
do $$
declare signature text; procedure_id regprocedure;
begin
 foreach signature in array array[
  'public.social_manage_meetup(uuid,integer,text,text,jsonb,jsonb)',
  'public.social_rsvp_meetup(uuid,integer,text,text)'
 ] loop
  procedure_id:=to_regprocedure(signature);
  if procedure_id is null then raise exception 'Cutover blocked: missing lifecycle RPC %',signature; end if;
  if not exists(select 1 from pg_proc where oid=procedure_id and prosecdef) then raise exception 'Cutover blocked: RPC must be SECURITY DEFINER: %',signature; end if;
  if not has_function_privilege('authenticated',procedure_id,'execute') then raise exception 'Cutover blocked: authenticated cannot execute %',signature; end if;
 end loop;
end $$;
revoke update on public.meetups from authenticated;
revoke insert,update on public.meetup_rsvps from authenticated;
notify pgrst,'reload schema';
commit;
