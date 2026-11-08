begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"owner"}',true);
insert into public.board_posts(id,user_id,title,body,kind) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','owner','Happy Diwali','A wish from campus','celebrate');
do $$ begin
  begin insert into public.board_posts(id,user_id,title,kind) values(gen_random_uuid(),'another','Spoofed','celebrate'); raise exception 'Ownership bypassed'; exception when insufficient_privilege then null; end;
  begin insert into public.board_posts(id,user_id,title,kind,price) values(gen_random_uuid(),'owner','A sale','celebrate',100); raise exception 'Marketplace price accepted'; exception when check_violation then null; end;
  begin insert into public.board_posts(id,user_id,title,kind,contact) values(gen_random_uuid(),'owner','Phone','celebrate','1234567890'); raise exception 'Phone accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"student-one"}',true);
select public.report_content('board_post','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','spam','Celebration report');
select set_config('request.jwt.claims','{"sub":"student-two"}',true);
select public.report_content('board_post','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','spam','Celebration report');
select set_config('request.jwt.claims','{"sub":"student-three"}',true);
select public.report_content('board_post','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','spam','Celebration report');
do $$ begin
  if exists(select 1 from public.board_posts where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') then raise exception 'Hidden celebration still visible'; end if;
  begin perform * from public.admin_content_reports; raise exception 'Reporter identities exposed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_report_queue(); raise exception 'Student saw moderation queue'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select status from public.board_posts where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')<>'removed' then raise exception 'Celebration bypassed auto-hide'; end if;
end $$;
rollback;
