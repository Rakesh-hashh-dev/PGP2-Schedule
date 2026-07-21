-- Add RLS policy for deleting group messages
-- Only the author (from_id) can delete their own messages.
create policy group_msg_delete on group_messages
  for delete using (auth.jwt()->>'sub' = from_id);

-- Add RLS policy for updating group messages (for edits)
-- Only the author can edit their own messages.
create policy group_msg_update on group_messages
  for update using (auth.jwt()->>'sub' = from_id);
