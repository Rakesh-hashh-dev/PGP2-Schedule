// ── Self-set status ("status line") ──────────────────────────────
// A short, auto-expiring status shown on your friend card next to the
// computed free/busy dot. Stored in the profiles JSONB blob as `_status`
// ({ id, emoji, text, until }) so friends receive it through the same
// profile reads that already deliver courses — no new table, no new RLS.
// Clients treat a past `until` as "no status"; nothing cleans up server-side.

const LS_KEY = "pgp2.my-status";

export const STATUS_PRESETS = [
  { id: "chai",    emoji: "☕", text: "Chai break" },
  { id: "library", emoji: "📚", text: "In library" },
  { id: "mess",    emoji: "🍽️", text: "Heading to mess" },
  { id: "sports",  emoji: "🏸", text: "At sports" },
  { id: "resting", emoji: "😴", text: "Resting" },
];

// mins: null → until local midnight
export const STATUS_DURATIONS = [
  { label: "30 min", mins: 30 },
  { label: "1 hr",   mins: 60 },
  { label: "2 hrs",  mins: 120 },
  { label: "Today",  mins: null },
];

export function statusUntil(mins) {
  const d = new Date();
  if (mins == null) {
    d.setHours(23, 59, 59, 0);
  } else {
    d.setTime(d.getTime() + mins * 60000);
  }
  return d.toISOString();
}

// Returns the status if it hasn't expired, else null.
export function activeStatus(status) {
  if (!status || !status.until || !status.text) return null;
  return new Date(status.until).getTime() > Date.now() ? status : null;
}

export function fmtStatusUntil(untilISO) {
  const d = new Date(untilISO);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function loadMyStatus() {
  try {
    return activeStatus(JSON.parse(localStorage.getItem(LS_KEY) || "null"));
  } catch {
    return null;
  }
}

// status = { id, emoji, text, until } | null (clear). localStorage first for
// instant paint, then the profiles blob (same read-modify-write pattern as
// _hide_from_matchmaker).
export async function setMyStatus(userId, status) {
  try {
    if (status) localStorage.setItem(LS_KEY, JSON.stringify(status));
    else localStorage.removeItem(LS_KEY);
  } catch {}
  if (!userId) return;
  try {
    const { supabase } = await import("./supabase.js");
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).single();
    if (!data?.courses) return;
    const updated = { ...data.courses };
    if (status) updated._status = status;
    else delete updated._status;
    await supabase.from("profiles").update({ courses: updated }).eq("user_id", userId);
  } catch (e) {
    console.error("[status] cloud write failed:", e?.message || e);
  }
}

// ── Away sharing (social plan Phase E) ───────────────────────────
// Opt-in from the Leave Planner: `_away: { from, to }` (YYYY-MM-DD, inclusive)
// in the profiles blob. Friends' cards show an Away chip instead of free/busy
// while today falls inside the window. Default off; clearing removes the key.

const AWAY_LS_KEY = "pgp2.my-away";

// Returns the away window if it's still current (to >= today), else null.
export function activeAway(away, now = new Date()) {
  if (!away || !away.from || !away.to) return null;
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return away.to >= todayISO ? away : null;
}

export function isAwayNow(away, now = new Date()) {
  const a = activeAway(away, now);
  if (!a) return false;
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return a.from <= todayISO;
}

export function fmtAwayEnd(toISO) {
  const d = new Date(`${toISO}T00:00:00`);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function loadMyAway() {
  try {
    return activeAway(JSON.parse(localStorage.getItem(AWAY_LS_KEY) || "null"));
  } catch {
    return null;
  }
}

// away = { from, to } | null (stop sharing). Same write pattern as setMyStatus.
export async function setMyAway(userId, away) {
  try {
    if (away) localStorage.setItem(AWAY_LS_KEY, JSON.stringify(away));
    else localStorage.removeItem(AWAY_LS_KEY);
  } catch {}
  if (!userId) return;
  try {
    const { supabase } = await import("./supabase.js");
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).single();
    if (!data?.courses) return;
    const updated = { ...data.courses };
    if (away) updated._away = away;
    else delete updated._away;
    await supabase.from("profiles").update({ courses: updated }).eq("user_id", userId);
  } catch (e) {
    console.error("[away] cloud write failed:", e?.message || e);
  }
}

// Fresh status + away window for a set of friends, one query.
// Returns { user_id: { status, away } } (each field null when absent/expired).
export async function fetchFriendPresence(cloudIds) {
  const ids = (cloudIds || []).filter(Boolean);
  if (!ids.length) return {};
  try {
    const { supabase } = await import("./supabase.js");
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, status:courses->_status, away:courses->_away")
      .in("user_id", ids);
    if (error || !data) return {};
    const map = {};
    for (const row of data) {
      const status = activeStatus(row.status);
      const away = activeAway(row.away);
      if (status || away) map[row.user_id] = { status, away };
    }
    return map;
  } catch {
    return {};
  }
}

// Fresh statuses for a set of friends (the local friends cache can be minutes
// stale, too old for a 30-min status). Returns { user_id: status } with only
// active statuses.
export async function fetchFriendStatuses(cloudIds) {
  const ids = (cloudIds || []).filter(Boolean);
  if (!ids.length) return {};
  try {
    const { supabase } = await import("./supabase.js");
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, status:courses->_status")
      .in("user_id", ids);
    if (error || !data) return {};
    const map = {};
    for (const row of data) {
      const s = activeStatus(row.status);
      if (s) map[row.user_id] = s;
    }
    return map;
  } catch {
    return {};
  }
}
