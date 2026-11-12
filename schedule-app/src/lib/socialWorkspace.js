import { compareChatTimes } from "./groupChat.js";

export const SOCIAL_VIEW_ITEMS = Object.freeze([
  { id: "overview", label: "Overview" },
  { id: "friends", label: "Friends" },
  { id: "groups", label: "Groups" },
]);

export function readSocialNavigation(userId) {
  if (!userId) return { userId, view: "overview", groupId: null };
  try {
    const value = JSON.parse(localStorage.getItem(`pgp2.social-navigation:${userId}`));
    return { userId, view: SOCIAL_VIEW_ITEMS.some(item => item.id === value?.view) ? value.view : "overview", groupId: typeof value?.groupId === "string" && value.groupId.length < 200 ? value.groupId : null };
  } catch { return { userId, view: "overview", groupId: null }; }
}

export function groupWorkspaceRequest(previous, groupId, tab = "chat") {
  return { groupId, tab, nonce: (previous?.nonce || 0) + 1 };
}

export function groupActivitySummary(groups, { messages = [], reads = {} } = {}, userId) {
  return Object.fromEntries(groups.map(group => {
    const rows = messages.filter(message => message.group_id === group.id && !message.moderation_hidden).sort((a, b) => compareChatTimes(b.created_at, a.created_at) || b.id.localeCompare(a.id));
    const latest = rows[0];
    return [group.id, { latestAt: latest?.created_at || "", preview: latest ? latest.text?.startsWith("__poll:") ? "New group poll" : latest.text : "No recent messages", unread: rows.filter(message => message.from_id !== userId && compareChatTimes(message.created_at, reads[group.id]) > 0).length }];
  }));
}

export function orderGroupsByActivity(groups, summary) {
  return [...groups].sort((a, b) => compareChatTimes(summary[b.id]?.latestAt, summary[a.id]?.latestAt) || a.name.localeCompare(b.name));
}

export function filterSocialFriends(friends, { query = "", filter = "all", getStatus = () => null } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return friends.filter(friend => {
    if (normalizedQuery && !friend.name.toLocaleLowerCase().includes(normalizedQuery)) return false;
    if (filter === "favourites") return Boolean(friend.isFavourite);

    const state = getStatus(friend)?.state;
    if (filter === "free") return state === "free" || (state === "available" && getStatus(friend)?.scheduleKnown);
    if (filter === "available") return state === "available";
    if (filter === "busy") return state === "busy";
    return true;
  });
}
