import { supabase } from "./supabase.js";

const SETUP_KEY = "pgp2.setup";
function readLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
function writeLocal(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) {} }

export async function syncProfileFromCloud(userId) {
  const local = readLocal();
  if (!userId) return local;
  const { data, error } = await supabase.from("profiles").select("courses").maybeSingle();
  if (error) return local;
  if (data && data.courses && Object.keys(data.courses).length) {
    const s = { courses: data.courses };
    writeLocal(s);
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

export async function pushProfile(userId, courses) {
  const s = { courses };
  writeLocal(s);
  if (!userId) return s;
  try {
    await supabase.from("profiles").upsert(
      { user_id: userId, courses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) { /* cached; re-syncs next load */ }
  return s;
}
