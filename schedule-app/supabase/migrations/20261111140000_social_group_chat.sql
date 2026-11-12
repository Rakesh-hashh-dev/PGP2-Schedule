begin;

alter table public.group_messages add column reply_to uuid references public.group_messages(id) on delete set null;
create index group_messages_page_idx on public.group_messages(group_id, created_at desc, id desc);
create index group_messages_reply_idx on public.group_messages(reply_to) where reply_to is not null;

create or replace function public.social_validate_message_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.group_id is distinct from old.group_id or new.from_id is distinct from old.from_id or new.created_at is distinct from old.created_at) then
    raise exception 'Message identity cannot be changed';
  end if;
  if new.reply_to is not null and (tg_op = 'INSERT' or new.reply_to is distinct from old.reply_to) then
    if not public.social_group_member(new.group_id) then raise exception 'Group membership required'; end if;
    if not exists(select 1 from public.group_messages m where m.id = new.reply_to and m.group_id = new.group_id and not m.moderation_hidden and m.id <> new.id) then
      raise exception 'Reply must reference a visible message in this group';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.social_validate_message_reply() from public,anon,authenticated;
create trigger validate_message_reply before insert or update on public.group_messages for each row execute function public.social_validate_message_reply();

drop policy if exists group_msg_update on public.group_messages;
create policy group_msg_update on public.group_messages for update to authenticated
  using (auth.jwt()->>'sub' = from_id and public.study_group_can_access(group_id))
  with check (auth.jwt()->>'sub' = from_id and public.study_group_can_access(group_id));
drop policy if exists group_msg_delete on public.group_messages;
create policy group_msg_delete on public.group_messages for delete to authenticated
  using (auth.jwt()->>'sub' = from_id and public.study_group_can_access(group_id));

commit;
