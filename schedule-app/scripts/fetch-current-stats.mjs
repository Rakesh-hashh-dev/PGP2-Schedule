import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzhfbttlbfpnwhempyav.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function istDateKey(dateOrMs) {
  const d = new Date(dateOrMs);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

async function run() {
  console.log("=== Fetching Data from Supabase ===");
  const now = Date.now();
  const todayKey = istDateKey(now);
  console.log("Current IST date:", todayKey);

  // 1. Profiles & Dev IDs
  const [{ data: profiles, error: pErr }, { data: devIdsRes, error: dErr }] = await Promise.all([
    supabase.from("profiles").select("user_id, email, courses, last_seen_at, updated_at"),
    supabase.rpc("get_dev_user_ids")
  ]);

  if (pErr) console.error("profiles error:", pErr);
  const devIds = new Set((devIdsRes || []).map(r => (typeof r === "string" ? r : r.dev_user_id)));
  console.log("Total raw profiles:", profiles?.length);
  console.log("Dev IDs count:", devIds.size);

  const prodProfiles = (profiles || []).filter(p => !devIds.has(p.user_id));
  console.log("Prod profiles count:", prodProfiles.length);

  // Profiles with saved course setup
  const profilesWithCourses = prodProfiles.filter(p => {
    const keys = Object.keys(p.courses || {}).filter(k => !k.startsWith("_"));
    return keys.length > 0;
  });
  console.log("Profiles with saved courses:", profilesWithCourses.length, "/", prodProfiles.length);

  // 2. Presence history
  const { data: presence30, error: pr30Err } = await supabase.rpc("admin_get_presence_history", { p_days: 30 });
  if (pr30Err) console.error("presence30 error:", pr30Err);
  
  const prodIds = new Set(prodProfiles.map(p => p.user_id));
  const cleanPresence = (presence30 || []).filter(r => prodIds.has(r.user_id));
  console.log("Clean presence rows (30 days):", cleanPresence.length);

  // Unique users in last 30 days
  const active30 = new Set(cleanPresence.map(r => r.user_id));
  console.log("Active prod profiles in last 30 calendar days:", active30.size);

  // 7 days
  const dayKeys7 = Array.from({ length: 7 }, (_, i) => istDateKey(now - (6 - i) * 86400000));
  console.log("7-day keys:", dayKeys7);
  const cleanPresence7 = cleanPresence.filter(r => dayKeys7.includes(r.activity_date));
  const active7 = new Set(cleanPresence7.map(r => r.user_id));
  console.log("Active prod profiles in last 7 calendar days:", active7.size);

  // User-days in 7-day period (sum of daily unique users)
  const dailyCounts7 = dayKeys7.map(date => {
    const forDay = cleanPresence.filter(r => r.activity_date === date);
    return { date, count: new Set(forDay.map(r => r.user_id)).size };
  });
  console.log("Daily counts 7 days:", dailyCounts7);
  const userDays7 = dailyCounts7.reduce((sum, d) => sum + d.count, 0);
  console.log("Total user-days (7 days):", userDays7);
  console.log("Mean active days per weekly active profile:", (userDays7 / active7.size).toFixed(2));

  // Active today
  const activeToday = new Set(cleanPresence.filter(r => r.activity_date === todayKey).map(r => r.user_id)).size;
  console.log("Active today (partial day):", activeToday);

  // Previous week (days -13 to -7)
  const prevWeekKeys = Array.from({ length: 7 }, (_, i) => istDateKey(now - (13 - i) * 86400000));
  console.log("Previous week keys:", prevWeekKeys);
  const cleanPresencePrevWeek = cleanPresence.filter(r => prevWeekKeys.includes(r.activity_date));
  const activePrevWeek = new Set(cleanPresencePrevWeek.map(r => r.user_id));
  console.log("Previous week active profiles:", activePrevWeek.size);

  // Peak daily activity in last 7 days
  const peakDay7 = dailyCounts7.reduce((max, d) => d.count > max.count ? d : max, { count: 0 });
  console.log("Peak daily activity in 7 days:", peakDay7);

  // 3. Rolling windows from prodProfiles.last_seen_at
  const within = days => prodProfiles.filter(d => d.last_seen_at && (now - new Date(d.last_seen_at).getTime()) <= days * 86400000).length;
  console.log("Rolling last_seen: 24h:", within(1), "7d:", within(7), "30d:", within(30));

  // 4. Feature usage days
  const { data: featureUsage, error: fuErr } = await supabase.from("feature_usage_days").select("*");
  if (fuErr) console.error("feature_usage error:", fuErr);
  console.log("Total feature usage rows:", featureUsage?.length);

  // Feature usage in last 7 days
  const fu7 = (featureUsage || []).filter(r => dayKeys7.includes(r.activity_date) && prodIds.has(r.user_id));
  const attendanceDays = fu7.filter(r => r.feature === "attendance_mark");
  const announcementDays = fu7.filter(r => r.feature === "announcements_view");
  const calendarDays = fu7.filter(r => r.feature === "calendar_export");

  console.log("7-day attendance student-days:", attendanceDays.length, "(unique users:", new Set(attendanceDays.map(r => r.user_id)).size, ")");
  console.log("7-day announcement student-days:", announcementDays.length, "(unique users:", new Set(announcementDays.map(r => r.user_id)).size, ")");
  console.log("7-day calendar export student-days:", calendarDays.length, "(unique users:", new Set(calendarDays.map(r => r.user_id)).size, ")");

  // 5. Admin stats (push subscriptions, friend pings, etc)
  const { data: adminStats, error: asErr } = await supabase.rpc("get_admin_stats");
  if (asErr) console.error("get_admin_stats error:", asErr);
  console.log("adminStats:", adminStats);

  // Share codes & friend pings
  const [{ count: shareCodeCount }, { count: friendPingCount }, { count: pushSubCount }] = await Promise.all([
    supabase.from("share_codes").select("*", { count: "exact", head: true }),
    supabase.from("friend_pings").select("*", { count: "exact", head: true }),
    supabase.from("push_subscriptions").select("*", { count: "exact", head: true })
  ]);
  console.log("Share codes count:", shareCodeCount);
  console.log("Friend pings count:", friendPingCount);
  console.log("Push subscriptions count:", pushSubCount);

  // 6. Cron health & push broadcast stats
  const [{ data: cronHealth }, { data: pushBroadcasts }] = await Promise.all([
    supabase.rpc("get_cron_health"),
    supabase.rpc("get_push_broadcast_stats")
  ]);
  console.log("Cron health jobs count:", cronHealth?.length);
  if (cronHealth) {
    console.log("Cron jobs:", cronHealth.map(c => ({ name: c.jobname || c.command, active: c.active })));
  }
  console.log("Push broadcast stats count:", pushBroadcasts?.length);

  // 7. Feedback & triage
  const [{ data: feedback }, { data: triage }] = await Promise.all([
    supabase.from("feedback").select("*"),
    supabase.from("admin_feedback_triage").select("*")
  ]);
  console.log("Feedback total count:", feedback?.length);
  const triageMap = Object.fromEntries((triage || []).map(t => [t.feedback_id, t]));
  if (feedback) {
    const feedbackSummary = feedback.map(f => {
      const t = triageMap[f.id] || {};
      return {
        id: f.id,
        user_id: f.user_id,
        category: f.category,
        message: f.message?.slice(0, 40),
        status: t.status || f.status || "pending",
        reply: t.first_reply_queued_at || null
      };
    });
    console.log("Feedback list:", feedbackSummary);
  }

  // 8. Timetable feed / snapshot
  const snapshotRaw = fs.readFileSync("src/data/schedule-snapshot.json", "utf-8");
  const snapshot = JSON.parse(snapshotRaw);
  const classes = (snapshot.classes || snapshot || []).filter(c => c.type === "class" || c.code);
  console.log("Local snapshot class count:", classes.length);
}

run().catch(console.error);
