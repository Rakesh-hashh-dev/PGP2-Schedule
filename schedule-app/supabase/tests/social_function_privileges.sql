-- Read-only metadata assertions after B/C/D. No user rows or RPC mutations.
-- The harness grants functions to anon/authenticated by DEFAULT, as hosted
-- Supabase does, so revoking only PUBLIC cannot accidentally pass this check.
begin read only;
do $$
declare signature text; procedure_id regprocedure;
begin
 foreach signature in array array[
  'public.invalidate_meetup_time_round()',
  'public.social_validate_message_reply()',
  'public.social_meetup_version()'
 ] loop
  procedure_id:=to_regprocedure(signature);
  if procedure_id is null then raise exception 'Internal trigger function missing: %',signature; end if;
  if has_function_privilege('anon',procedure_id,'EXECUTE') or has_function_privilege('authenticated',procedure_id,'EXECUTE') then
   raise exception 'Internal trigger function directly executable by client role: %',signature;
  end if;
 end loop;
 foreach signature in array array[
  'public.propose_meetup_times(uuid,timestamptz[],text)',
  'public.vote_meetup_time(uuid,uuid)',
  'public.apply_meetup_time(uuid,uuid,boolean)',
  'public.social_set_discovery_opt_out(boolean)',
  'public.social_manage_meetup(uuid,integer,text,text,jsonb,jsonb)',
  'public.social_rsvp_meetup(uuid,integer,text,text)'
 ] loop
  procedure_id:=to_regprocedure(signature);
  if procedure_id is null then raise exception 'Social RPC missing: %',signature; end if;
  if has_function_privilege('anon',procedure_id,'EXECUTE') or not has_function_privilege('authenticated',procedure_id,'EXECUTE') then
   raise exception 'Social RPC execute privileges incorrect: %',signature;
  end if;
 end loop;
end $$;
commit;
