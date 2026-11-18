import { supabase } from "./supabase.js";

const KEY = "pgp2.attendance";

export function sessionKey(c) {
  return `${c.date}_${c.start}_${c.code}_${c.section}`;
}

/**
 * Some exams are entered in the schedule data as type "class" with a session
 * label like "MID Term" — they don't count toward attendance.
 */
export function isExamSession(c) {
  if (!c) return false;
  if (c.type === "exam") return true;
  const s = (c.session || "").toLowerCase();
  const n = (c.name || "").toLowerCase();
  // Tolerate the separator the sheet actually uses — "mid term", "mid-term",
  // "midterm", "mid  term" all mean the same thing (likewise end term). A plain
  // `includes("mid term")` missed the hyphen/no-space variants, letting those
  // exam rows leak into attendance and out of the Exams tab.
  if (/mid[\s-]*term/.test(s) || /end[\s-]*term/.test(s) || s.includes("quiz")) return true;
  if (/mid[\s-]*term/.test(n) || /end[\s-]*term/.test(n) || n.includes("quiz")) return true;
  // End Term exam window: from 2026-12-11 through 2026-12-20.
  // In the source sheet, End Term exams are scheduled in 5.5h blocks (08:00–13:30 / 14:30–20:00)
  // with empty session strings and course codes. They are exams, not attendance classes.
  if (c.date >= "2026-12-11" && c.date <= "2026-12-20" && c.code && (c.slot === 0 || c.slot === 4 || !c.session || /end[\s-]*term/i.test(c.session))) {
    return true;
  }
  return false;
}

/**
 * Skip-budget math for one course — single source of truth shared by the
 * Attendance panel and the Timeline "what if I skip" hint.
 * Skip allowance is credit-based: 1.5-credit courses get 2 skips, 3-credit
 * courses get 4. Other credit values fall back to the percentage rule (80%
 * minimum attendance, 90% for zero-credit courses) over ALL scheduled
 * sessions; pct is computed over marked sessions only.
 */
const SKIPS_BY_CREDIT = { 1.5: 2, 3: 4 };

export function courseSkipStats(allClasses, code, section, attendance, { zeroCredit = false, credits = null } = {}) {
  const sessions = allClasses.filter(
    (c) => c.type === "class" && !isExamSession(c) && c.code === code && (c.section === "Single" || c.section === section)
  );
  const totalScheduled = sessions.length;
  let present = 0, absent = 0;
  sessions.forEach((s) => {
    const st = attendance[sessionKey(s)];
    if (st === "present") present++;
    else if (st === "absent") absent++;
  });
  const cr = credits == null || credits === "" ? null : parseFloat(credits);
  const fixedSkips = cr != null && !Number.isNaN(cr) ? SKIPS_BY_CREDIT[cr] : undefined;
  let totalAllowedSkips;
  if (fixedSkips !== undefined) {
    totalAllowedSkips = Math.min(fixedSkips, totalScheduled);
  } else {
    const minPct = zeroCredit || cr === 0 ? 0.90 : 0.80;
    const minAttend = Math.ceil(totalScheduled * minPct);
    totalAllowedSkips = Math.max(0, totalScheduled - minAttend);
  }
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
