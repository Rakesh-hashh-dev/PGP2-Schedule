import { supabase } from "./supabase.js";

const attempted = new Set();

export async function recordFeatureUse(userId, feature) {
  if (!userId || !["attendance_mark", "calendar_export", "announcements_view"].includes(feature)) return;
  const date = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const key = `${userId}:${feature}:${date}`;
  if (attempted.has(key)) return;
  attempted.add(key);
  try {
    await supabase.from("feature_usage_days").upsert(
      { user_id: userId, feature, activity_date: date },
      { onConflict: "user_id,feature,activity_date" },
    );
  } catch {
    // Usage tracking must never interrupt the student action.
  }
}
