import { supabase } from "./supabase.js";

const KEY = "pgp2.attendance";

export function sessionKey(c) {
  return `${c.date}_${c.start}_${c.code}_${c.section}`;
}

/**
 * Skip-budget math for one course — single source of truth shared by the
 * Attendance panel and the Timeline "what if I skip" hint.
 * 80% minimum attendance (90% for zero-credit courses) over ALL scheduled
 * sessions; pct is computed over marked sessions only.
 */
export function courseSkipStats(allClasses, code, section, attendance, { zeroCredit = false } = {}) {
  const sessions = allClasses.filter(
    (c) => c.type === "class" && c.code === code && (c.section === "Single" || c.section === section)
  );
  const totalScheduled = sessions.length;
  let present = 0, absent = 0;
  sessions.forEach((s) => {
    const st = attendance[sessionKey(s)];
    if (st === "present") present++;
    else if (st === "absent") absent++;
  });
  const minPct = zeroCredit ? 0.90 : 0.80;
  const minAttend = Math.ceil(totalScheduled * minPct);
  const totalAllowedSkips = Math.max(0, totalScheduled - minAttend);
  const skipsRemaining = Math.max(0, totalAllowedSkips - absent);
  const penaltyHit = absent > totalAllowedSkips;
  const marked = present + absent;
  const pct = marked > 0 ? Math.round((present / marked) * 100) : null;
  // Projection if one more session is marked absent
  const pctIfSkip = Math.round((present / (marked + 1)) * 100);
  return { totalScheduled, totalAllowedSkips, skipsRemaining, penaltyHit, present, absent, pct, pctIfSkip };
}

export function loadAttendance() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function saveAttendance(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export async function syncAttendanceFromCloud(userId) {
  const local = loadAttendance();
  if (!userId) return local;
  const { data, error } = await supabase.from("attendance").select("session_key,status").eq("user_id", userId);
  if (error || !data) return local;
  const remote = {};
  data.forEach((r) => { remote[r.session_key] = r.status; });

  const localOnly = Object.entries(local).filter(([k]) => !(k in remote));
  if (localOnly.length) {
    await supabase.from("attendance").upsert(
      localOnly.map(([session_key, status]) => ({ user_id: userId, session_key, status })),
      { onConflict: "user_id,session_key" }
    );
    localOnly.forEach(([k, v]) => { remote[k] = v; });
  }
  saveAttendance(remote);
  return remote;
}

export async function pushMark(userId, key, status) {
  if (!userId) return;
  try {
    if (status === null) await supabase.from("attendance").delete().eq("user_id", userId).eq("session_key", key);
    else await supabase.from("attendance").upsert(
      { user_id: userId, session_key: key, status },
      { onConflict: "user_id,session_key" }
    );
  } catch (e) { /* stays cached; re-syncs on next sync */ }
}
