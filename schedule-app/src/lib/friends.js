/**
 * friends.js — Local friend & group management + schedule encoding
 *
 * Schedule codes: compact shareable strings like "RAKESH-7X3K"
 * Friends & groups: persisted in localStorage
 * Free-time computation: finds common gaps between schedules
 */

const FRIENDS_KEY = "pgp2.friends";
const GROUPS_KEY = "pgp2.groups";
const MY_CODE_KEY = "pgp2.my_share_code";

// ── Encode / Decode ─────────────────────────────────────────────

import { LEGEND } from "../data/schedule.js";
import { supabase } from "./supabase.js";

// Deterministic name → gradient pair, shared by FriendsPanel and CompareView
const AVATAR_PALETTE = [
  ["#7C3AED", "#A855F7"],
  ["#2563EB", "#60A5FA"],
  ["#0D9488", "#2DD4BF"],
  ["#DC2626", "#FB7185"],
  ["#D97706", "#FBBF24"],
  ["#4338CA", "#818CF8"],
];
export function avatarGradient(name) {
  const idx = [...(name || "?")].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function generateRandomCode(len = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function fetchExistingCode(userId) {
  const { data } = await supabase
    .from("share_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.code || null;
}

export async function getOrCreateShareCode(userId, name) {
  if (!userId) return null;

  // Supabase is the single source of truth — always fetch first so all devices agree
  try {
    const existing = await fetchExistingCode(userId);
    if (existing) {
      localStorage.setItem(MY_CODE_KEY, existing);
      return existing;
    }
  } catch {
    // Offline fallback: use whatever this device last saw
    const cached = localStorage.getItem(MY_CODE_KEY);
    if (cached) return cached;
  }

  // No code in Supabase yet — generate one
  const code = await encodeSchedule(userId, name);
  if (code) localStorage.setItem(MY_CODE_KEY, code);
  return code;
}

/**
 * Generate and save a cloud-sync schedule code.
 * Example: RAK-X8M2
 */
export async function encodeSchedule(userId, name) {
  if (!userId) return null;

  // Guard: if a code already exists for this user, return it unchanged
  try {
    const existing = await fetchExistingCode(userId);
    if (existing) return existing;
  } catch {}

  const namePart = (name || "FRND").trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const randomStr = generateRandomCode(4);
  const codeStr = `${namePart}-${randomStr}`;

  try {
    // onConflict: "user_id" — if this user already has a row, do nothing (ignoreDuplicates)
    const { error } = await supabase.from("share_codes").upsert(
      { code: codeStr, user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("Failed to save share code:", error);
      return null;
    }
    // Read back in case ignoreDuplicates kicked in and kept an older code
    const saved = await fetchExistingCode(userId);
    return saved || codeStr;
  } catch (e) {
    console.error("Supabase error:", e);
    return null;
  }
}

/**
 * Decode a schedule code back into { id, name, courses }.
 * Returns null if the code is invalid or lookup fails.
 */
export async function decodeSchedule(code) {
  try {
    if (!code || typeof code !== "string") return null;
    
    // 1. Legacy base64 support
    if (code.includes(":") && !code.includes("-")) {
      const colonIdx = code.indexOf(":");
      const b64 = code.slice(colonIdx + 1);
      const json = decodeURIComponent(escape(atob(b64)));
      const { n, c } = JSON.parse(json);
      if (!n || !c || typeof c !== "object") return null;
      return { id: null, name: n, courses: c };
    }

    const parts = code.split("-");
    if (parts.length < 2) return null;
    const namePart = parts[0];
    
    // 2. Ultra-Compact Local format (e.g. RAK-7T3X9K2) or Readable format
    // A cloud code will have a short random part (e.g. 4 chars). Local codes are longer (7+ chars) or have multiple dashes.
    if (parts.length > 2 || parts[1].length > 5) {
      const courses = {};
      
      if (parts.length > 2) { // RAK-CSA-BBMS
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (p.includes(".")) {
            const [c, s] = p.split(".");
            courses[c] = s;
          } else {
            courses[p] = "Single";
          }
        }
        return { id: null, name: namePart, courses };
      }

      // Base36 bitmask
      const codeStr = parts[1];
      let n = parseInt(codeStr, 36);
      if (isNaN(n)) return null;

      const COURSE_KEYS = Object.keys(LEGEND).sort();
      for (let i = COURSE_KEYS.length - 1; i >= 0; i--) {
        const val = n % 4;
        n = Math.floor(n / 4);
        const code = COURSE_KEYS[i];
        if (val === 1) courses[code] = "A";
        else if (val === 2) courses[code] = "B";
        else if (val === 3) courses[code] = "Single";
      }
      return { id: null, name: namePart, courses };
    }

    // 3. Cloud Code Lookup (e.g. RAK-X8M2)
    const { data: codeData, error: codeErr } = await supabase
      .from("share_codes")
      .select("user_id")
      .eq("code", code.toUpperCase())
      .single();
      
    if (codeErr || !codeData) return null;
    
    const userId = codeData.user_id;
    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("courses")
      .eq("user_id", userId)
      .single();
      
    if (profileErr || !profileData) return null;
    
    const fullName = profileData.courses?._name || namePart;
    const cleanCourses = Object.fromEntries(Object.entries(profileData.courses).filter(([k]) => !k.startsWith('_')));

    return { id: userId, name: fullName, courses: cleanCourses };
  } catch (e) {
    console.error("Decode error:", e);
    return null;
  }
}

export function codeDisplayPart(code) {
  if (!code) return "";
  return code; // Just show the whole readable code!
}

/**
 * Build a shareable URL from a code.
 */
export function buildShareUrl(code) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?f=${encodeURIComponent(code)}`;
}

// ── Friends CRUD ────────────────────────────────────────────────

function readFriends() {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY)) || []; }
  catch { return []; }
}

export function writeFriends(list) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list)); } catch { }
}

export function loadFriends() {
  return readFriends();
}

/**
 * Save a friend. Deduplicates by cloudId if available, otherwise by name.
 * Returns the updated friends list.
 */
export function saveFriend(name, courses, cloudId = null) {
  const friends = readFriends();
  const existing = friends.findIndex(f => 
    (cloudId && f.cloudId === cloudId) || (!cloudId && f.name.toLowerCase() === name.toLowerCase())
  );
  
  const entry = {
    id: existing >= 0 ? friends[existing].id : crypto.randomUUID?.() || Date.now().toString(36),
    cloudId: cloudId || (existing >= 0 ? friends[existing].cloudId : null),
    name,
    courses,
    addedAt: existing >= 0 ? friends[existing].addedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existing >= 0) friends[existing] = entry;
  else friends.push(entry);
  writeFriends(friends);
  return friends;
}

export function removeFriend(id) {
  const friends = readFriends().filter(f => f.id !== id);
  writeFriends(friends);
  return friends;
}

export function updateFriend(id, updates) {
  const friends = readFriends();
  const idx = friends.findIndex(f => f.id === id);
  if (idx >= 0) friends[idx] = { ...friends[idx], ...updates };
  writeFriends(friends);
  return friends;
}

export function removeFriendByCloudId(cloudId) {
  if (!cloudId) return readFriends();
  const friends = readFriends().filter(f => f.cloudId !== cloudId);
  writeFriends(friends);
  return friends;
}

// ── Groups CRUD ─────────────────────────────────────────────────

function readGroups() {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY)) || []; }
  catch { return []; }
}

function writeGroups(list) {
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(list)); } catch { }
}

export function loadGroups() {
  return readGroups();
}

/**
 * Create a new group with an optional list of friend IDs.
 */
export function createGroup(name, friendIds = []) {
  const groups = readGroups();
  const group = {
    id: crypto.randomUUID?.() || Date.now().toString(36),
    name,
    memberIds: friendIds,
    visibility: "private",
    createdAt: new Date().toISOString(),
  };
  groups.push(group);
  writeGroups(groups);
  return groups;
}

export function updateGroup(id, updates) {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === id);
  if (idx >= 0) groups[idx] = { ...groups[idx], ...updates };
  writeGroups(groups);
  return groups;
}

export function removeGroup(id) {
  const groups = readGroups().filter(g => g.id !== id);
  writeGroups(groups);
  return groups;
}

// ── Free-time Computation ───────────────────────────────────────

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Build busy intervals for a given date from a class list.
 * Returns sorted array of { start, end } in minutes.
 */
function busyIntervals(classes, date) {
  return classes
    .filter(c => c.date === date && (c.type === "class" || c.type === "exam"))
    .map(c => ({ start: toMin(c.start), end: toMin(c.end) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Merge overlapping intervals.
 */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

/**
 * Find free time slots between two sets of classes on a given date.
 * Returns array of { start: "HH:MM", end: "HH:MM", durationMin }
 *
 * @param {Array} myClasses - Your filtered visible classes
 * @param {Array} theirClasses - Friend's filtered classes
 * @param {string} date - ISO date string "YYYY-MM-DD"
 * @param {number} dayStart - Start of day in minutes (default 8:00 = 480)
 * @param {number} dayEnd - End of day in minutes (default 18:00 = 1080)
 */
export function findFreeSlots(myClasses, theirClasses, date, dayStart = 480, dayEnd = 1320) {
  const myBusy = busyIntervals(myClasses, date);
  const theirBusy = busyIntervals(theirClasses, date);
  const allBusy = mergeIntervals([...myBusy, ...theirBusy]);

  const free = [];
  let cursor = dayStart;

  for (const interval of allBusy) {
    if (interval.start > cursor) {
      free.push({
        start: minToTime(cursor),
        end: minToTime(interval.start),
        durationMin: interval.start - cursor,
      });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < dayEnd) {
    free.push({
      start: minToTime(cursor),
      end: minToTime(dayEnd),
      durationMin: dayEnd - cursor,
    });
  }

  return free;
}

/**
 * Find free time for a group of people.
 * @param {Array<Array>} allClassLists - Array of class arrays, one per person
 * @param {string} date
 */
export function findGroupFreeSlots(allClassLists, date, dayStart = 480, dayEnd = 1320) {
  const allBusy = [];
  for (const classes of allClassLists) {
    allBusy.push(...busyIntervals(classes, date));
  }
  const merged = mergeIntervals(allBusy);

  const free = [];
  let cursor = dayStart;

  for (const interval of merged) {
    if (interval.start > cursor) {
      free.push({
        start: minToTime(cursor),
        end: minToTime(interval.start),
        durationMin: interval.start - cursor,
      });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < dayEnd) {
    free.push({
      start: minToTime(cursor),
      end: minToTime(dayEnd),
      durationMin: dayEnd - cursor,
    });
  }

  return free;
}

/**
 * Compute schedule insights between two enrolled course maps.
 * Returns { matching, sameClass, uniqueToMe, uniqueToThem }
 */
export function scheduleInsights(myCourses, theirCourses) {
  const myCodes = new Set(Object.keys(myCourses || {}));
  const theirCodes = new Set(Object.keys(theirCourses || {}));

  const matching = [];   // same course, possibly different section
  const sameClass = [];  // same course AND same section
  const uniqueToMe = [];
  const uniqueToThem = [];

  for (const code of myCodes) {
    if (theirCodes.has(code)) {
      matching.push(code);
      if (myCourses[code] === theirCourses[code]) {
        sameClass.push({ code, section: myCourses[code] });
      }
    } else {
      uniqueToMe.push(code);
    }
  }

  for (const code of theirCodes) {
    if (!myCodes.has(code)) {
      uniqueToThem.push(code);
    }
  }

  return { matching, sameClass, uniqueToMe, uniqueToThem };
}

/**
 * Get a friend's visible classes from the master class list using their enrolled courses.
 */
export function friendVisibleClasses(allClasses, friendCourses) {
  if (!friendCourses) return [];
  return allClasses.filter(c => {
    if (c.type === "class" || c.type === "exam") {
      if (!c.code) return c.type === "exam"; // general exams or events with no code
      const sec = friendCourses[c.code];
      return sec !== undefined && (c.section === "Single" || c.section === sec);
    }
    if (c.type === "holiday" || c.type === "break") {
      return true;
    }
    return false;
  });
}

// --- CLOUD SYNC FOR FRIENDS AND GROUPS ---

/**
 * Pulls friends and groups from the cloud (profiles table) and merges them with local state.
 * Returns the merged arrays or null if failed.
 */
export async function syncFriendsAndGroupsFromCloud(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("friends, groups")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching friends/groups:", error);
    return null;
  }

  // Cloud is the source of truth — don't re-add local entries the cloud no longer has
  // (a re-add from local would undo a bidirectional removal)
  const cloudFriends = (data?.friends || []);
  const mergedFriends = [...cloudFriends];
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(mergedFriends));

  // Cloud is the source of truth for groups too
  const cloudGroups = (data?.groups || []);
  const mergedGroups = [...cloudGroups];
  localStorage.setItem(GROUPS_KEY, JSON.stringify(mergedGroups));

  return { friends: mergedFriends, groups: mergedGroups };
}

export async function pushFriendsToCloud(userId, friends) {
  if (!userId) return;
  await supabase.from("profiles").upsert({ user_id: userId, friends }, { onConflict: "user_id" });
}

export async function pushGroupsToCloud(userId, groups) {
  if (!userId) return;
  await supabase.from("profiles").upsert({ user_id: userId, groups }, { onConflict: "user_id" });
}

// Remove yourself from a friend's cloud friends list so their UI updates in real-time
export async function removeSelfFromFriendCloud(friendUserId, myUserId) {
  if (!friendUserId || !myUserId) return;
  const { data } = await supabase.from("profiles").select("friends").eq("user_id", friendUserId).single();
  if (!data?.friends) return;
  const updated = data.friends.filter(f => f.cloudId !== myUserId);
  if (updated.length === data.friends.length) return;
  await supabase.from("profiles").upsert({ user_id: friendUserId, friends: updated }, { onConflict: "user_id" });
}

// Delete all pings between two users so refreshPings can't re-add a removed friend
export async function deletePingsBetween(myUserId, friendUserId) {
  if (!myUserId || !friendUserId) return;
  await Promise.all([
    supabase.from("friend_pings").delete().eq("target_id", myUserId).eq("from_id", friendUserId),
    supabase.from("friend_pings").delete().eq("target_id", friendUserId).eq("from_id", myUserId),
  ]);
}

// ── Friend Pings (who added you) ────────────────────────────────

// fromMeta: optional { group: "GroupName" } — encoded into from_name as JSON for group invites
export async function hasPendingFriendRequest(fromUserId, toUserId) {
  if (!fromUserId || !toUserId) return false;
  const { data } = await supabase
    .from("friend_pings")
    .select("id")
    .eq("from_id", fromUserId)
    .eq("target_id", toUserId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function sendFriendPing(targetUserId, fromUserId, fromName, fromMeta = null) {
  if (!targetUserId || !fromUserId || targetUserId === fromUserId) return;
  try {
    // Legacy plane — still written so clients on the old (friend_pings) read path
    // keep receiving during the Phase 3 transition. New clients read notifications.
    const { error } = await supabase.from("friend_pings").insert({
      target_id: targetUserId,
      from_id: fromUserId,
      from_name: fromMeta ? JSON.stringify({ name: fromName || "Someone", ...fromMeta }) : (fromName || "Someone"),
    });
    if (error) console.error("[sendFriendPing] error:", error.message, error.details, error.hint);
  } catch (e) {
    console.error("[sendFriendPing] catch:", e);
  }
  // Dual-write to the unified notifications store (Phase 3). Doing it here means
  // every sendFriendPing call site (friend request / accept / removal / group
  // invite) is covered without changing each one.
  const type = fromMeta?.group
    ? "group_invite"
    : (fromMeta?.type === "friend_accepted" || fromMeta?.type === "friend_removed")
      ? fromMeta.type
      : "friend_request";
  await sendSocialNotification(targetUserId, type, {
    fromId: fromUserId, fromName, fromCode: fromMeta?.fromCode, group: fromMeta?.group,
  });
}

export async function fetchFriendPings(userId) {
  if (!userId) return [];
  try {
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    // Lazy cleanup: fire-and-forget delete of pings older than 45 days
    supabase.from("friend_pings").delete().eq("target_id", userId).lt("created_at", cutoff).then(() => {});
    const { data } = await supabase
      .from("friend_pings")
      .select("*")
      .eq("target_id", userId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    // Deduplicate: keep only the newest ping per sender (handles duplicate requests)
    const seen = new Set();
    return (data || []).filter(p => {
      if (seen.has(p.from_id)) return false;
      seen.add(p.from_id);
      return true;
    });
  } catch { return []; }
}

export async function clearFriendPings(_userId) {}

export async function deleteFriendPing(pingId) {
  if (!pingId) return;
  await supabase.from("friend_pings").delete().eq("id", pingId);
}

export async function deleteAllFriendPings(userId) {
  if (!userId) return;
  await supabase.from("friend_pings").delete().eq("target_id", userId);
}

// ── Social notifications (Phase 3: notifications store) ──────────
//
// The unified `notifications` table replaces the friend_pings social plane.
// The sender inserts a row targeting the recipient; the scoped RLS policy
// (notif_social_insert) pins data.from_id to the caller so it can't be spoofed.
// This gains push coverage + a cross-device inbox + read state for free.
// See docs/notification-architecture.md §Phase 3.

const SOCIAL_COPY = {
  friend_request:  (name) => ({ title: "New friend request", body: `${name} wants to compare schedules` }),
  friend_accepted: (name) => ({ title: "Friend request accepted", body: `${name} accepted your request` }),
  group_invite:    (name, group) => ({ title: "Added to a group", body: `${name} added you to "${group}"` }),
  friend_removed:  (name) => ({ title: "Friend removed", body: `${name} removed you` }),
  group_poll:      (name, group) => ({ title: "📊 New poll", body: `${name} started a poll in "${group}"` }),
  board_contact:   (name, title) => ({ title: "📦 Campus Board", body: `${name} is interested in "${title}"` }),
};

/**
 * Insert a social notification for another user.
 * @param type one of friend_request | friend_accepted | group_invite | friend_removed
 * @param meta { fromId, fromCode, fromName, group?, silent? }
 * friend_removed is inserted silent:true — the realtime handler processes the
 * removal but the bell filters it out.
 */
export async function sendSocialNotification(targetUserId, type, meta = {}) {
  if (!targetUserId || !type || !meta.fromId || targetUserId === meta.fromId) return;
  const name = meta.fromName || "Someone";
  const copy = SOCIAL_COPY[type]?.(name, meta.group) || { title: name, body: "" };
  const dedupKey =
    type === "group_invite"
      ? `social:group_invite:${meta.group || ""}:${meta.fromId}`
      : type === "group_poll"
        ? `social:group_poll:${meta.pollId || ""}:${meta.fromId}`
        : type === "board_contact"
          ? `social:board_contact:${meta.postId || ""}:${meta.fromId}`
          : `social:${type}:${meta.fromId}`;
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: targetUserId,
      type,
      title: copy.title,
      body: copy.body,
      url: type === "board_contact" ? "/?view=board" : "/?view=friends",
      icon: "/icon-push-bell.png",
      data: {
        from_id: meta.fromId,          // pinned to caller by RLS — do not change key
        from_code: meta.fromCode || null,
        from_name: name,
        group: meta.group || null,
        silent: type === "friend_removed" || !!meta.silent,
        urgency: "normal",
        ttl: 3 * 24 * 3600,
      },
      dedup_key: dedupKey,
    });
    if (error) console.error("[sendSocialNotification] error:", error.message, error.details, error.hint);
  } catch (e) {
    console.error("[sendSocialNotification] catch:", e);
  }
}

// ── Group Chat (Persistent) ─────────────────────────────────────

// Phase 3: chat lives in its own `group_messages` table (out of the notification
// path). from_id is pinned to the caller by the group_msg_insert RLS policy.
export async function sendGroupChatMessage(groupId, fromUserId, fromName, text) {
  if (!groupId || !fromUserId || !text) return;
  try {
    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId,
      from_id: fromUserId,
      from_name: fromName || "Someone",
      text,
    });
    if (error) console.error("[sendGroupChatMessage] error:", error.message);
  } catch (e) {
    console.error("[sendGroupChatMessage] catch:", e);
  }
}

export async function fetchGroupChatMessages(groupId) {
  if (!groupId) return [];
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("group_messages").delete().eq("group_id", groupId).lt("created_at", cutoff).then(() => {});
    const { data } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true });
    return (data || []).map((m) => ({
      id: m.id, from_id: m.from_id, name: m.from_name || "Someone",
      text: m.text || "", created_at: m.created_at,
    }));
  } catch { return []; }
}

// ── Group Chat (legacy friend_pings — kept until Phase 3 read-path swap) ─────

export async function sendGroupMessage(groupId, fromUserId, fromName, text) {
  if (!groupId || !fromUserId || !text) return;
  try {
    const meta = { type: 'group_chat', text };
    await supabase.from("friend_pings").insert({
      target_id: groupId,
      from_id: fromUserId,
      from_name: JSON.stringify({ name: fromName || "Someone", ...meta })
    });
  } catch (e) {
    console.error("[sendGroupMessage] error:", e);
  }
}

export async function fetchGroupMessages(groupId) {
  if (!groupId) return [];
  try {
    // 30-day retention cleanup
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from("friend_pings").delete().eq("target_id", groupId).lt("created_at", cutoff).then(() => {});
    
    const { data } = await supabase
      .from("friend_pings")
      .select("*")
      .eq("target_id", groupId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true });
      
    return (data || []).map(p => {
      let meta;
      try { meta = JSON.parse(p.from_name); } catch { meta = { name: p.from_name }; }
      return {
        id: p.id,
        from_id: p.from_id,
        name: meta.name || p.from_name,
        text: meta.text || "",
        created_at: p.created_at
      };
    });
  } catch { return []; }
}

/**
 * Push this group (as a read-only "received" copy) to every cloud-linked friend in the group.
 * Returns { cloudMemberIds } — the full list including the owner's own userId.
 */
/**
 * @param targetFriends — the pre-filtered list of friends to push to.
 *   Pass only group members for "shared", pass all friends for "global".
 */
export async function shareGroupWithMembers(userId, userName, group, targetFriends) {
  const cloudFriendsInGroup = (targetFriends || []).filter(f => f.cloudId);
  if (!cloudFriendsInGroup.length) return { cloudMemberIds: [userId] };

  const memberCloudIds = cloudFriendsInGroup.map(f => f.cloudId);
  const allCloudIds = [userId, ...memberCloudIds];

  const receivedGroup = {
    id: group.id,
    name: group.name,
    memberIds: [],
    cloudMemberIds: allCloudIds,
    visibility: "shared",
    isReceived: true,
    ownerId: userId,
    ownerName: userName,
    createdAt: group.createdAt || new Date().toISOString(),
  };

  for (const memberId of memberCloudIds) {
    try {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("groups")
        .eq("user_id", memberId)
        .maybeSingle();
      if (fetchErr) console.error("[shareGroup] fetch error for", memberId, ":", fetchErr.message, fetchErr.hint);

      const existing = (data?.groups || []).filter(g => !(g.id === group.id && g.isReceived));
      existing.push(receivedGroup);

      const { error: upsertErr } = await supabase.rpc("push_group_to_member", {
        target_user_id: memberId,
        new_groups: existing,
      });
      if (upsertErr) console.error("[shareGroup] rpc error for", memberId, ":", upsertErr.message, upsertErr.hint, upsertErr.details);
      else console.log("[shareGroup] pushed group to", memberId, "ok");
    } catch (e) {
      console.error("[shareGroup] catch for", memberId, ":", e);
    }

    // Ping the member so they get a bell notification even if realtime missed it
    await sendFriendPing(memberId, userId, userName, { group: group.name });
  }

  return { cloudMemberIds: allCloudIds };
}

/**
 * Remove the shared group copy from all cloud members' profiles.
 * Skips ownerId so the owner's own copy is untouched.
 */
export async function unshareGroupFromMembers(groupId, cloudMemberIds, ownerId) {
  for (const memberId of (cloudMemberIds || [])) {
    if (memberId === ownerId) continue;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("groups")
        .eq("user_id", memberId)
        .maybeSingle();

      const updated = (data?.groups || []).filter(g => g.id !== groupId);
      await supabase.rpc("push_group_to_member", {
        target_user_id: memberId,
        new_groups: updated,
      });
    } catch { /* silent */ }
  }
}

/**
 * Re-fetch the latest courses for cloud-linked friends (those with a cloudId).
 * Pass onlyCloudIds to limit the fetch to specific friends; the full friends
 * array is still merged and persisted so nobody gets dropped.
 * Returns the updated friends array if anything changed, or null if nothing changed.
 */
export async function refreshFriendCoursesFromCloud(friends, onlyCloudIds = null) {
  const cloudFriends = friends.filter(f => f.cloudId && (!onlyCloudIds || onlyCloudIds.includes(f.cloudId)));
  if (!cloudFriends.length) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, courses")
    .in("user_id", cloudFriends.map(f => f.cloudId));

  if (error || !data) return null;

  const profileMap = {};
  data.forEach(p => { profileMap[p.user_id] = p.courses; });

  let changed = false;
  const updated = friends.map(f => {
    if (!f.cloudId || !profileMap[f.cloudId]) return f;
    const rawProfile = profileMap[f.cloudId];
    const freshName = rawProfile._name || f.name;
    const raw = Object.fromEntries(Object.entries(rawProfile).filter(([k]) => !k.startsWith('_')));

    const coursesChanged =
      JSON.stringify(raw) !== JSON.stringify(f.courses) || freshName !== f.name;
    if (!coursesChanged) return f;

    changed = true;
    return { ...f, name: freshName, courses: raw, updatedAt: new Date().toISOString() };
  });

  if (!changed) return null;
  writeFriends(updated);
  return updated;
}
