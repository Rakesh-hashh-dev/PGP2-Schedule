// Supabase Edge Function: schedule-diff
// Phase 4 producer. Turns the feed's pre-computed CHANGES log (the SAME schedule
// diff that powers the in-app Announcements page — added/moved/removed, produced
// by the Google Apps Script) into `schedule_change` notifications for enrolled,
// subscribed students. Reading the shared CHANGES log — instead of independently
// re-diffing CLASSES against a snapshot — keeps the bell and the Announcements
// page consistent (one source of truth) and avoids the multi-session keying bug.
//
// Only added/moved are emitted (removals/cancellations flow through
// class-reminders as `class_cancelled`; admin_only announcements go via send-push).
// Dedup is by the Apps Script's stable change id, so re-runs never duplicate.
//
// Auth: header x-push-key (PUSH_ADMIN_SECRET) or a service-role bearer (cron).
// Secrets: PUSH_ADMIN_SECRET, FEED_URL
// Tables: profiles, push_subscriptions, notifications
//
// Cron: select cron.schedule('termflow-schedule-diff','*/10 * * * *', $$ ... $$);

import { createClient } from "npm:@supabase/supabase-js@2";
import { scheduleNoticeCovered } from '../_shared/scheduleNoticeCoverage.js';
import { scheduleNoticeCopy } from '../_shared/notificationCopy.js';

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

// One entry in the feed's CHANGES log (Google Apps Script shape).
type ChangeItem = {
  id: string; ts?: string; date?: string; start?: string;
  kind?: string; text?: string; code?: string; admin_only?: boolean;
};

// Only notify about changes logged this recently — avoids re-announcing the whole
// historical log on first run; dedup by id covers overlap between runs.
const RECENT_MS = 3 * 3600_000;
// A single feed edit that flips many near-term classes at once is churn, not news.
const CHANGE_CAP = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Auth: x-push-key (PUSH_ADMIN_SECRET) OR a service-role bearer (pg_cron caller).
  const adminSecret = Deno.env.get("PUSH_ADMIN_SECRET");
  const serviceKey  = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader  = req.headers.get("authorization") || "";
  const authorized  = (adminSecret && req.headers.get("x-push-key") === adminSecret)
                   || (serviceKey && authHeader.includes(serviceKey));
  if (!authorized) return json(401, { error: "Unauthorized" });

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
  // 1. Pull the feed's shared CHANGES log.
  const feedUrl = Deno.env.get("FEED_URL");
  if (!feedUrl) return { skipped: "no FEED_URL" };
  let log: ChangeItem[] | null = null;
  let sourceClasses: Record<string, string>[] = [];
  try {
    const res = await fetch(feedUrl, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.CHANGES)) log = data.CHANGES;
      if (Array.isArray(data?.CLASSES)) sourceClasses = data.CLASSES;
    }
  } catch { /* feed down — skip this run */ }
  if (!log) return { skipped: "no CHANGES in feed" };

  const today = todayIST();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  const nearTerm = (d?: string) => d === today || d === tomorrow;
  const now = Date.now();

  // 2. Relevant = added/moved, near-term class date, recently logged, has a code,
  //    not an admin-only announcement.
  const relevant = log.filter((ch) =>
    (ch.kind === "added" || ch.kind === "moved") &&
    !ch.admin_only && !!ch.code && nearTerm(ch.date) &&
    (!ch.ts || (now - Date.parse(ch.ts)) <= RECENT_MS)
  );
  if (relevant.length === 0) return { changes: 0 };
  if (relevant.length > CHANGE_CAP) return { skipped: "too many recent changes — likely churn", changes: relevant.length };

  // 3. Enrolled + subscribed students per affected course. CHANGES carries no
  //    section, so notify everyone enrolled in the code (bounded to subscribers).
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("user_id, courses"),
    supabase.from("push_subscriptions").select("user_id"),
  ]);
  const subscribed = new Set((subs || []).map((s) => s.user_id));
  const enrolledInCode = (code: string) =>
    (profiles || []).filter((p) => subscribed.has(p.user_id) && p.courses?.[code] !== undefined);

  // 4. Build one row per (user, change). Retain verified session context and
  //    append the feed's change text; never infer old values from prose.
  const rows: Record<string, unknown>[] = [];
  const [{ data: noticeCoverage, error: coverageError }, { data: currentConfig, error: configError }] = await Promise.all([
    supabase.rpc('admin_list_schedule_notice_coverage', { p_dates: [today, tomorrow] }),
    supabase.from('system_config').select('flags').eq('id','global').maybeSingle(),
  ]);
  if (coverageError || configError) throw new Error(`Cannot verify schedule notice coverage: ${coverageError?.message || configError?.message}`);
  for (const ch of relevant) {
    for (const p of enrolledInCode(ch.code!)) {
      const matchingClasses = sourceClasses.filter(c => c.date === ch.date && c.code === ch.code && (!ch.start || c.start === ch.start) && (c.section === p.courses?.[ch.code!] || c.section === 'Single' || c.section === 'All'));
      if (matchingClasses.length > 0 && matchingClasses.every(c => scheduleNoticeCovered(noticeCoverage || [], p.user_id, c, currentConfig?.flags?.classOverrides?.[ch.date!] || {}))) continue;
      // Only use a verified session; do not invent before-values from free text.
      const session = matchingClasses.length === 1 ? matchingClasses[0] : { start: ch.start };
      const copy = scheduleNoticeCopy({ code: ch.code, date: ch.date, kind: ch.kind, effective: session, note: ch.text || '', today });
      rows.push({
        user_id: p.user_id,
        type: "schedule_change",
        ...copy,
        url: "/?view=notifications",
        icon: "/icon-192.png",
        data: {
          kind: ch.kind, code: ch.code, date: ch.date, start: ch.start,
          urgency: "normal", ttl: 6 * 3600,
          expires_at: istToUTCISO(ch.date!, ch.start) || istToUTCISO(ch.date!, "23:59"),
        },
        // Stable Apps Script change id → one row per change per user, forever
        // idempotent across runs.
        dedup_key: `change:${ch.id}`,
      });
    }
  }

  let created = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: error.message, candidates: rows.length };
    created = inserted?.length ?? 0;
  }

  return { changes: relevant.length, candidates: rows.length, created };
}
