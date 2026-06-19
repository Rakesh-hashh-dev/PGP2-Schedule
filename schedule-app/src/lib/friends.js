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

function generateRandomCode(len = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getOrCreateShareCode(userId, name) {
  if (!userId) return null;
  const cached = localStorage.getItem(MY_CODE_KEY);
  if (cached) return cached;
  const code = await encodeSchedule(userId, name);
  if (code) {
    localStorage.setItem(MY_CODE_KEY, code);
  }
  return code;
}

/**
 * Generate and save a cloud-sync schedule code.
 * Example: RAK-X8M2
 */
export async function encodeSchedule(userId, name) {
  if (!userId) return null;
  
  const namePart = (name || "FRND").trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const randomStr = generateRandomCode(4);
  const codeStr = `${namePart}-${randomStr}`;
  
  try {
    const { error } = await supabase.from("share_codes").upsert(
      { code: codeStr, user_id: userId },
      { onConflict: "code" }
    );
    if (error) {
      console.error("Failed to save share code:", error);
      return null;
    }
    return codeStr;
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
    const cleanCourses = { ...profileData.courses };
    delete cleanCourses._name;
    
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

function writeFriends(list) {
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
export function findFreeSlots(myClasses, theirClasses, date, dayStart = 480, dayEnd = 1080) {
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
export function findGroupFreeSlots(allClassLists, date, dayStart = 480, dayEnd = 1080) {
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
    if (c.type === "class") {
      const sec = friendCourses[c.code];
      return sec !== undefined && c.section === sec;
    }
    return false; // don't include non-class items for friends
  });
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

  // Merge friends
  const cloudFriends = (data?.friends || []);
  const localFriends = loadFriends();
  const mergedFriends = [...cloudFriends];
  for (const lf of localFriends) {
    if (!mergedFriends.find(cf => cf.id === lf.id)) {
      mergedFriends.push(lf);
    }
  }
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(mergedFriends));

  // Merge groups
  const cloudGroups = (data?.groups || []);
  const localGroups = loadGroups();
  const mergedGroups = [...cloudGroups];
  for (const lg of localGroups) {
    if (!mergedGroups.find(cg => cg.id === lg.id)) {
      mergedGroups.push(lg);
    }
  }
  localStorage.setItem(GROUPS_KEY, JSON.stringify(mergedGroups));

  // Push back the merged result so the cloud has the local stuff too
  if (mergedFriends.length > cloudFriends.length || mergedGroups.length > cloudGroups.length) {
    await supabase.from("profiles").upsert({ 
      user_id: userId, 
      friends: mergedFriends, 
      groups: mergedGroups 
    }, { onConflict: "user_id" });
  }

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
