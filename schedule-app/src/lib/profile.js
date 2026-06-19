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
    const cleanCourses = { ...data.courses };
    const remoteSeen = cleanCourses._lastSeenNotif;
    delete cleanCourses._name;
    delete cleanCourses._lastSeenNotif;
    const s = { courses: cleanCourses, lastSeenNotif: remoteSeen };
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

export async function pushProfile(userId, courses, userName, optionalLastSeenNotif) {
  const s = { courses };
  writeLocal(s);
  if (!userId) return s;
  
  const dbCourses = { ...courses };
  if (userName) dbCourses._name = userName;
  
  let lastSeenNotif = optionalLastSeenNotif;
  if (lastSeenNotif === undefined) {
    try { lastSeenNotif = parseInt(localStorage.getItem("pgp2-notif-seen") || "0", 10); } catch { }
  }
  if (lastSeenNotif) dbCourses._lastSeenNotif = lastSeenNotif;
  
  try {
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: dbCourses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) { /* cached; re-syncs next load */ }
  return s;
}
