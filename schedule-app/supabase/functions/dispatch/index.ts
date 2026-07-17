// Supabase Edge Function: dispatch
// The SINGLE push-delivery path (Phase 2). Producers only INSERT rows into
// `notifications`; this function is the only code that talks to web-push. Called
// by pg_cron every minute.
//
// Each run: pick undelivered, due, non-stale notification rows; push each to its
// owner's device subscriptions; stamp delivered_push_at; prune expired subs.
// A row that can't be delivered (no subs, transient error, or past its push
// expiry) simply stays as an in-app record — the event still exists in the
// inbox; only the push was missed. Undelivered+transient rows retry next run
// automatically because delivered_push_at stays null (no reserve/release dance).
//
// Auth: header  x-push-key: <PUSH_ADMIN_SECRET>
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_ADMIN_SECRET
// Tables: notifications, push_subscriptions
//
// Cron:
//   select cron.schedule('termflow-dispatch', '* * * * *', $$
//     select net.http_post(
//       url := 'https://<ref>.supabase.co/functions/v1/dispatch',
//       headers := jsonb_build_object('Content-Type','application/json','x-push-key','<secret>'),
//       body := '{}'::jsonb) $$);

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// Only scan rows created in this window — a push older than this is stale and
// shouldn't fire even if it was never delivered (it lives on as an in-app record).
// Bounds the re-scan of never-deliverable rows (no subscription, etc.).
const SCAN_WINDOW_MS = 2 * 3600_000;
const MAX_ROWS = 1000;

