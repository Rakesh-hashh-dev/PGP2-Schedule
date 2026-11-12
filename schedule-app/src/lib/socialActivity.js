import { supabase } from "./supabase.js";
import { groupInvite } from "./groupInvites.js";
import { pollIsClosed, POLL_MARKER } from "./polls.js";
import { fetchMyMeetups } from "./meetups.js";

export async function fetchSocialResponses(userId, groups, { meetupsEnabled = true } = {}) {
  const [plans, activity] = await Promise.allSettled([
    meetupsEnabled ? fetchMyMeetups(userId, { strict: true }) : Promise.resolve({ meetups: [], rsvpsByMeetup: {} }),
    fetchGroupActivity(userId, groups),
  ]);
  return {
    ...(plans.status === "fulfilled" ? plans.value : { meetups: [], rsvpsByMeetup: {} }),
    ...(activity.status === "fulfilled" ? activity.value : { polls: [], votes: [], messages: [], reads: {} }),
    errors: {
      plans: plans.status === "rejected" ? "Could not load meetup invitations." : null,
      groups: activity.status === "rejected" ? "Could not load group activity." : null,
    },
  };
}

export function buildResponseItems({ meetups = [], rsvpsByMeetup = {}, polls = [], votes = [], messages = [], reads = {}, groups = [], userId, now = new Date() }) {
  const groupNames = new Map(groups.map(g => [g.id, g.name]));
  const items = [];
  for (const meetup of meetups) {
    if (meetup.created_by === userId || !meetup.member_ids?.includes(userId) || meetup.cancelled || new Date(meetup.starts_at) <= now) continue;
    if ((rsvpsByMeetup[meetup.id] || []).some(r => r.user_id === userId && ["going", "declined"].includes(r.response))) continue;
    items.push({ id: `meetup:${meetup.id}`, kind: "meetup", title: meetup.title, detail: "Meetup invitation", date: meetup.starts_at, meetup });
  }
  for (const poll of polls) {
    if (!groupNames.has(poll.group_id) || poll.scope !== "group" || pollIsClosed(poll, now) || poll.created_by === userId) continue;
    if (votes.some(v => v.poll_id === poll.id && v.user_id === userId && v.choice?.length > 0)) continue;
    items.push({ id: `poll:${poll.id}`, kind: "poll", title: poll.question, detail: groupNames.get(poll.group_id), groupId: poll.group_id, pollId: poll.id, date: poll.closes_at || poll.created_at });
  }
  const unread = new Map();
  for (const message of messages) {
    if (!groupNames.has(message.group_id) || message.from_id === userId || message.text?.startsWith(POLL_MARKER)) continue;
    if (new Date(message.created_at).getTime() <= new Date(reads[message.group_id] || 0).getTime()) continue;
    const item = unread.get(message.group_id) || { id: `chat:${message.group_id}`, kind: "chat", title: groupNames.get(message.group_id), groupId: message.group_id, count: 0, date: message.created_at };
    item.count++; unread.set(message.group_id, item);
  }
  items.push(...[...unread.values()].map(item => ({ ...item, detail: `${item.count} unread message${item.count === 1 ? "" : "s"}` })));
  return items.sort((a, b) => ({ meetup: 0, poll: 1, chat: 2 }[a.kind] - { meetup: 0, poll: 1, chat: 2 }[b.kind]) || new Date(a.date) - new Date(b.date));
}

