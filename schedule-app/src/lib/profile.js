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
    const raw = data.courses;
    const remoteSeen = raw._lastSeenNotif;
    const readPingIds = raw._readPingIds || [];
    const seenGroupIds = raw._seenGroupIds || [];
    const cleanCourses = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    const s = { courses: cleanCourses, lastSeenNotif: remoteSeen, readPingIds, seenGroupIds };
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
    const rp = JSON.parse(localStorage.getItem("pgp2.read-ping-ids") || "[]");
    if (rp.length) dbCourses._readPingIds = rp;
  } catch {}
  try {
    const sg = JSON.parse(localStorage.getItem("pgp2.seen-recv-groups") || "[]");
    if (sg.length) dbCourses._seenGroupIds = sg;
  } catch {}

  try {
    await supabase.from("profiles").upsert(
      { user_id: userId, courses: dbCourses, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) { /* cached; re-syncs next load */ }
  return s;
}

export async function pushReadState(userId, readPingIds, seenGroupIds) {
  if (!userId) return;
  try {
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const current = data?.courses || {};
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        courses: {
          ...current,
          _readPingIds: [...readPingIds],
          _seenGroupIds: [...seenGroupIds],
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {}
}
