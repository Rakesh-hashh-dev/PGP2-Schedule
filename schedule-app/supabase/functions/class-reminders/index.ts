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

// National-holiday check for the morning-summary push copy (mirrors
// src/lib/datetime.js's getSpecialDay — this function runs standalone in
// Deno so it can't import from the app bundle).
function getSpecialDay(dateISO: string) {
  const [, m, d] = dateISO.split("-").map(Number);
  if (m === 8 && d === 15) return { label: "Independence Day" };
  if (m === 1 && d === 26) return { label: "Republic Day" };
  return null;
}

function toMin(hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Match the app's schedule display format while keeping HH:MM for calculations.
function fmtTime12(hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm || "";
  const [hour, minute] = hhmm.split(":").map(Number);
  if (hour > 23 || minute > 59) return hhmm;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}${hour >= 12 ? "PM" : "AM"}`;
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
  // Mirrors src/lib/overrides.js lookupOverride: a legacy whole-day key
  // (`CODE_A` / `CODE`) is the base, a session key (`CODE_A@HH:MM`, keyed by the
  // feed start) layers on top — a course can meet twice a day.
  const applyOverride = (c: Cls): Cls => {
    const legacy = overrides[`${c.code}_${c.section}`] || overrides[c.code];
    const slot = c.start ? overrides[`${c.code}_${c.section}@${c.start}`] || overrides[`${c.code}@${c.start}`] : undefined;
    return legacy || slot ? { ...c, ...legacy, ...slot } : c;
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
  const [{ data: profiles, error: profilesError }, { data: prefs, error: prefsError }, { data: subs, error: subsError }] = await Promise.all([
    supabase.from("profiles").select("user_id, courses"),
    supabase.from("push_prefs").select("user_id, class_reminders, lead_minutes, daily_summary, summary_time, cancellation_alerts"),
    supabase.from("push_subscriptions").select("user_id"),
  ]);
  if (profilesError || prefsError || subsError) {
    throw new Error(`Could not load reminder recipients: ${profilesError?.message || prefsError?.message || subsError?.message}`);
  }
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

    // One-line day extras: exams today (from the feed) + assignments due today
    // (synced to profiles.courses._assignments by the app's assignments panel).
    const examsToday = classes
      .filter((c) => c.date === dateISO && c.type === "exam" && c.code && profile.courses?.[c.code])
      .map((c) => c.code);
    const dueToday: string[] = [];
    const assignStore = (profile.courses?._assignments ?? {}) as Record<string, unknown>;
    for (const [code, tasks] of Object.entries(assignStore)) {
      if (code.startsWith("_") || !Array.isArray(tasks)) continue;
      for (const t of tasks as { completed?: boolean; dueDate?: string }[]) {
        if (!t?.completed && t?.dueDate === dateISO) dueToday.push(code);
      }
    }
    const extras: string[] = [];
    if (examsToday.length) extras.push(`📝 Exam today: ${[...new Set(examsToday)].join(", ")}`);
    if (dueToday.length) extras.push(`📌 Due today: ${[...new Set(dueToday)].join(", ")}`);

    const specialDay = sysConfig?.flags?.features?.specialDayTheme !== false ? getSpecialDay(dateISO) : null;

    if (mine.length === 0 && specialDay) {
      // No flag emoji here — Windows lacks the regional-indicator glyph pair
      // and renders 🇮🇳 as literal "IN" text in the notification banner.
      summaryJobs.push({
        userId: profile.user_id,
        title: `Happy ${specialDay.label}`,
        body: ["No classes today. Enjoy the holiday.", ...extras].join("\n"),
      });
    } else if (mine.length === 0) {
      summaryJobs.push({
        userId: profile.user_id,
        title: `No classes today`,
        body: ["Your timetable is clear this " + weekday + ".", ...extras].join("\n"),
      });
    } else {
      // The first line survives collapsed truncation; expansion reveals each slot.
      const lines = mine.map((cls, index) =>
        `${index === 0 ? "First: " : ""}${cls.code} at ${fmtTime12(cls.start)}${cls.end ? `–${fmtTime12(cls.end)}` : ""}${cls.room ? ` · Room ${cls.room}` : ""}`
      );
      lines.push(...extras);
      summaryJobs.push({
        userId: profile.user_id,
        title: `Today: ${mine.length} class${mine.length > 1 ? "es" : ""}`,
        body: lines.join("\n"),
      });
    }
  }

  // ── 5c. Cancellation alerts (today's still-upcoming + all of tomorrow's) ───
  type CancelJob = { userId: string; code: string; section: string; classDate: string; slot?: string | null; start?: string; room?: string; name?: string };
  const cancelJobs: CancelJob[] = [];
  const allOverrides = sysConfig?.flags?.classOverrides || {};
  for (const cancelDate of [dateISO, tomorrowISO]) {
    const dayOverrides = allOverrides[cancelDate] || {};
    for (const [key, ovr] of Object.entries(dayOverrides)) {
      if ((ovr as { type?: string })?.type !== "cancelled") continue;
      // Key grammar mirrors src/lib/overrides.js parseOverrideKey.
      const slotM = /^(.*)@(\d{1,2}:\d{2})$/.exec(key);
      const base = slotM ? slotM[1] : key;
      const slotStart = slotM ? slotM[2] : null;
      const secM = /^(.*)_(A|B)$/.exec(base);
      const code = secM ? secM[1] : base;
      const section = secM ? secM[2] : "All";
      const orig = classes.find(
        (c) => c.date === cancelDate && c.code === code &&
          (section === "All" || c.section === section || c.section === "Single") &&
          (!slotStart || c.start === slotStart),
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
          userId: profile.user_id, code, section, classDate: cancelDate, slot: slotStart,
          start: orig?.start, room: orig?.room, name: orig?.name,
        });
      }
    }
  }

  // ── 5d. Meetup reminders (social plans) due this run ──────────────────────
  // A meetup starting within the next 15 min reminds the creator + everyone
  // who RSVP'd "going". Inserted here (service role) rather than at creation
  // time so the row hits the inbox at fire time; dedup makes re-runs no-ops.
  type MeetupRow = {
    id: string; title: string; place: string | null; starts_at: string;
    created_by: string; member_ids: string[] | null;
  };
  const meetupRows: Record<string, unknown>[] = [];
  {
    const nowMs = Date.now();
    const { data: dueMeetups } = await supabase
      .from("meetups")
      .select("id, title, place, starts_at, created_by, member_ids")
      .eq("cancelled", false)
      .gt("starts_at", new Date(nowMs).toISOString())
      .lte("starts_at", new Date(nowMs + 15 * 60_000).toISOString());
    if (dueMeetups && dueMeetups.length > 0) {
      const { data: rsvps } = await supabase
        .from("meetup_rsvps")
        .select("meetup_id, user_id, response")
        .in("meetup_id", (dueMeetups as MeetupRow[]).map((m) => m.id));
      const goingByMeetup = new Map<string, Set<string>>();
      for (const r of (rsvps || []) as { meetup_id: string; user_id: string; response: string }[]) {
        if (r.response !== "going") continue;
        (goingByMeetup.get(r.meetup_id) ?? goingByMeetup.set(r.meetup_id, new Set()).get(r.meetup_id)!).add(r.user_id);
      }
      for (const m of dueMeetups as MeetupRow[]) {
        const going = goingByMeetup.get(m.id) ?? new Set<string>();
        const recipients = new Set<string>([m.created_by, ...going]);
        const minsLeft = Math.max(1, Math.round((new Date(m.starts_at).getTime() - nowMs) / 60_000));
        for (const userId of recipients) {
          meetupRows.push({
            user_id: userId,
            type: "meetup_reminder",
            title: `📅 ${m.title} in ${minsLeft} min`,
            body: [m.place, `${going.size + 1} going`].filter(Boolean).join("  ·  "),
            url: "/?view=friends",
            icon: "/icon-192.png",
            data: {
              meetup_id: m.id,
              urgency: "high", ttl: 900,
              expires_at: m.starts_at,
            },
            dedup_key: `meetup_reminder:${m.id}`,
          });
        }
      }
    }
  }

  // ── 5e. Free-time nudges ("ping me when free", Phase C) ───────────────────
  // Drain due scheduled_nudges into notifications, then delete them (one-shot).
  // The dedup key includes the row id, so a re-run between insert and delete
  // still can't double-notify.
  const nudgeRows: Record<string, unknown>[] = [];
  {
    const { data: dueNudges } = await supabase
      .from("scheduled_nudges")
      .select("id, user_id, about_name, fire_at")
      .lte("fire_at", new Date().toISOString())
      .limit(500);
    if (dueNudges && dueNudges.length > 0) {
      for (const n of dueNudges as { id: string; user_id: string; about_name: string }[]) {
        const first = (n.about_name || "Your friend").split(" ")[0];
        nudgeRows.push({
          user_id: n.user_id,
          type: "free_nudge",
          title: `🔔 ${first} should be free now`,
          body: `${n.about_name}'s class just ended — ping them?`,
          url: "/?view=friends",
          icon: "/icon-192.png",
          data: { urgency: "normal", ttl: 1800 },
          dedup_key: `free_nudge:${n.id}`,
        });
      }
      await supabase.from("scheduled_nudges").delete()
        .in("id", (dueNudges as { id: string }[]).map((n) => n.id));
    }
  }

  if (jobs.length === 0 && summaryJobs.length === 0 && cancelJobs.length === 0 && meetupRows.length === 0 && nudgeRows.length === 0) {
    return { created: 0, note: "nothing due this run", date: dateISO, nowMin };
  }

  // ── 6. Build notification rows (dispatch delivers them) ───────────────────
  // urgency:"high" wakes a dozing phone; ttl bounds staleness; expires_at lets
  // dispatch drop a push that can no longer be useful (kept as an in-app record).
  const WEEKDAYS_SHORT = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const classRows = jobs.map(({ userId, cls }) => {
    const lead = prefByUser.get(userId)?.lead_minutes ?? 30;
    const isGuest = (cls.session || "").toLowerCase().includes("guest");
    const secLabel = cls.section === "Single" || cls.section === "All" ? null : `Section ${cls.section}`;
    const title = isGuest
      ? `Guest session: ${cls.code} in ${lead} min`
      : `${cls.code} starts in ${lead} min`;
    const bodyParts = [
      [cls.start, cls.end].filter(Boolean).map(fmtTime12).join("–"),
      cls.room ? `Room ${cls.room}` : null,
    ].filter(Boolean).join(" · ");
    const detail = [secLabel, cls.name].filter(Boolean).join(" · ");
    return {
      user_id: userId,
      type: "class_reminder",
      title,
      body: [bodyParts, detail].filter(Boolean).join("\n"),
      url: "/?view=today",
      icon: "/icon-192.png",
      data: {
        code: cls.code, section: cls.section, date: dateISO,
        start: cls.start, end: cls.end, room: cls.room, lead,
        urgency: "high", ttl: Math.max(60, lead * 60),
        expires_at: istToUTCISO(dateISO, cls.start),
      },
      // A course may meet twice on one day. Include the start time so both
      // sessions get a reminder while repeat cron runs still deduplicate.
      dedup_key: `class:${dateISO}:${cls.code}:${cls.section}:${cls.start}`,
    };
  });

  const summaryRows = summaryJobs.map((s) => ({
    user_id: s.userId,
    type: "daily_summary",
    title: s.title,
    body: s.body,
    url: "/?view=today",
    icon: "/icon-192.png",
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
      j.start ? fmtTime12(j.start) : null,
      j.section === "Single" || j.section === "All" ? null : `Section ${j.section}`,
      j.room ? `Room ${j.room}` : null,
    ].filter(Boolean).join(" · ");
    return {
      user_id: j.userId,
      type: "class_cancelled",
      title: `${j.code} cancelled ${whenWord}`,
      body: [bodyParts, "Your timetable has been updated."].filter(Boolean).join("\n"),
      url: "/?view=today",
      icon: "/icon-192.png",
      data: {
        code: j.code, section: j.section, date: j.classDate,
        urgency: "high", ttl: 21600, // 6h
        expires_at: istToUTCISO(j.classDate, j.start) || istToUTCISO(j.classDate, "23:59"),
      },
      // Session-scoped cancels get their own dedup slot so both of a day's
      // sessions can alert; legacy keys keep the old format (no re-sends).
      dedup_key: `cancel:${j.classDate}:${j.code}:${j.section}${j.slot ? `@${j.slot}` : ""}`,
    };
  });

  const rows = [...classRows, ...summaryRows, ...cancelRows, ...meetupRows, ...nudgeRows];

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
    meetups: meetupRows.length,
    nudges: nudgeRows.length,
    date: dateISO, nowMin,
  };
}
