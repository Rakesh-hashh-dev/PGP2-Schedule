-- Disposable database only. All fixtures are rolled back.
begin;
create function pg_temp.expect_chat_error(statement text, fragment text) returns void language plpgsql as $$
declare failed boolean:=false;
begin
 begin execute statement; exception when others then
  failed:=true;
  if position(fragment in sqlerrm)=0 then raise exception 'Unexpected failure: %',sqlerrm; end if;
 end;
 if not failed then raise exception 'Expected failure containing: %',fragment; end if;
end $$;
insert into public.profiles(user_id,courses,groups) values
 ('chat-qa-owner','{"_name":"Owner"}','[{"id":"chat-qa-a","name":"Circle A","visibility":"shared","cloudMemberIds":["chat-qa-guest"]},{"id":"chat-qa-b","name":"Circle B","visibility":"private"}]');
insert into public.study_group_invites(group_id,owner_id) values('chat-qa-a','chat-qa-owner'),('chat-qa-b','chat-qa-owner');
insert into public.group_messages(id,group_id,from_id,text,moderation_hidden) values
 ('c0000000-0000-0000-0000-000000000001','chat-qa-a','chat-qa-owner','Visible parent',false),
 ('c0000000-0000-0000-0000-000000000002','chat-qa-b','chat-qa-owner','Other group',false),
 ('c0000000-0000-0000-0000-000000000003','chat-qa-a','chat-qa-owner','Hidden parent',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"chat-qa-guest","role":"authenticated"}',true);
insert into public.group_messages(id,group_id,from_id,text,reply_to)
 values('c0000000-0000-0000-0000-000000000004','chat-qa-a','chat-qa-guest','Reply','c0000000-0000-0000-0000-000000000001');
select pg_temp.expect_chat_error($s$insert into public.group_messages(group_id,from_id,text,reply_to) values('chat-qa-a','chat-qa-guest','Cross-group','c0000000-0000-0000-0000-000000000002')$s$,'Reply must reference');
select pg_temp.expect_chat_error($s$insert into public.group_messages(group_id,from_id,text,reply_to) values('chat-qa-a','chat-qa-guest','Hidden','c0000000-0000-0000-0000-000000000003')$s$,'Reply must reference');
select pg_temp.expect_chat_error($s$update public.group_messages set group_id='chat-qa-b' where id='c0000000-0000-0000-0000-000000000004'$s$,'Message identity');
select pg_temp.expect_chat_error($s$update public.group_messages set created_at=created_at+interval '1 hour' where id='c0000000-0000-0000-0000-000000000004'$s$,'Message identity');
select pg_temp.expect_chat_error($s$insert into public.group_messages(group_id,from_id,text) values('chat-qa-a','chat-qa-owner','Spoof')$s$,'row-level security');
update public.group_messages set text='Edited reply' where id='c0000000-0000-0000-0000-000000000004';
update public.group_messages set text='Non-author edit' where id='c0000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from public.group_messages where id='c0000000-0000-0000-0000-000000000004' and text='Edited reply') then raise exception 'Author edit failed'; end if;
 if not exists(select 1 from public.group_messages where id='c0000000-0000-0000-0000-000000000001' and text='Visible parent') then raise exception 'Non-author changed message'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"chat-qa-outsider","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.group_messages where group_id='chat-qa-a') then raise exception 'Outsider can read chat'; end if;
end $$;
select pg_temp.expect_chat_error($s$insert into public.group_messages(group_id,from_id,text,reply_to) values('chat-qa-a','chat-qa-outsider','Outsider reply','c0000000-0000-0000-0000-000000000001')$s$,'Group membership');
select set_config('request.jwt.claims','{"sub":"chat-qa-owner","role":"authenticated"}',true);
delete from public.group_messages where id='c0000000-0000-0000-0000-000000000001';
reset role;
do $$ begin
 if not exists(select 1 from public.group_messages where id='c0000000-0000-0000-0000-000000000004' and reply_to is null) then raise exception 'Deleted reply target did not clear safely'; end if;
end $$;
rollback;
