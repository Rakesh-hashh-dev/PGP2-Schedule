import { supabase } from "./supabase.js";

// Cohort mess ratings — one thumbs up/down per user, per day, per meal.
// Aggregate counts come from the get_mess_meal_stats RPC (see
// supabase/migrations/20260715120000_mess_ratings.sql). Everything here fails
// soft: if the migration hasn't been applied yet, the UI just hides ratings.

function dayISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// { meal: { up, down } } for the given date, or null if unavailable.
export async function fetchMealStats(date) {
  try {
    const { data, error } = await supabase.rpc("get_mess_meal_stats", { p_day: dayISO(date) });
    if (error || !Array.isArray(data)) return null;
    const out = {};
    for (const r of data) out[r.meal] = { up: r.up || 0, down: r.down || 0 };
    return out;
  } catch {
    return null;
  }
}

// This user's own ratings for the day: { meal: 1 | -1 }, or {} on failure.
export async function fetchMyRatings(userId, date) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase
      .from("mess_ratings")
      .select("meal, rating")
      .eq("user_id", userId)
      .eq("day", dayISO(date));
    if (error || !Array.isArray(data)) return {};
    const out = {};
    for (const r of data) out[r.meal] = r.rating;
    return out;
  } catch {
    return {};
  }
}

// Set (or clear, when rating === null) this user's rating for one meal.
// Returns true on success so the caller can roll back its optimistic update.
export async function setMealRating(userId, date, meal, rating) {
  if (!userId) return false;
  const day = dayISO(date);
  try {
    if (rating === null) {
      const { error } = await supabase.from("mess_ratings").delete()
        .eq("user_id", userId).eq("day", day).eq("meal", meal);
      return !error;
    }
    const { error } = await supabase.from("mess_ratings").upsert(
      { user_id: userId, day, meal, rating, updated_at: new Date().toISOString() },
      { onConflict: "user_id,day,meal" },
    );
    return !error;
  } catch {
    return false;
  }
}
