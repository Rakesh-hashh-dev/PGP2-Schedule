import { supabase } from "./supabase.js";

const KEY = "pgp2.assignments";

export function loadAssignments() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveAssignments(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export async function pushAssignments(userId, assignments) {
  saveAssignments(assignments);
  if (!userId) return;

  try {
    const { data } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
    const current = data?.courses || {};
    
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        courses: {
          ...current,
          _assignments: assignments,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch (e) {
    // Fails silently; optimistic local UI continues working.
    // It will be re-synced on the next global pushProfile.
  }
}
