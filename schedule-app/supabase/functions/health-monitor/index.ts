// Supabase Edge Function: health-monitor
// Runs on a cron (~every 15 min). Detects stalled/failed background jobs and an
// unreachable Google Sheets feed, then pushes an alert to ADMINS ONLY.
//
// "Admins only" = the union of:
//   • system_config.flags.alertRecipients  (explicit user_ids, managed from the
//     admin panel's "Health Alerts" card — normally just the admin's own id)
//   • system_config.flags.adminRoles keys  (anyone granted an admin role)
// If that set is empty, the function no-ops (never pushes to regular students).
//
// Alerts are written straight to the `notifications` table (service role) and
// delivered by the existing `dispatch` cron — same path as send-push. A time-
// bucketed dedup_key (problem signature + 3h bucket) makes re-runs idempotent, so
// admins get at most one ping per distinct problem per 3 hours.
//
// Auth: invoked by cron via pg_net (platform JWT). No public surface needed.
// Secrets: SB_URL / SB_SERVICE_ROLE_KEY fall back to platform SUPABASE_* vars.

import { createClient } from "npm:@supabase/supabase-js@2";

const SHEETS_FEED = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";
const STALE_MS = 20 * 60 * 1000; // a frequent job silent this long = stalled
const BUCKET_MS = 3 * 60 * 60 * 1000; // re-alert cadence for an unresolved problem

// A "frequent" job is expected to run at least every ~hour; daily jobs are exempt
// from the staleness check (a 24h-old last_run is normal for them).
function isFrequent(schedule: string): boolean {
  const s = (schedule || "").trim();
  return s.includes("* * * * *") || /^\*\/\d+ /.test(s) || /^[\d,]+ \* /.test(s);
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Resolve admin recipients.
  const { data: cfg } = await supabase
    .from("system_config").select("flags").eq("id", "global").single();
  const flags = cfg?.flags ?? {};
  const explicit: string[] = Array.isArray(flags.alertRecipients) ? flags.alertRecipients : [];
  const roleIds: string[] = flags.adminRoles ? Object.keys(flags.adminRoles) : [];
  const recipients = [...new Set([...explicit, ...roleIds])].filter(Boolean);
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ skipped: "no admin recipients configured" }));
  }

  const problems: string[] = [];
  const now = Date.now();

  // 2. Cron health via the SECURITY DEFINER RPC (jobname/status/last_run/schedule/active).
  try {
    const { data: jobs, error } = await supabase.rpc("get_cron_health");
    if (error) {
      problems.push(`cron health RPC error: ${error.message}`);
    } else {
      for (const j of jobs ?? []) {
        if (!j.active) continue; // paused on purpose
        const status = String(j.status ?? "").toLowerCase();
        if (status === "failed") { problems.push(`${j.jobname}: last run FAILED`); continue; }
        if (isFrequent(j.schedule)) {
          const age = j.last_run ? now - new Date(j.last_run).getTime() : Infinity;
          if (age > STALE_MS) problems.push(`${j.jobname}: no successful run in ${j.last_run ? Math.round(age / 60000) + " min" : "recorded history"}`);
        }
      }
    }
  } catch (e) {
    problems.push(`cron health check threw: ${(e as Error).message}`);
  }

  // 3. Google Sheets live feed.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(`${SHEETS_FEED}?action=ping`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) problems.push(`Sheets feed returned HTTP ${resp.status}`);
  } catch (e) {
    problems.push(`Sheets feed unreachable (${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message})`);
  }

  if (problems.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipients: recipients.length }));
  }

  // 4. Alert admins. Signature = sorted problem set; bucket the time so an
  //    unresolved issue re-pings every BUCKET_MS instead of every run.
  const signature = [...problems].sort().join("|");
  const bucket = Math.floor(now / BUCKET_MS);
  const dedupKey = `health:${bucket}:${hash(signature)}`;
  const title = problems.length === 1 ? "⚠️ TermFlow health alert" : `⚠️ TermFlow: ${problems.length} health issues`;
  const bodyText = problems.slice(0, 4).join(" · ") + (problems.length > 4 ? ` · +${problems.length - 4} more` : "");

  const rows = recipients.map((uid) => ({
    user_id: uid,
    type: "health_alert",
    title,
    body: bodyText,
    url: "/?view=admin",
    data: { urgency: "high", ttl: 6 * 3600 },
    dedup_key: dedupKey,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
    .select("id");
  if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });

  return new Response(JSON.stringify({ alerted: inserted?.length ?? 0, recipients: recipients.length, problems }));
});

// Tiny stable string hash for the dedup key (djb2).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
