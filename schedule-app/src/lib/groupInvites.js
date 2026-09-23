import { supabase } from "./supabase.js";

export async function groupInvite(action, { groupId = null, token = null, requesterId = null } = {}) {
  const { data, error } = await supabase.rpc("study_group_invite", {
    p_action: action,
    p_group_id: groupId,
    p_token: token,
    p_requester_id: requesterId,
  });
  if (error) throw error;
  return data;
}

export function groupInviteUrl(token) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("view", "friends");
  url.searchParams.set("group_invite", token);
  return url.toString();
}
