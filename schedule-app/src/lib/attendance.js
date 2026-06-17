import { supabase } from "./supabase.js";

const KEY = "pgp2.attendance";

export function sessionKey(c) {
  return `${c.date}_${c.start}_${c.code}_${c.section}`;
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
  const { data, error } = await supabase.from("attendance").select("session_key,status");
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
    if (status === null) await supabase.from("attendance").delete().eq("session_key", key);
    else await supabase.from("attendance").upsert(
      { user_id: userId, session_key: key, status },
      { onConflict: "user_id,session_key" }
    );
  } catch (e) { /* stays cached; re-syncs on next sync */ }
}
