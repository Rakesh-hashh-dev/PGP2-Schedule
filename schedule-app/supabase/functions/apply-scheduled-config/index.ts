// Supabase Edge Function: apply-scheduled-config
// Runs on a cron (every minute). Looks at system_config.flags.scheduledConfigDeploys
// — a queue of { id, at, author, flags, announcement } entries staged from the
// Admin Tools "Scheduled Deploys" card — and applies any whose `at` (IST wall
// clock) is due. The most-recent due entry wins; all due entries are dequeued.
//
// Applying = replace live flags with the entry's snapshot, preserving configHistory
// and the remaining queue, and push a history entry so the change is reversible.
//
// Auth: service-role (invoked by cron via pg_net with the service key).

import { createClient } from "npm:@supabase/supabase-js@2";

const IST_OFFSET_MIN = 330; // Asia/Kolkata, no DST

// Interpret a "YYYY-MM-DDTHH:mm" wall-clock string as IST and return epoch ms.
function istWallClockToEpoch(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MIN * 60000;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error } = await supabase
    .from("system_config").select("flags, announcement").eq("id", "global").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const flags = row?.flags ?? {};
  const queue: any[] = Array.isArray(flags.scheduledConfigDeploys) ? flags.scheduledConfigDeploys : [];
  if (queue.length === 0) return new Response(JSON.stringify({ applied: 0 }));

  const now = Date.now();
  const due = queue.filter(e => istWallClockToEpoch(e.at) <= now);
  const pending = queue.filter(e => istWallClockToEpoch(e.at) > now);
  if (due.length === 0) return new Response(JSON.stringify({ applied: 0 }));

  // Latest due entry wins.
  due.sort((a, b) => istWallClockToEpoch(a.at) - istWallClockToEpoch(b.at));
  const winner = due[due.length - 1];

  const prevSnapshot = { ...flags };
  delete prevSnapshot.configHistory;
  delete prevSnapshot.scheduledConfigDeploys;
  const historyEntry = { timestamp: new Date().toISOString(), flags: prevSnapshot, author: winner.author || "scheduler" };

  const nextFlags = {
    ...(winner.flags || {}),
    scheduledConfigDeploys: pending,
    configHistory: [historyEntry, ...((flags.configHistory) || [])].slice(0, 15),
  };

  const { error: upErr } = await supabase.from("system_config").upsert({
    id: "global",
    announcement: winner.announcement ?? row?.announcement ?? null,
    flags: nextFlags,
    updated_at: new Date().toISOString(),
  });
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  // Best-effort audit trail.
  await supabase.from("admin_audit_logs").insert({
    admin_id: winner.author || "scheduler",
    action: "scheduled_config_applied",
    details: { at: winner.at, dequeued: due.length },
  });

  return new Response(JSON.stringify({ applied: due.length, remaining: pending.length }));
});
