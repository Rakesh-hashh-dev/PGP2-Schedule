// Supabase Edge Function: schedule-diff
// Phase 4 producer. Diffs the current live schedule feed against the previous
// snapshot and, for each class that was ADDED or MOVED (time/room changed) on a
// today-or-future date, inserts a `schedule_change` notification row for every
// enrolled student. This is the SERVER source of truth for schedule changes, so
// devices agree and read state syncs via notifications.read_at — replacing the
// per-device client diff behind the Announcements feed.
//
// Removals/cancellations are intentionally NOT emitted here: admin cancellations
// already flow through class-reminders as `class_cancelled`, and emitting a
// `schedule_change:removed` too would double-notify. Full CancellationAlert
// reconciliation is the Phase 4 stretch (see docs/notification-architecture.md).
//
// Auth: header  x-push-key: <PUSH_ADMIN_SECRET>
// Secrets: PUSH_ADMIN_SECRET, FEED_URL
// Tables: schedule_snapshots, profiles, notifications
//
// Cron (every ~10 min is plenty; it only reacts to feed edits):
//   select cron.schedule('termflow-schedule-diff', '*/10 * * * *', $$
//     select net.http_post(
//       url := 'https://<ref>.supabase.co/functions/v1/schedule-diff',
//       headers := jsonb_build_object('Content-Type','application/json','x-push-key','<secret>'),
//       body := '{}'::jsonb) $$);

import { createClient } from "npm:@supabase/supabase-js@2";

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

// IST = UTC+5:30, no DST.
function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

// An IST wall-clock date+time as a UTC ISO instant, for push-expiry.
function istToUTCISO(dateISO: string, hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const d = new Date(`${dateISO}T${hhmm.padStart(5, "0")}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Cls = {
  date: string; code: string; section: string; name?: string;
  room?: string; start?: string; end?: string; type?: string;
};

// Identity of a schedule slot (which class, when, which section) vs. its mutable
// attributes (start/end/room). Same key + changed sig = "moved".
const keyOf = (c: Cls) => `${c.date}|${c.code}|${c.section}`;
const sigOf = (c: Cls) => `${c.start || ""}|${c.end || ""}|${c.room || ""}`;

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

  const work = runDiff(supabase).then(
    (stats) => console.log("schedule-diff:", JSON.stringify(stats)),
    (e) => console.error("schedule-diff failed:", e),
  );
  // deno-lint-ignore no-explicit-any
  const runtime = globalThis as any;
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
  else await work;
  return json(200, { accepted: true });
});

async function runDiff(supabase: ReturnType<typeof createClient>) {
  // 1. Current live feed
  const feedUrl = Deno.env.get("FEED_URL");
  if (!feedUrl) return { skipped: "no FEED_URL" };
  let current: Cls[] | null = null;
  try {
    const res = await fetch(feedUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.CLASSES)) current = data.CLASSES;
    }
  } catch { /* feed down — skip this run, don't overwrite snapshot */ }
  if (!current) return { skipped: "feed unavailable" };

  // 2. Previous snapshot
  const { data: snap } = await supabase
    .from("schedule_snapshots").select("payload").eq("id", "latest").maybeSingle();
  const previous: Cls[] | null = snap?.payload?.CLASSES ?? null;

  // Always store the fresh snapshot so the next run diffs against this one.
  const saveSnapshot = supabase.from("schedule_snapshots").upsert({
    id: "latest", payload: { CLASSES: current }, updated_at: new Date().toISOString(),
  });

  // First ever run (no prior snapshot): seed only, don't notify — every class
  // would look "added".
  if (!previous) {
    await saveSnapshot;
    return { seeded: true, classes: current.length };
  }

  const today = todayIST();
  const isClass = (c: Cls) => !c.type || c.type === "class";
  const future = (c: Cls) => c.date >= today;

  const prevMap = new Map<string, Cls>();
  for (const c of previous) if (isClass(c)) prevMap.set(keyOf(c), c);

  // 3. Detect added + moved on today-or-future dates
  type Change = { kind: "added" | "moved"; cls: Cls; prev?: Cls };
  const changes: Change[] = [];
  for (const c of current) {
    if (!isClass(c) || !future(c)) continue;
    const before = prevMap.get(keyOf(c));
    if (!before) {
      changes.push({ kind: "added", cls: c });
    } else if (sigOf(before) !== sigOf(c)) {
      changes.push({ kind: "moved", cls: c, prev: before });
    }
  }
  if (changes.length === 0) {
    await saveSnapshot;
    return { changes: 0 };
  }

  // 4. Enrolled students per affected course
  const { data: profiles } = await supabase.from("profiles").select("user_id, courses");
  const enrolledIn = (code: string, section: string) =>
    (profiles || []).filter((p) => {
      const sec = p.courses?.[code];
      return sec !== undefined && (section === "Single" || section === "All" || sec === section);
    });

  // 5. Build notification rows
  const rows: Record<string, unknown>[] = [];
  for (const ch of changes) {
    const c = ch.cls;
    const when = [c.start, c.end].filter(Boolean).join(" – ");
    const title = ch.kind === "added"
      ? `🆕 ${c.code} added`
      : `🔀 ${c.code} rescheduled`;
    const bodyParts = [
      when || null,
      c.room ? `Room ${c.room}` : null,
    ].filter(Boolean).join("  ·  ");
    for (const p of enrolledIn(c.code, c.section)) {
      rows.push({
        user_id: p.user_id,
        type: "schedule_change",
        title,
        body: c.name ? `${bodyParts}\n${c.name}` : bodyParts,
        url: "/?view=notifications",
        icon: "/icon-push-bell.png",
        data: {
          kind: ch.kind, code: c.code, section: c.section, date: c.date,
          start: c.start, end: c.end, room: c.room,
          urgency: "normal", ttl: 6 * 3600,
          expires_at: istToUTCISO(c.date, c.start) || istToUTCISO(c.date, "23:59"),
        },
        // Change signature is baked into the key so a genuinely new change (a
        // second reschedule of the same slot) produces a fresh row, while a
        // repeated diff of the same state dedups.
        dedup_key: `change:${ch.kind}:${keyOf(c)}:${sigOf(c)}`,
      });
    }
  }

  let created = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
      .select("id");
    if (error) { await saveSnapshot; return { error: error.message, candidates: rows.length }; }
    created = inserted?.length ?? 0;
  }

  await saveSnapshot;
  return {
    changes: changes.length,
    added: changes.filter((c) => c.kind === "added").length,
    moved: changes.filter((c) => c.kind === "moved").length,
    candidates: rows.length,
    created,
  };
}
