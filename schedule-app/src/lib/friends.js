/**
 * friends.js — Local friend & group management + schedule encoding
 *
 * Schedule codes: compact shareable strings like "RAKESH-7X3K"
 * Friends & groups: persisted in localStorage
 * Free-time computation: finds common gaps between schedules
 */

const FRIENDS_KEY = "pgp2.friends";
const GROUPS_KEY  = "pgp2.groups";

// ── Encode / Decode ─────────────────────────────────────────────

/**
 * Encode a user's name + enrolled courses into a compact shareable code.
 * Format: NAME-XXXX where XXXX is a 4-char hash derived from the payload.
 */
export function encodeSchedule(name, courses) {
  if (!name || !courses || !Object.keys(courses).length) return null;
  const payload = JSON.stringify({ n: name.trim(), c: courses });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  // 4-char suffix from a simple hash of the base64
  const hash = Array.from(b64).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0);
  const suffix = Math.abs(hash).toString(36).toUpperCase().slice(0, 4).padEnd(4, "0");
  const shortName = name.trim().split(/\s+/)[0].toUpperCase().slice(0, 8);
  // The full code embeds the base64 after a separator so it can be decoded
  return `${shortName}-${suffix}:${b64}`;
}

/**
 * Decode a schedule code back into { name, courses }.
 * Returns null if the code is invalid.
 */
export function decodeSchedule(code) {
  try {
    if (!code || typeof code !== "string") return null;
    const colonIdx = code.indexOf(":");
    if (colonIdx === -1) return null;
    const b64 = code.slice(colonIdx + 1);
    const json = decodeURIComponent(escape(atob(b64)));
    const { n, c } = JSON.parse(json);
    if (!n || !c || typeof c !== "object") return null;
    return { name: n, courses: c };
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL from a code.
 */
export function buildShareUrl(code) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?f=${encodeURIComponent(code)}`;
}

/**
 * Get the display portion of the code (NAME-XXXX) without the base64 payload.
 */
export function codeDisplayPart(code) {
  if (!code) return "";
  const colonIdx = code.indexOf(":");
  return colonIdx === -1 ? code : code.slice(0, colonIdx);
}

// ── Friends CRUD ────────────────────────────────────────────────

function readFriends() {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY)) || []; }
  catch { return []; }
}

function writeFriends(list) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list)); } catch {}
}

export function loadFriends() {
  return readFriends();
}

/**
 * Save a friend. Deduplicates by name (case-insensitive).
 * Returns the updated friends list.
 */
export function saveFriend(name, courses) {
  const friends = readFriends();
  const existing = friends.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
  const entry = {
    id: existing >= 0 ? friends[existing].id : crypto.randomUUID?.() || Date.now().toString(36),
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
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(list)); } catch {}
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
}
