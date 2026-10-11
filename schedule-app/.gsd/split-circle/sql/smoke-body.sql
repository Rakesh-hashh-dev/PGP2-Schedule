-- Run only within a transaction, then ROLLBACK or ROLLBACK TO SAVEPOINT. Synthetic subjects test database roles, not OAuth.
set local request.jwt.claims = '{"sub":"user_split_release_smoke_owner","role":"authenticated"}';
set local role authenticated;
do $smoke$
declare
 uid text='user_split_release_smoke_owner'; buddy text='user_split_release_smoke_member'; gid uuid; eid uuid; data jsonb; row_data jsonb; edited jsonb; invitation jsonb; rejected boolean; active boolean;
begin
 active=(public.split_features()->>'version')::integer>=1;
 insert into public.split_groups(name,created_by,created_by_name,member_ids,member_names,currency)
 values('Rollback-only release check',uid,'Release check',array[uid,buddy],jsonb_build_object(uid,'Owner',buddy,'Member'),'INR') returning id into gid;
 if not active then
  insert into public.split_expenses(group_id,description,amount,paid_by,created_by) values(gid,'Legacy write check',1,uid,uid) returning id into eid;
  insert into public.split_shares values(eid,uid,0.5),(eid,buddy,0.5);
  update public.split_expenses set amount=1.2 where id=eid;
  delete from public.split_shares where expense_id=eid;
  insert into public.split_shares values(eid,uid,0.6),(eid,buddy,0.6);
  if (select sum(amount) from public.split_shares where expense_id=eid)<>1.2 then raise exception 'Legacy share check failed'; end if;
  delete from public.split_expenses where id=eid;
 else
  rejected=false;
  begin insert into public.split_expenses(group_id,description,amount,paid_by,created_by) values(gid,'Must deny direct write',1,uid,uid);
  exception when insufficient_privilege then rejected=true; end;
  if not rejected then raise exception 'Direct expense write was not denied'; end if;
  rejected=false;
  begin perform public.join_split_group(gid,'Release check');
  exception when raise_exception then if sqlerrm like '%new secure invitation%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Legacy join was not denied'; end if;
 end if;
 data=jsonb_build_object('description','Atomic write check','amountPaise',101,'paidBy',uid,'splitType','equal','category','food','shares',jsonb_build_object(uid,51,buddy,50),'date','2026-10-10','originalCurrency','INR','originalPaise',101,'originalShares',jsonb_build_object(uid,51,buddy,50),'rate',1,'items','[]'::jsonb,'adjustment',0,'repeat','never','requestKey',gen_random_uuid()::text);
 row_data=public.save_split_expense(gid,data); eid=(row_data->>'id')::uuid;
 if (select sum(amount) from public.split_shares where expense_id=eid)<>1.01 then raise exception 'Atomic share check failed'; end if;
 edited=public.save_split_expense(gid,data);
 if edited->>'id'<>row_data->>'id' or edited->>'replayed'<>'true' then raise exception 'Retry deduplication failed'; end if;
 edited=public.save_split_expense(gid,data||'{"description":"Atomic edited"}'::jsonb,eid,(row_data->>'version')::integer);
 if (edited->>'version')::integer<>(row_data->>'version')::integer+1 then raise exception 'Versioned edit failed'; end if;
 rejected=false;
 begin perform public.save_split_expense(gid,data,eid,(row_data->>'version')::integer);
 exception when raise_exception then if sqlerrm like '%expense changed%' then rejected=true; else raise; end if; end;
 if not rejected then raise exception 'Stale edit was not denied'; end if;
 rejected=false;
 begin perform public.save_split_expense(gid,data||jsonb_build_object('requestKey',gen_random_uuid()::text,'shares',jsonb_build_object(uid,1)));
 exception when raise_exception then if sqlerrm like '%Shares must equal%' then rejected=true; else raise; end if; end;
 if not rejected or (select count(*) from public.split_expenses where group_id=gid)<>1 then raise exception 'Invalid write rollback failed'; end if;
 perform set_config('request.jwt.claims','{"sub":"user_split_release_smoke_outsider","role":"authenticated"}',true);
 if exists(select 1 from public.split_groups where id=gid) or exists(select 1 from public.split_expenses where id=eid) then raise exception 'Outsider could read ledger'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 if active then
  if (select count(*) from public.split_audit where record_id=eid)<>2 then raise exception 'Server audit check failed'; end if;
  insert into public.split_comments(group_id,expense_id,user_id,author,body) values(gid,eid,uid,'Release check','Rollback-only comment');
  insert into public.split_preferences(user_id,budget,currency) values(uid,100,'INR');
  invitation=public.create_split_invite(gid);
  perform public.revoke_split_invite((invitation->>'id')::uuid);
  perform set_config('request.jwt.claims','{"sub":"user_split_release_smoke_outsider","role":"authenticated"}',true);
  rejected=false;
  begin perform public.accept_split_invite(invitation->>'token','Release outsider');
  exception when raise_exception then if sqlerrm like '%expired, revoked%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Revoked invitation was accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 end if;
 insert into public.settlements(group_id,from_user,to_user,amount,created_by) values(gid,uid,buddy,0.5,uid);
 if (select count(*) from public.settlements where group_id=gid)<>1 then raise exception 'Settlement write failed'; end if;
 delete from public.settlements where group_id=gid;
 delete from public.split_expenses where id=eid;
 if exists(select 1 from public.split_shares where expense_id=eid) then raise exception 'Share cascade failed'; end if;
 delete from public.split_groups where id=gid;
end $smoke$;
reset role;