// Quiet hours suppress push only for non-time-critical types; class reminders and
// cancellations are always allowed to fire (Phase 5).
const QUIET_EXEMPT = new Set(["class_reminder", "class_cancelled"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Notif = {
  id: string; user_id: string; type: string; title: string; body: string | null;
  url: string | null; icon: string | null; data: Record<string, unknown> | null;
  dedup_key: string; created_at: string;
};
type Sub = { user_id: string; endpoint: string; p256dh: string; auth: string };
type Prefs = {
  user_id: string;
  quiet_start: string | null;
  quiet_end: string | null;
  prefs: Record<string, { push?: boolean; inapp?: boolean }> | null;
};

// Current IST wall-clock minutes-of-day (0-1439). IST = UTC+5:30, no DST.
function istMinutesNow() {
  const t = new Date(Date.now() + 5.5 * 3600_000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}
function toMin(hhmm?: string | null) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
// True if `now` falls inside [start, end), handling windows that wrap midnight
// (e.g. 22:00 → 07:00).
function inQuietWindow(nowMin: number, start: number, end: number) {
  return start <= end ? (nowMin >= start && nowMin < end)
                      : (nowMin >= start || nowMin < end);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const adminSecret = Deno.env.get("PUSH_ADMIN_SECRET");
  if (!adminSecret || req.headers.get("x-push-key") !== adminSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublic || !vapidPrivate) return json(500, { error: "VAPID keys not configured" });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", vapidPublic, vapidPrivate);

  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Acknowledge the cron immediately; do the sends in the background so a slow
  // fan-out can't be torn down mid-flight by the pg_net client (same lesson as
  // class-reminders). Stats go to the function logs.
  const work = runDispatch(supabase).then(
    (stats) => console.log("dispatch:", JSON.stringify(stats)),
    (e) => console.error("dispatch failed:", e),
  );
  // deno-lint-ignore no-explicit-any
  const runtime = globalThis as any;
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
  else await work;
  return json(200, { accepted: true });
});

async function runDispatch(supabase: ReturnType<typeof createClient>) {
  // Admin kill-switch (system_config.flags.dispatchEnabled). Absent/true = deliver;
  // an explicit false pauses all push instantly without a redeploy. Producers keep
  // inserting rows, so the in-app inbox is unaffected and pushes resume (bounded by
  // the scan window) when it's flipped back on.
  const { data: cfg } = await supabase
    .from("system_config").select("flags").eq("id", "global").maybeSingle();
  if ((cfg?.flags as { dispatchEnabled?: boolean } | null)?.dispatchEnabled === false) {
    return { skipped: "dispatch disabled by admin kill-switch" };
  }

  const nowISO = new Date().toISOString();
  const sinceISO = new Date(Date.now() - SCAN_WINDOW_MS).toISOString();

  // Undelivered, due (scheduled_for null or past), recent rows.
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, body, url, icon, data, dedup_key, created_at")
    .is("delivered_push_at", null)
    .gte("created_at", sinceISO)
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowISO}`)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (!rows || rows.length === 0) return { delivered: 0, note: "nothing due" };

  // Only fetch subs + prefs for the users who actually have a pending row.
  const userIds = [...new Set((rows as Notif[]).map((r) => r.user_id))];
  const [{ data: subs }, { data: prefRows }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds),
    supabase.from("push_prefs").select("user_id, quiet_start, quiet_end, prefs").in("user_id", userIds),
  ]);
  const subsByUser = new Map<string, Sub[]>();
  for (const s of (subs || []) as Sub[]) {
    (subsByUser.get(s.user_id) ?? subsByUser.set(s.user_id, []).get(s.user_id)!).push(s);
  }
  const prefsByUser = new Map<string, Prefs>();
  for (const p of (prefRows || []) as Prefs[]) prefsByUser.set(p.user_id, p);

  const nowMin = istMinutesNow();
  const now = Date.now();
  let suppressed = 0;
  let sent = 0;
  const deliveredIds: string[] = [];
  const dead: string[] = [];

  await Promise.all((rows as Notif[]).map(async (row) => {
    const userSubs = subsByUser.get(row.user_id);
    if (!userSubs || userSubs.length === 0) return; // stays as in-app record

    // Per-type channel pref (Phase 5). Absent prefs → push allowed (back-compat).
    // A silent social row (friend_removed) is processed in-app only, never pushed.
    const pref = prefsByUser.get(row.user_id);
    const typePref = pref?.prefs?.[row.type];
    if (typePref?.push === false || (row.data && row.data.silent === true)) {
      // Push suppressed by preference; the row survives as an in-app record. Ages
      // out of the scan window in ≤2h, so it isn't re-scanned indefinitely.
      suppressed++;
      return;
    }

    // Quiet hours (Phase 5): suppress push for non-urgent types only, and leave
    // delivered_push_at null so it retries once the window ends (bounded by the
    // 2h scan / expires_at). Class reminders + cancellations are never silenced.
    if (!QUIET_EXEMPT.has(row.type)) {
      const qs = toMin(pref?.quiet_start);
      const qe = toMin(pref?.quiet_end);
      if (qs !== null && qe !== null && qs !== qe && inQuietWindow(nowMin, qs, qe)) {
        return;
      }
    }

    // Staleness / TTL from the producer's metadata. If the push expiry has passed
    // we skip the push entirely — the row remains visible in the inbox.
    const d = row.data || {};
    const expiresAt = typeof d.expires_at === "string" ? Date.parse(d.expires_at) : NaN;
    if (!Number.isNaN(expiresAt) && expiresAt <= now) return;
    const ttlSec = typeof d.ttl === "number" && d.ttl > 0
      ? d.ttl
      : !Number.isNaN(expiresAt)
        ? Math.max(60, Math.floor((expiresAt - now) / 1000))
        : 12 * 3600;
    const urgency = (d.urgency === "normal" || d.urgency === "low" || d.urgency === "high")
      ? d.urgency : "high";

    const payload = JSON.stringify({
      title: row.title,
      body: row.body || "",
      url: row.url || "/",
      tag: row.dedup_key,     // on-device de-dup: a re-send replaces, never stacks
      icon: row.icon || undefined,
    });

    let delivered = false;
    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency, TTL: ttlSec },
        );
        sent++;
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = expired/unsubscribed → prune. Anything else is transient:
        // leave delivered_push_at null so the next run retries this row.
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    }
    if (delivered) deliveredIds.push(row.id);
  }));

  if (deliveredIds.length > 0) {
    await supabase.from("notifications")
      .update({ delivered_push_at: new Date().toISOString() })
      .in("id", deliveredIds);
  }
  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }
  // Housekeeping: drop notification rows older than 30 days (inbox retention).
  await supabase.from("notifications").delete()
    .lt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString());

  return { candidates: rows.length, delivered: deliveredIds.length, sent, suppressed, pruned: dead.length };
}
