// Supabase Edge Function: class-reminders
// Called by pg_cron every 5 minutes. Finds classes starting `lead` minutes from
// now (per-user lead: 15/30/60, stored in push_prefs), plus due morning summaries
// and cancellation alerts, and INSERTS a notification row per matched student.
//
// Phase 2: this function no longer sends web-push. It is a *producer* — it writes
// events into `notifications` (dedup via the unique(user_id, dedup_key) constraint,
// which replaces reminder_log). The `dispatch` function owns push delivery.
//
// Auth: requests must carry header  x-push-key: <PUSH_ADMIN_SECRET>
// Secrets: PUSH_ADMIN_SECRET, FEED_URL (Apps Script schedule feed)
// Tables: notifications, push_subscriptions, push_prefs, schedule_cache,
//         profiles (courses jsonb), system_config (flags.classOverrides)

import { createClient } from "npm:@supabase/supabase-js@2";

const LEADS = [15, 30, 60];
// How far back a trigger moment may be and still fire. Wider than the 5-min cron
// interval so a late or skipped cron run still catches up on the next run (the
// notifications unique constraint guarantees once-only, so no duplicates).
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

// An IST wall-clock date+time (YYYY-MM-DD, HH:mm) as a UTC ISO instant — used for
// the push-expiry the dispatcher enforces (a reminder is worthless after the
// class starts). Returns null on bad input.
function istToUTCISO(dateISO: string, hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const d = new Date(`${dateISO}T${hhmm.padStart(5, "0")}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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

  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Acknowledge the cron immediately and produce rows in the background — the
  // feed fetch can be slow and pg_net tears the request down on disconnect.
  const work = runReminders(supabase).then(
    (stats) => console.log("class-reminders:", JSON.stringify(stats)),
    (e) => console.error("class-reminders failed:", e),
  );
  // deno-lint-ignore no-explicit-any
  const runtime = globalThis as any;
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
  else await work;
  return json(200, { accepted: true });
});

async function runReminders(supabase: ReturnType<typeof createClient>) {
  const { dateISO, minutes: nowMin } = nowIST();
  const tomorrowISO = new Date(new Date(`${dateISO}T00:00:00Z`).getTime() + 86400_000)
    .toISOString().slice(0, 10);

  // ── 1. Today's schedule: live feed, fall back to cached copy ──────────────
  let classes: Cls[] | null = null;
  const feedUrl = Deno.env.get("FEED_URL");
  if (feedUrl) {
    try {
      const res = await fetch(feedUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
      // (8s, not 20s — a slow feed must not starve the run; cache covers us)
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
  if (!classes) return { skipped: "no schedule available (feed down, cache empty)" };

  // ── 2. Apply admin class overrides (cancel / room / time) ─────────────────
  const { data: sysConfig } = await supabase.from("system_config").select("flags").eq("id", "global").maybeSingle();
  const overrides = sysConfig?.flags?.classOverrides?.[dateISO] || {};
  const applyOverride = (c: Cls): Cls => {
    const ovr = overrides[`${c.code}_${c.section}`] || overrides[c.code];
    return ovr ? { ...c, ...ovr } : c;
  };

  // ── 3. Classes whose start hits a lead window this run ────────────────────
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
  // (loaded even when no class is due — the morning summary check needs prefs;
  //  subs are used to skip producing events for users who can't receive push)
  const [{ data: profiles }, { data: prefs }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("user_id, courses"),
    supabase.from("push_prefs").select("user_id, class_reminders, lead_minutes, daily_summary, summary_time, cancellation_alerts"),
    supabase.from("push_subscriptions").select("user_id"),
  ]);
  if (!subs || subs.length === 0) return { created: 0, note: "no push subscribers" };

  const prefByUser = new Map((prefs || []).map((p) => [p.user_id, p]));
  const subscribed = new Set((subs as { user_id: string }[]).map((s) => s.user_id));

  // ── 5. Match enrolled students to due classes ─────────────────────────────
  type Job = { userId: string; cls: Cls };
  const jobs: Job[] = [];
  for (const [leadStr, due] of Object.entries(dueByLead)) {
    const lead = Number(leadStr);
    for (const profile of profiles || []) {
      if (!subscribed.has(profile.user_id)) continue;
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
    if (!subscribed.has(profile.user_id)) continue;
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

  // ── 5c. Cancellation alerts (today's still-upcoming + all of tomorrow's) ───
  type CancelJob = { userId: string; code: string; section: string; classDate: string; start?: string; room?: string; name?: string };
  const cancelJobs: CancelJob[] = [];
  const allOverrides = sysConfig?.flags?.classOverrides || {};
  for (const cancelDate of [dateISO, tomorrowISO]) {
    const dayOverrides = allOverrides[cancelDate] || {};
    for (const [key, ovr] of Object.entries(dayOverrides)) {
      if ((ovr as { type?: string })?.type !== "cancelled") continue;
      const us = key.lastIndexOf("_");
      const code = us === -1 ? key : key.slice(0, us);
      const section = us === -1 ? "All" : key.slice(us + 1);
      const orig = classes.find(
        (c) => c.date === cancelDate && c.code === code &&
          (section === "All" || c.section === section || c.section === "Single"),
      );
      const startMin = toMin(orig?.start);
      // Today: skip classes that already started — a "cancelled" alert then is moot
      if (cancelDate === dateISO && startMin !== null && startMin <= nowMin) continue;
      for (const profile of profiles || []) {
        if (!subscribed.has(profile.user_id)) continue;
        const pref = prefByUser.get(profile.user_id);
        if (!(pref?.cancellation_alerts ?? true)) continue; // own opt-out
        const enrolledSection = profile.courses?.[code];
        if (!enrolledSection) continue;
        const matches = section === "All" || enrolledSection === section;
        if (!matches) continue;
        cancelJobs.push({
          userId: profile.user_id, code, section, classDate: cancelDate,
          start: orig?.start, room: orig?.room, name: orig?.name,
        });
      }
    }
  }

  if (jobs.length === 0 && summaryJobs.length === 0 && cancelJobs.length === 0) {
    return { created: 0, note: "nothing due this run", date: dateISO, nowMin };
  }

  // ── 6. Build notification rows (dispatch delivers them) ───────────────────
  // urgency:"high" wakes a dozing phone; ttl bounds staleness; expires_at lets
  // dispatch drop a push that can no longer be useful (kept as an in-app record).
  const WEEKDAYS_SHORT = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const classRows = jobs.map(({ userId, cls }) => {
    const lead = prefByUser.get(userId)?.lead_minutes ?? 30;
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
    return {
      user_id: userId,
      type: "class_reminder",
      title,
      body: cls.name ? `${bodyParts}\n${cls.name}` : bodyParts,
      url: "/?view=today",
      icon: "/icon-push-clock.png",
      data: {
        code: cls.code, section: cls.section, date: dateISO,
        start: cls.start, end: cls.end, room: cls.room, lead,
        urgency: "high", ttl: Math.max(60, lead * 60),
        expires_at: istToUTCISO(dateISO, cls.start),
      },
      dedup_key: `class:${dateISO}:${cls.code}:${cls.section}`,
    };
  });

  const summaryRows = summaryJobs.map((s) => ({
    user_id: s.userId,
    type: "daily_summary",
    title: s.title,
    body: s.body,
    url: "/?view=today",
    icon: "/icon-push-bell.png",
    data: { urgency: "high", ttl: 14400 }, // 4h — still useful when a phone wakes mid-morning
    dedup_key: `summary:${dateISO}`,
  }));

  const cancelRows = cancelJobs.map((j) => {
    const whenWord = j.classDate === dateISO
      ? "today"
      : j.classDate === tomorrowISO
        ? "tomorrow"
        : WEEKDAYS_SHORT[new Date(`${j.classDate}T00:00:00Z`).getUTCDay()];
    const bodyParts = [
      j.start ? `${whenWord} at ${j.start}` : whenWord,
      j.room ? `Room ${j.room}` : null,
    ].filter(Boolean).join("  ·  ");
    return {
      user_id: j.userId,
      type: "class_cancelled",
      title: `❌ ${j.code} cancelled`,
      body: j.name ? `${bodyParts}\n${j.name} is cancelled` : `${bodyParts} — cancelled`,
      url: "/?view=today",
      icon: "/icon-push-bell.png",
      data: {
        code: j.code, section: j.section, date: j.classDate,
        urgency: "high", ttl: 21600, // 6h
        expires_at: istToUTCISO(j.classDate, j.start) || istToUTCISO(j.classDate, "23:59"),
      },
      dedup_key: `cancel:${j.classDate}:${j.code}:${j.section}`,
    };
  });

  const rows = [...classRows, ...summaryRows, ...cancelRows];

  // ── 7. Insert — the unique(user_id, dedup_key) constraint makes this once-only
  // across cron runs (ignoreDuplicates); .select() returns only the fresh rows.
  const { data: inserted, error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: error.message, candidates: rows.length, date: dateISO, nowMin };

  return {
    created: inserted?.length ?? 0,
    candidates: rows.length,
    classes: classRows.length,
    summaries: summaryRows.length,
    cancellations: cancelRows.length,
    date: dateISO, nowMin,
  };
}
