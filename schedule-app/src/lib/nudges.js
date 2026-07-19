import { supabase } from "./supabase.js";

// "Ping me when free" (social plan Phase C). One-shot self-reminders in
// `scheduled_nudges` (see migration 20260719150000): the client computes when
// a friend's current class ends and schedules a nudge; the class-reminders
// sweep turns due rows into `notifications` (type free_nudge) and deletes them.

/** Pending (future) nudges I've scheduled → { [about_user_id]: { id, fire_at } } */
export async function fetchMyNudges(userId) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase
      .from("scheduled_nudges")
      .select("id, about_user_id, fire_at")
      .eq("user_id", userId)
      .gt("fire_at", new Date().toISOString());
    if (error || !data) return {};
    const map = {};
    for (const row of data) if (row.about_user_id) map[row.about_user_id] = row;
    return map;
  } catch { return {}; }
}

/** Schedule a nudge about a friend. Returns the row or null. */
export async function scheduleNudge(userId, friend, fireAtISO) {
  if (!userId || !friend || !fireAtISO) return null;
  try {
    const { data, error } = await supabase
      .from("scheduled_nudges")
      .insert({
        user_id: userId,
        about_user_id: friend.cloudId || friend.id,
        about_name: friend.name,
        fire_at: fireAtISO,
      })
      .select()
      .single();
    if (error) { console.error("[scheduleNudge]", error.message); return null; }
    return data;
  } catch { return null; }
}

export async function cancelNudge(nudgeId) {
  if (!nudgeId) return false;
  try {
    const { error } = await supabase.from("scheduled_nudges").delete().eq("id", nudgeId);
    return !error;
  } catch { return false; }
}
