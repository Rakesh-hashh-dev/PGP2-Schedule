import { supabase } from "./supabase.js";

// Web Push subscription management. Subscriptions are stored in the
// `push_subscriptions` table (endpoint is the primary key) and consumed by
// the `send-push` Supabase Edge Function. See PUSH_SETUP.md in project root.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushConfigured() {
  return !!VAPID_PUBLIC_KEY;
}

export function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" but is touch-capable
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Why push can't be enabled right now — null means it can.
// "ios-install": iOS exposes PushManager only inside an installed PWA
// (iOS 16.4+), so a Safari tab looks "unsupported" but is fixable by the
// user via Add to Home Screen. Distinguishing it lets the UI show a guide
// instead of silently hiding the toggle.
export function pushBlockReason() {
  if (!pushConfigured()) return "unconfigured";
  if (pushSupported()) return null;
  if (isIOS() && !isStandalone()) return "ios-install";
  return "unsupported";
}

// Local render test — proves permission + notification display work on this
// device. Doesn't exercise the server push path (that's the Admin test send).
export async function showTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("TermFlow", {
    body: "Test notification — you're all set on this device. 🔔",
    icon: "/icon-push-bell.png",
    badge: "/badge-72.png",
    tag: "termflow-test",
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(userId) {
  if (!pushSupported()) throw new Error("Push is not supported on this device/browser.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Push is not configured (VITE_VAPID_PUBLIC_KEY missing).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error("Could not save subscription: " + error.message);
  return sub;
}

// ── Class-reminder preferences (push_prefs table, one row per user) ────────
// lead_minutes: 15 | 30 | 60, class_reminders: on/off. Defaults (no row): on, 30.

export async function getReminderPrefs(userId) {
  // select("*") rather than naming columns so this keeps working before the
  // cancellation_alerts migration is applied (the column is simply absent →
  // defaults to true below).
  const { data } = await supabase
    .from("push_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    enabled: data?.class_reminders ?? true,
    leadMinutes: data?.lead_minutes ?? 30,
    dailySummary: data?.daily_summary ?? false,
    summaryTime: data?.summary_time || "07:20",
    cancellationAlerts: data?.cancellation_alerts ?? true,
  };
}

// Missing-column error (PostgREST) — the cancellation_alerts migration hasn't
// been applied yet. We retry the write without that field so the existing
// reminder settings still save.
function isMissingColumn(error, column) {
  const msg = (error?.message || "").toLowerCase();
  return error?.code === "PGRST204" || (msg.includes(column) && msg.includes("column"));
}

export async function setReminderPrefs(userId, { enabled, leadMinutes, dailySummary, summaryTime, cancellationAlerts }) {
  const base = {
    user_id: userId,
    class_reminders: enabled,
    lead_minutes: leadMinutes,
    daily_summary: dailySummary ?? false,
    summary_time: summaryTime || "07:20",
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("push_prefs").upsert(
    { ...base, cancellation_alerts: cancellationAlerts ?? true },
    { onConflict: "user_id" }
  );
  if (!error) return;
  // Pre-migration fallback: save everything except the not-yet-existing column.
  if (isMissingColumn(error, "cancellation_alerts")) {
    const { error: retryError } = await supabase.from("push_prefs").upsert(base, { onConflict: "user_id" });
    if (!retryError) return;
    throw new Error("Could not save reminder settings: " + retryError.message);
  }
  throw new Error("Could not save reminder settings: " + error.message);
}

export async function unsubscribeFromPush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  try {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  } catch {
    // Cloud row cleanup is best-effort; local unsubscribe is what matters
  }
  await sub.unsubscribe();
}

// ── Full prefs matrix (Phase 5) ───────────────────────────────────────────
// Reads the new `push_prefs.prefs` JSONB column + quiet_start / quiet_end.
// Falls back to the legacy boolean columns if the new schema isn't deployed yet.
//
// Returned shape:
//   {
//     class_reminder:  { push: true, inapp: true, lead: 30 },
//     class_cancelled: { push: true, inapp: true },
//     daily_summary:   { push: false, time: "07:20" },
//     schedule_change: { push: true, inapp: true },
//     friend_request:  { push: true, inapp: true },
//     quiet_start: "22:00",   // null = no quiet hours
//     quiet_end:   "07:00",
//   }

const PREFS_DEFAULTS = {
  class_reminder:  { push: true,  inapp: true,  lead: 30 },
  class_cancelled: { push: true,  inapp: true },
  daily_summary:   { push: false, inapp: false, time: "07:20" },
  schedule_change: { push: true,  inapp: true },
  friend_request:  { push: true,  inapp: true },
};

export async function getFullPrefs(userId) {
  const { data } = await supabase
    .from("push_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Base from legacy columns (always present)
  const base = {
    class_reminder:  { push: data?.class_reminders ?? true,  inapp: true, lead: data?.lead_minutes ?? 30 },
    class_cancelled: { push: data?.cancellation_alerts ?? true, inapp: true },
    daily_summary:   { push: data?.daily_summary ?? false, inapp: false, time: data?.summary_time || "07:20" },
    schedule_change: { push: true, inapp: true },
    friend_request:  { push: true, inapp: true },
    quiet_start: null,
    quiet_end:   null,
  };

  // Overlay with new prefs JSONB if it exists
  if (data?.prefs && typeof data.prefs === "object") {
    const p = data.prefs;
    if (p.class_reminder)  base.class_reminder  = { ...base.class_reminder,  ...p.class_reminder };
    if (p.class_cancelled) base.class_cancelled = { ...base.class_cancelled, ...p.class_cancelled };
    if (p.daily_summary)   base.daily_summary   = { ...base.daily_summary,   ...p.daily_summary };
    if (p.schedule_change) base.schedule_change = { ...base.schedule_change, ...p.schedule_change };
    if (p.friend_request)  base.friend_request  = { ...base.friend_request,  ...p.friend_request };
  }
  if (data?.quiet_start) base.quiet_start = data.quiet_start;
  if (data?.quiet_end)   base.quiet_end   = data.quiet_end;

  return base;
}

export async function setFullPrefs(userId, prefs) {
  // Always mirror into the legacy columns for backward compat with class-reminders edge fn
  const legacyRow = {
    user_id: userId,
    class_reminders:     prefs.class_reminder?.push  ?? true,
    lead_minutes:        prefs.class_reminder?.lead  ?? 30,
    cancellation_alerts: prefs.class_cancelled?.push ?? true,
    daily_summary:       prefs.daily_summary?.push   ?? false,
    summary_time:        prefs.daily_summary?.time   || "07:20",
    updated_at: new Date().toISOString(),
  };

  // Build the new prefs JSONB (omit quiet hours — those are top-level columns)
  const prefsJsonb = {
    class_reminder:  { push: prefs.class_reminder?.push  ?? true,  inapp: prefs.class_reminder?.inapp  ?? true,  lead: prefs.class_reminder?.lead ?? 30 },
    class_cancelled: { push: prefs.class_cancelled?.push ?? true,  inapp: prefs.class_cancelled?.inapp ?? true },
    daily_summary:   { push: prefs.daily_summary?.push   ?? false, inapp: false, time: prefs.daily_summary?.time || "07:20" },
    schedule_change: { push: prefs.schedule_change?.push ?? true,  inapp: prefs.schedule_change?.inapp ?? true },
    friend_request:  { push: prefs.friend_request?.push  ?? true,  inapp: prefs.friend_request?.inapp  ?? true },
  };

  const fullRow = {
    ...legacyRow,
    prefs: prefsJsonb,
    quiet_start: prefs.quiet_start || null,
    quiet_end:   prefs.quiet_end   || null,
  };

  const { error } = await supabase
    .from("push_prefs")
    .upsert(fullRow, { onConflict: "user_id" });

  if (!error) return;

  // Pre-migration fallback: new columns may not exist yet — retry with only legacy columns
  if (error.code === "PGRST204" || error.message?.includes("column")) {
    const { error: retryErr } = await supabase
      .from("push_prefs")
      .upsert({ ...legacyRow, cancellation_alerts: legacyRow.cancellation_alerts }, { onConflict: "user_id" });
    if (!retryErr) return;
    throw new Error("Could not save preferences: " + retryErr.message);
  }
  throw new Error("Could not save preferences: " + error.message);
}
