// Supabase Edge Function: dispatch-scheduled-pushes
// Reads `system_config.flags.scheduledPushes`, fires any whose
// scheduled date+time has passed, then removes them from the queue.
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
// Secrets required (same as send-push):
//   PUSH_ADMIN_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import webpush from "npm:web-push@3.6.7";
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
  const scheduled: Array<{ id: string; title: string; body: string; url?: string; date: string; time: string }> =
    flags.scheduledPushes ?? [];
  if (scheduled.length === 0) return json(200, { fired: 0, remaining: 0 });

  // 2. Split due vs pending (times stored as IST HH:mm, compare as UTC)
  const nowISO = new Date().toISOString();
  const due       = scheduled.filter(p => `${p.date}T${p.time}:00.000Z` <= nowISO);
  const remaining = scheduled.filter(p => `${p.date}T${p.time}:00.000Z`  > nowISO);
  if (due.length === 0) return json(200, { fired: 0, remaining: remaining.length });

  // 3. Configure VAPID
  const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  if (!vapidPublic || !vapidPrivate) return json(500, { error: "VAPID keys not configured" });
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // 4. Fetch subscribers
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subs || subs.length === 0) {
    await supabase.from("system_config").upsert({ id: "global", flags: { ...flags, scheduledPushes: remaining }, updated_at: new Date().toISOString() });
    return json(200, { fired: 0, remaining: remaining.length, note: "No subscribers" });
  }

  // 5. Fire each due push
  let totalSent = 0;
  const dead: string[] = [];

  for (const push of due) {
    const payload = JSON.stringify({ title: push.title, body: push.body, url: push.url || "/", tag: `scheduled-${push.id}` });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload, { urgency: "normal", TTL: 24 * 3600 }
        );
        totalSent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    }));
  }

  // 6. Prune dead subscriptions
  if (dead.length > 0) await supabase.from("push_subscriptions").delete().in("endpoint", dead);

  // 7. Save updated queue (fired items removed)
  await supabase.from("system_config").upsert({
    id: "global",
    flags: { ...flags, scheduledPushes: remaining },
    updated_at: new Date().toISOString(),
  });

  return json(200, { fired: due.length, sent: totalSent, pruned: dead.length, remaining: remaining.length });
});
