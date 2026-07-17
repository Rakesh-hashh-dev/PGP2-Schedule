// Supabase Edge Function: dispatch-scheduled-pushes
// Reads `system_config.flags.scheduledPushes`, and for any whose scheduled
// date+time (IST wall-clock) has passed, fans out `notifications` rows — then
// removes them from the queue. Phase 2b: this is now a PRODUCER; `dispatch`
// delivers the actual push within a minute. No more web-push here.
//
// Called by pg_cron every minute. Setup SQL:
//   select cron.schedule(
//     'dispatch-scheduled-pushes',
//     '* * * * *',
//     $$ select net.http_post(
//       url := 'YOUR_SUPABASE_URL/functions/v1/dispatch-scheduled-pushes',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer SERVICE_ROLE_KEY',
//         'x-admin-key', 'PUSH_ADMIN_SECRET'
//       )
//     ) $$
//   );
//
// Secrets required: PUSH_ADMIN_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const adminSecret = Deno.env.get("PUSH_ADMIN_SECRET");
  const requestKey  = req.headers.get("x-admin-key");
  const authHeader  = req.headers.get("authorization") || "";
  const serviceKey  = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isCronCall  = serviceKey && authHeader.includes(serviceKey);
  const isAdminKey  = adminSecret && requestKey === adminSecret;

  if (!isCronCall && !isAdminKey) return json(401, { error: "Unauthorized" });

  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  // 1. Fetch system config
  const { data: cfg, error: cfgErr } = await supabase
    .from("system_config").select("flags").eq("id", "global").single();
  if (cfgErr || !cfg) return json(500, { error: cfgErr?.message ?? "No config" });

  const flags = cfg.flags ?? {};
  const scheduled: Array<{ id: string; title: string; body: string; url?: string; icon?: string; date: string; time: string }> =
    flags.scheduledPushes ?? [];
  if (scheduled.length === 0) return json(200, { fired: 0, remaining: 0 });

  // 2. Split due vs pending.
  // The admin UI stores date+time as IST wall-clock (what the admin typed —
  // AdminDashboard queues { date, time } verbatim and displays them unshifted).
  // So compare against *now in IST*, not real UTC. Building `now + 5:30` and
  // tagging it Z gives an IST wall-clock instant in the same format as the
  // stored `${date}T${time}:00.000Z`, so the comparison is apples-to-apples.
  const nowISTISO = new Date(Date.now() + 5.5 * 3600_000).toISOString();
  const due       = scheduled.filter(p => `${p.date}T${p.time}:00.000Z` <= nowISTISO);
  const remaining = scheduled.filter(p => `${p.date}T${p.time}:00.000Z`  > nowISTISO);
  if (due.length === 0) return json(200, { fired: 0, remaining: remaining.length });

  // 3. Fan out each due push to every user as a notification row. `dispatch`
  // delivers the push on its next tick; the row is already due so scheduled_for
  // stays null. dedup_key = broadcast:<push.id> makes the fan-out idempotent even
  // if this function runs twice before the dequeue lands.
  const { data: users, error: usersErr } = await supabase.from("profiles").select("user_id");
  if (usersErr) return json(500, { error: usersErr.message });

  let queued = 0;
  if (users && users.length > 0) {
    const rows = due.flatMap((push) =>
      users.map((u) => ({
        user_id: u.user_id,
        type: "admin_broadcast",
        title: push.title,
        body: push.body,
        url: push.url || "/",
        icon: push.icon || null,
        data: { urgency: "normal", ttl: 24 * 3600 },
        dedup_key: `broadcast:${push.id}`,
      }))
    );
    const { data: inserted, error: insErr } = await supabase
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
      .select("id");
    if (insErr) return json(500, { error: insErr.message });
    queued = inserted?.length ?? 0;
  }

  // 4. Remove fired items from the queue — atomic single-key update so a
  // concurrent admin edit to classOverrides in this same minute isn't clobbered.
  await supabase.rpc("dequeue_scheduled_pushes", { remaining });

  return json(200, { fired: due.length, queued, remaining: remaining.length });
});
