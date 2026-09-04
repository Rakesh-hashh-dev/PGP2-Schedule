import { supabase } from "./supabase.js";
import { TERM as LIVE_TERM } from "../data/schedule.js";
import { ARCHIVED_TERMS } from "../data/archive/index.js";

// The term that was live immediately before the current one — the one whose
// enrollment needs a one-time snapshot into _archivedCourses before it gets
// overwritten by fresh onboarding for the new live term.
const PRIOR_TERM = ARCHIVED_TERMS[ARCHIVED_TERMS.length - 1];

const SETUP_KEY = "pgp2.setup";
function readLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function writeLocal(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) {} }

function readJsonKey(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

// Union of two id arrays, capped to the most recent entries so jsonb doesn't grow unbounded
function unionIds(a, b, cap = 1000) {
  const merged = [...new Set([...(a || []), ...(b || [])])];
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

// Denormalize the signed-in user's email onto their existing profile row —
// insurance so the dev→prod bridge can be rebuilt from the data itself.
// UPDATE (not upsert): a no-op if no row exists yet, so it never creates a
// bare/empty profile row (which would risk the prod migration no-clobber race).
export async function stampProfileEmail(userId, email) {
  if (!userId || !email) return;
  try {
    await supabase.from("profiles").update({ email: email.toLowerCase().trim() }).eq("user_id", userId);
  } catch { /* best-effort; retries next load */ }
}

export async function syncProfileFromCloud(userId) {
  const local = readLocal();
  if (!userId) return local;
  const { data, error } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
  if (error) return local;
  if (data && data.courses && Object.keys(data.courses).length) {
    const raw = data.courses;
    const remoteSeen = raw._lastSeenNotif;
    const readPingIds = raw._readPingIds || [];
    const seenGroupIds = raw._seenGroupIds || [];
    const readChangeKeys = raw._readChangeKeys || [];
    const cleanCourses = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    const assignments = raw._assignments || {};
    const droppedCodes = raw._droppedCodes || [];
    const manualSections = raw._manualSections || [];
    const archivedCourses = raw._archivedCourses || {};
    const enrolledTerm = raw._enrolledTerm;
    try { localStorage.setItem("pgp2.assignments", JSON.stringify(assignments)); } catch {}
    const s = { courses: cleanCourses, lastSeenNotif: remoteSeen, readPingIds, seenGroupIds, readChangeKeys, assignments, droppedCodes, manualSections, archivedCourses, enrolledTerm, imageUrl: raw._imageUrl };
    writeLocal({ courses: cleanCourses });
    return s;
  }
  if (local) {
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: local.courses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return local;
  }
  return null;
}

export async function pushProfile(userId, courses, userName, optionalLastSeenNotif, imageUrl, droppedCodes, manualSections) {
  const s = { courses };
  writeLocal(s);
  if (!userId) return s;

  const dbCourses = { ...courses };
  if (userName) dbCourses._name = userName;
  if (imageUrl) dbCourses._imageUrl = imageUrl;
  // Tags which term these course picks belong to, so a later load can tell
  // whether they're still valid for the live term (see App.jsx's
  // enrollmentStale check) instead of silently reusing a past term's picks.
  dbCourses._enrolledTerm = LIVE_TERM.number;

  let lastSeenNotif = optionalLastSeenNotif;
  if (lastSeenNotif === undefined) {
    try { lastSeenNotif = parseInt(localStorage.getItem("pgp2-notif-seen") || "0", 10); } catch { }
  }

  const localPingIds = readJsonKey("pgp2.read-ping-ids", []);
  const localGroupIds = readJsonKey("pgp2.seen-recv-groups", []);
  const localChangeKeys = readJsonKey("pgp2.read-change-keys", []);
  const localAsgn = readJsonKey("pgp2.assignments", {});

  try {
    // Merge with the cloud row so a device with empty/partial local state
    // never wipes read state accumulated on other devices
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const remote = data?.courses || {};

    // One-time enrollment archive: if the live term has rolled over since this
    // profile last synced (LIVE_TERM.number no longer matches the most recently
    // archived term) and we haven't snapshotted that prior term's courses yet,
    // do it now — before `remote`'s (still prior-term) course map gets
    // overwritten below by the caller's new (live-term) `courses` argument.
    const archivedCourses = { ...(remote._archivedCourses || {}) };
    if (PRIOR_TERM && LIVE_TERM.number !== PRIOR_TERM.number && !archivedCourses[PRIOR_TERM.number]) {
      const priorClean = Object.fromEntries(Object.entries(remote).filter(([k]) => !k.startsWith("_")));
      if (Object.keys(priorClean).length) archivedCourses[PRIOR_TERM.number] = priorClean;
    }
    if (Object.keys(archivedCourses).length) dbCourses._archivedCourses = archivedCourses;

    const seen = Math.max(lastSeenNotif || 0, remote._lastSeenNotif || 0);
    if (seen) dbCourses._lastSeenNotif = seen;

    const pingIds = unionIds(remote._readPingIds, localPingIds);
    if (pingIds.length) dbCourses._readPingIds = pingIds;
    const groupIds = unionIds(remote._seenGroupIds, localGroupIds);
    if (groupIds.length) dbCourses._seenGroupIds = groupIds;
    const changeKeys = unionIds(remote._readChangeKeys, localChangeKeys);
    if (changeKeys.length) dbCourses._readChangeKeys = changeKeys;

    const asgn = Object.keys(localAsgn).length ? localAsgn : (remote._assignments || {});
    if (Object.keys(asgn).length) dbCourses._assignments = asgn;

    // Last-write-wins (like courses itself): reflects the current drop state,
    // not an ever-growing log — a code removed from droppedCodes (re-added by
    // the student) must actually disappear cloud-side too.
    if (droppedCodes !== undefined) {
      if (droppedCodes.length) dbCourses._droppedCodes = droppedCodes;
    } else if (remote._droppedCodes) {
      dbCourses._droppedCodes = remote._droppedCodes;
    }

    // Courses whose section the student deliberately set to something other
    // than the admin roster's allocation. The roster sync leaves these alone;
    // every other course follows the sheet. Last-write-wins for the same
    // reason as droppedCodes — a student re-aligning with the sheet must be
    // able to clear their override.
    // Assigned even when empty: the generic meta carry-over below would
    // otherwise restore the stale cloud value and make a cleared override
    // un-clearable.
    if (manualSections !== undefined) {
      dbCourses._manualSections = manualSections;
    } else if (remote._manualSections) {
      dbCourses._manualSections = remote._manualSections;
    }

    // Carry over cloud meta keys this write path doesn't own (_status,
    // _hide_from_matchmaker, _dismissedChangeKeys, _mutedCourses, …) so a
    // profile push from this device doesn't wipe them
    for (const [k, v] of Object.entries(remote)) {
      if (k.startsWith("_") && !(k in dbCourses)) dbCourses[k] = v;
    }

    await supabase.from("profiles").upsert(
      { user_id: userId, courses: dbCourses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) { /* cached; re-syncs next load */ }
  return s;
}

// ── Notification dismiss/mute prefs (last-write-wins, not unioned — these
// are toggleable, so unmuting/undoing on one device must be able to clear
// state set on another) ─────────────────────────────────────────────────

export async function getNotifPrefs(userId) {
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
  const raw = data?.courses || {};
  return {
    dismissedKeys: raw._dismissedChangeKeys || [],
    mutedCourses: raw._mutedCourses || [],
  };
}

export async function setNotifPrefs(userId, { dismissedKeys, mutedCourses }) {
  if (!userId) return;
  try {
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const current = data?.courses || {};
    const next = { ...current };
    if (dismissedKeys) next._dismissedChangeKeys = dismissedKeys;
    if (mutedCourses) next._mutedCourses = mutedCourses;
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch { /* cached locally; re-syncs next load */ }
}

export async function pushReadState(userId, readPingIds, seenGroupIds, readChangeKeys) {
  if (!userId) return;
  try {
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const current = data?.courses || {};
    const next = {
      ...current,
      // Union with the cloud so concurrent reads on two devices don't clobber each other
      _readPingIds: unionIds(current._readPingIds, [...readPingIds]),
      _seenGroupIds: unionIds(current._seenGroupIds, [...seenGroupIds]),
    };
    if (readChangeKeys) next._readChangeKeys = unionIds(current._readChangeKeys, [...readChangeKeys]);
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch {}
}