export function loadGroupReads(userId) {
  try { return JSON.parse(localStorage.getItem(`pgp2.group-reads:${userId}`)) || {}; } catch { return {}; }
}
const pendingReadCache = new Map();
const confirmedReads = new Map();
const readSavesInFlight = new Map();
function pendingGroupReads(userId) {
  let reads;
  try { reads = JSON.parse(localStorage.getItem(`pgp2.group-reads-pending:${userId}`)) || pendingReadCache.get(userId) || {}; }
  catch { reads = pendingReadCache.get(userId) || {}; }
  pendingReadCache.set(userId, reads);
  return reads;
}
function savePendingGroupReads(userId, reads) {
  pendingReadCache.set(userId, reads);
  try { localStorage.setItem(`pgp2.group-reads-pending:${userId}`, JSON.stringify(reads)); } catch { /* retry from memory */ }
}
export async function markGroupRead(userId, groupId, seenAt) {
  if (!userId || !groupId || !seenAt || !Number.isFinite(new Date(seenAt).getTime())) return;
  const reads = loadGroupReads(userId);
  const key = JSON.stringify([userId, groupId]);
  if (new Date(reads[groupId] || 0) < new Date(seenAt)) {
    reads[groupId] = seenAt;
    try { localStorage.setItem(`pgp2.group-reads:${userId}`, JSON.stringify(reads)); } catch { /* optional cache */ }
    globalThis.dispatchEvent?.(new CustomEvent("pgp2:social-read"));
  }
  const target = new Date(reads[groupId] || 0) > new Date(seenAt) ? reads[groupId] : seenAt;
  if (new Date(confirmedReads.get(key) || 0) >= new Date(target) && !pendingGroupReads(userId)[groupId]) return true;
  const pending = pendingGroupReads(userId);
  if (new Date(pending[groupId] || 0) < new Date(target)) pending[groupId] = target;
  savePendingGroupReads(userId, pending);
  if (readSavesInFlight.has(key)) return readSavesInFlight.get(key);
  const save = async () => {
    try {
      while (pendingGroupReads(userId)[groupId]) {
        const timestamp = pendingGroupReads(userId)[groupId];
        const { error } = await supabase.rpc("social_mark_group_read", { p_group_id: groupId, p_seen_at: timestamp });
        if (error) return false;
        confirmedReads.set(key, timestamp);
        const remaining = pendingGroupReads(userId);
        if (new Date(remaining[groupId] || 0) <= new Date(timestamp)) delete remaining[groupId];
        savePendingGroupReads(userId, remaining);
      }
      return true;
    } catch { return false; }
    finally { readSavesInFlight.delete(key); }
  };
  const request = Promise.resolve().then(save);
  readSavesInFlight.set(key, request);
  return request;
}
export async function retryPendingGroupReads(userId, groupIds) {
  if (!userId) return;
  await Promise.all(Object.entries(pendingGroupReads(userId))
    .filter(([groupId]) => groupIds.includes(groupId))
    .map(([groupId, seenAt]) => markGroupRead(userId, groupId, seenAt)));
}
export async function fetchGroupActivity(userId, groups) {
  const ids = [...new Set(groups.filter(g => g.isReceived || g.visibility === "shared" || g.visibility === "global" || g.inviteMembers?.length).map(g => g.id))];
  if (!userId || !ids.length) return { polls: [], votes: [], messages: [], reads: loadGroupReads(userId) };
  // Establish canonical ownership only for groups with shared activity.
  await Promise.all(groups.filter(g => !g.isReceived && ids.includes(g.id)).map(g => groupInvite("create", { groupId: g.id })));
  await retryPendingGroupReads(userId, ids);
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const [polls, messages, reads] = await Promise.all([
    supabase.from("polls").select("*").eq("scope", "group").in("group_id", ids).eq("closed", false),
    supabase.from("group_messages").select("id,group_id,from_id,text,created_at").in("group_id", ids).eq("moderation_hidden", false).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(1000),
    supabase.from("social_group_reads").select("group_id,seen_at").eq("user_id", userId).in("group_id", ids),
  ]);
  if (polls.error || messages.error || reads.error) throw new Error("Could not load group activity.");
  const pollIds = (polls.data || []).map(p => p.id);
  const votes = pollIds.length ? await supabase.from("poll_votes").select("poll_id,user_id,choice").eq("user_id", userId).in("poll_id", pollIds) : { data: [] };
  if (votes.error) throw new Error("Could not load poll responses.");
  const cursor = loadGroupReads(userId);
  for (const row of reads.data || []) if (new Date(row.seen_at) > new Date(cursor[row.group_id] || 0)) cursor[row.group_id] = row.seen_at;
  return { polls: polls.data || [], messages: messages.data || [], votes: votes.data || [], reads: cursor };
}
export async function fetchGroupPins(group) {
  if (!group.isReceived) await groupInvite("create", { groupId: group.id });
  const groupId = group.id;
  const { data, error } = await supabase.from("social_group_pins").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
  if (error) throw new Error("Could not load pinned information.");
  return data || [];
}
export async function saveGroupPin({ groupId, userId, userName, title, body, url, messageId = null }) {
  const { error } = await supabase.from("social_group_pins").insert({ group_id: groupId, created_by: userId, created_by_name: userName || "Someone", title: title.trim().slice(0, 100), body: body.trim().slice(0, 1500), url: url || null, message_id: messageId });
  if (error) throw new Error("Could not save the pin. Please try again.");
}
export async function removeGroupPin(id) {
  const { data, error } = await supabase.from("social_group_pins").delete().eq("id", id).select("id");
  if (error || data?.length !== 1) throw new Error("Could not remove the pin.");
}
export function subscribeGroupActivity(userId, onChange, channelKey = userId) {
  const channel = supabase.channel(`social-activity:${channelKey}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `user_id=eq.${userId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "social_group_reads", filter: `user_id=eq.${userId}` }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}
