// Supabase Edge Function: class-reminders
// Called by pg_cron every 5 minutes. Finds classes starting `lead` minutes
// from now (per-user lead: 15/30/60, stored in push_prefs) and sends a web
// push reminder to every enrolled student who has push + reminders enabled.
//
// Auth: requests must carry header  x-push-key: <PUSH_ADMIN_SECRET>
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//          PUSH_ADMIN_SECRET, FEED_URL (Apps Script schedule feed)
//
// Tables: push_subscriptions, push_prefs, reminder_log, schedule_cache,
//         profiles (courses jsonb), system_config (flags.classOverrides)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const LEADS = [15, 30, 60];
// How far back a trigger moment may be and still fire. Wider than the 5-min
// cron interval so a late or skipped cron run still catches up on the next run
// (reminder_log dedup guarantees once-only, so no duplicates). A reminder that
// would have fired on a missed run lands late rather than never.
const LOOKBACK_MIN = 15;

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

// IST = UTC+5:30, no DST. Returns { dateISO: "YYYY-MM-DD", minutes: 0-1439 }
function nowIST() {
  const t = new Date(Date.now() + 5.5 * 3600_000);
  return {
    dateISO: t.toISOString().slice(0, 10),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

function toMin(hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

type Cls = {
  date: string; code: string; section: string; name?: string;
  room?: string; start?: string; end?: string; type?: string; session?: string; faculty?: string;
};

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

  const { dateISO, minutes: nowMin } = nowIST();

  // ── 1. Today's schedule: live feed, fall back to cached copy ──────────────
  let classes: Cls[] | null = null;
  const feedUrl = Deno.env.get("FEED_URL");
  if (feedUrl) {
    try {
      const res = await fetch(feedUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
      // (8s, not 20s — a slow feed must not starve the send path; cache covers us)
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.CLASSES) && data.CLASSES.length > 0) {
          classes = data.CLASSES;
          await supabase.from("schedule_cache").upsert({
            id: "latest",
            payload: { CLASSES: data.CLASSES },
            fetched_at: new Date().toISOString(),
          });
        }
      }
    } catch { /* fall through to cache */ }
  }
  if (!classes) {
    const { data: cached } = await supabase.from("schedule_cache").select("payload").eq("id", "latest").maybeSingle();
    classes = cached?.payload?.CLASSES ?? null;
  }
  if (!classes) return json(200, { skipped: "no schedule available (feed down, cache empty)" });

  // ── 2. Apply admin class overrides (cancel / room / time) ─────────────────
  const { data: sysConfig } = await supabase.from("system_config").select("flags").eq("id", "global").maybeSingle();
  const overrides = sysConfig?.flags?.classOverrides?.[dateISO] || {};
  const applyOverride = (c: Cls): Cls => {
    const ovr = overrides[`${c.code}_${c.section}`] || overrides[c.code];
    return ovr ? { ...c, ...ovr } : c;
  };

  // ── 3. Classes whose start hits a lead window this run ────────────────────
  // A class matches lead L when the (startMin - L) trigger moment fell within
  // the last LOOKBACK_MIN minutes: startMin - L <= nowMin < startMin - L + LOOKBACK.
  // The window is wider than one cron interval so a delayed/skipped run still
  // catches up next time; reminder_log dedup keeps it once-only.
  const dueByLead: Record<number, Cls[]> = {};
  for (const raw of classes) {
    if (raw.date !== dateISO || (raw.type && raw.type !== "class")) continue;
    const c = applyOverride(raw);
    if ((c as { type?: string }).type === "cancelled") continue;
    const startMin = toMin(c.start);
    if (startMin === null) continue;
    for (const lead of LEADS) {
      const trigger = startMin - lead;
      if (trigger <= nowMin && nowMin < trigger + LOOKBACK_MIN) {
        (dueByLead[lead] ??= []).push(c);
      }
    }
  }
  // ── 4. Load users, prefs, subscriptions ───────────────────────────────────
  // (loaded even when no class is due — the morning summary check needs prefs)
  const [{ data: profiles }, { data: prefs }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("user_id, courses"),
    supabase.from("push_prefs").select("user_id, class_reminders, lead_minutes, daily_summary, summary_time"),
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth"),
  ]);
  if (!subs || subs.length === 0) return json(200, { sent: 0, note: "no push subscribers" });

  const prefByUser = new Map((prefs || []).map((p) => [p.user_id, p]));
  const subsByUser = new Map<string, typeof subs>();
  for (const s of subs) {
    (subsByUser.get(s.user_id) ?? subsByUser.set(s.user_id, []).get(s.user_id)!).push(s);
  }

  // ── 5. Match enrolled students to due classes ─────────────────────────────
  type Job = { userId: string; cls: Cls };
  const jobs: Job[] = [];
  for (const [leadStr, due] of Object.entries(dueByLead)) {
    const lead = Number(leadStr);
    for (const profile of profiles || []) {
      if (!subsByUser.has(profile.user_id)) continue;
      const pref = prefByUser.get(profile.user_id);
      const remindersOn = pref?.class_reminders ?? true; // default on
      const userLead = pref?.lead_minutes ?? 30;         // default 30 min
      if (!remindersOn || userLead !== lead) continue;
      for (const cls of due) {
        const enrolledSection = profile.courses?.[cls.code];
        if (!enrolledSection) continue;
        const sectionMatches =
          cls.section === "Single" || cls.section === "All" || enrolledSection === cls.section;
        if (sectionMatches) jobs.push({ userId: profile.user_id, cls });
      }
    }
  }
  // ── 5b. Morning summaries due this run (per-user summary_time) ────────────
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  type SummaryJob = { userId: string; title: string; body: string };
  const summaryJobs: SummaryJob[] = [];
  for (const profile of profiles || []) {
    if (!subsByUser.has(profile.user_id)) continue;
    const pref = prefByUser.get(profile.user_id);
    if (!pref?.daily_summary) continue;
    const trigger = toMin(pref.summary_time || "07:20");
    if (trigger === null || !(trigger <= nowMin && nowMin < trigger + LOOKBACK_MIN)) continue;

    const mine = classes
      .filter((raw) => raw.date === dateISO && (!raw.type || raw.type === "class"))
      .map(applyOverride)
      .filter((c) => (c as { type?: string }).type !== "cancelled")
      .filter((c) => {
        const enrolledSection = profile.courses?.[c.code];
        if (!enrolledSection) return false;
        return c.section === "Single" || c.section === "All" || enrolledSection === c.section;
      })
      .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

    const weekday = WEEKDAYS[new Date(`${dateISO}T00:00:00Z`).getUTCDay()];
    if (mine.length === 0) {
      summaryJobs.push({
        userId: profile.user_id,
        title: `🎉 No classes this ${weekday}`,
        body: "Nothing on your timetable today — enjoy the free day!",
      });
    } else {
      const lines = mine.slice(0, 6).map((c) =>
        `${c.start || "—"}  ${c.code}${c.room ? ` · ${c.room}` : ""}`
      );
      if (mine.length > 6) lines.push(`+${mine.length - 6} more`);
      summaryJobs.push({
        userId: profile.user_id,
        title: `📋 Your ${weekday}: ${mine.length} class${mine.length > 1 ? "es" : ""}`,
        body: lines.join("\n"),
      });
    }
  }

  if (jobs.length === 0 && summaryJobs.length === 0) {
    return json(200, { sent: 0, note: "nothing due this run" });
  }

  // ── 6. Dedupe via reminder_log (unique date+code+section+user) ────────────
  const logRows = [
    ...jobs.map((j) => ({ date: dateISO, code: j.cls.code, section: j.cls.section, user_id: j.userId })),
    ...summaryJobs.map((s) => ({ date: dateISO, code: "_summary", section: "_", user_id: s.userId })),
  ];
  const { data: inserted } = await supabase
    .from("reminder_log")
    .upsert(logRows, { onConflict: "date,code,section,user_id", ignoreDuplicates: true })
    .select("code, section, user_id");
  const freshKeys = new Set((inserted || []).map((r) => `${r.code}|${r.section}|${r.user_id}`));
  const toSend = jobs.filter((j) => freshKeys.has(`${j.cls.code}|${j.cls.section}|${j.userId}`));
  const summariesToSend = summaryJobs.filter((s) => freshKeys.has(`_summary|_|${s.userId}`));

  // ── 7. Send ────────────────────────────────────────────────────────────────
  // urgency:"high" tells the push service (FCM/APNs) to wake a dozing/idle
  // phone instead of batching the message — critical for time-sensitive
  // reminders. TTL is short so a message that can't be delivered before the
  // class starts is dropped rather than arriving hours stale.
  let sent = 0;
  const dead: string[] = [];

  // Returns whether the user received the push on at least one device, and
  // whether any device failed with a *retryable* (non-expired) error. The
  // reminder_log rows were reserved before sending (step 6); if a user got it
  // nowhere but hit a transient failure, we release their row so a later cron
  // run retries instead of the reminder being lost forever.
  async function pushToUser(userId: string, payload: string, ttlSec: number) {
    let delivered = false;
    let transientFail = false;
    for (const s of subsByUser.get(userId) || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: "high", TTL: ttlSec },
        );
        sent++;
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired or unsubscribed — prune, not retryable
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else transientFail = true;
      }
    }
    return { delivered, transientFail };
  }

  // reminder_log rows to release (delete) so the next run retries them
  const toRelease: { code: string; section: string; user_id: string }[] = [];

  await Promise.all(
    summariesToSend.map(async (s) => {
      const payload = JSON.stringify({
        title: s.title,
        body: s.body,
        url: "/?view=today",
        tag: `daily-summary-${dateISO}`,
        icon: "/icon-push-bell.png",
      });
      const { delivered, transientFail } = await pushToUser(s.userId, payload, 3600);
      if (!delivered && transientFail) {
        toRelease.push({ code: "_summary", section: "_", user_id: s.userId });
      }
    }),
  );
  await Promise.all(
    toSend.map(async ({ userId, cls }) => {
      const pref = prefByUser.get(userId);
      const lead = pref?.lead_minutes ?? 30;
      const isGuest = (cls.session || "").toLowerCase().includes("guest");
      const secLabel = cls.section === "Single" || cls.section === "All" ? "All sections" : `Section ${cls.section}`;
      const title = isGuest
        ? `🎓 Guest Session: ${cls.code} in ${lead} min`
        : `⏰ ${cls.code} starts in ${lead} minutes`;
      const bodyParts = [
        [cls.start, cls.end].filter(Boolean).join(" – "),
        cls.room ? `Room ${cls.room}` : null,
        secLabel,
      ].filter(Boolean).join("  ·  ");
      const payload = JSON.stringify({
        title,
        body: cls.name ? `${bodyParts}\n${cls.name}` : bodyParts,
        url: "/?view=today",
        tag: `class-reminder-${cls.code}-${dateISO}`,
        icon: "/icon-push-clock.png",
      });
      // Drop it if it can't arrive before the class actually starts
      const ttlSec = Math.max(60, lead * 60);
      const { delivered, transientFail } = await pushToUser(userId, payload, ttlSec);
      if (!delivered && transientFail) {
        toRelease.push({ code: cls.code, section: cls.section, user_id: userId });
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }
  // Release reserved dedup rows for undelivered/transient-failed jobs so the
  // next cron run retries them (composite PK, so delete one row at a time).
  if (toRelease.length > 0) {
    await Promise.all(
      toRelease.map((r) =>
        supabase.from("reminder_log").delete()
          .eq("date", dateISO).eq("code", r.code).eq("section", r.section).eq("user_id", r.user_id)
      ),
    );
  }
  // Keep the dedup log small — entries are useless after the day passes
  await supabase.from("reminder_log").delete().lt("date", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10));

  return json(200, { sent, users: toSend.length, summaries: summariesToSend.length, pruned: dead.length, released: toRelease.length, date: dateISO, nowMin });
});
