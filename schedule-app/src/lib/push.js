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
  const { data } = await supabase
    .from("push_prefs")
    .select("class_reminders, lead_minutes, daily_summary, summary_time")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    enabled: data?.class_reminders ?? true,
    leadMinutes: data?.lead_minutes ?? 30,
    dailySummary: data?.daily_summary ?? false,
    summaryTime: data?.summary_time || "07:20",
  };
}

export async function setReminderPrefs(userId, { enabled, leadMinutes, dailySummary, summaryTime }) {
  const { error } = await supabase.from("push_prefs").upsert(
    {
      user_id: userId,
      class_reminders: enabled,
      lead_minutes: leadMinutes,
      daily_summary: dailySummary ?? false,
      summary_time: summaryTime || "07:20",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error("Could not save reminder settings: " + error.message);
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
