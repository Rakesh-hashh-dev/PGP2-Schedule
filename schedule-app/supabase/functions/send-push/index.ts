// Supabase Edge Function: send-push
// Sends Web Push notifications to subscribers stored in `push_subscriptions`.
//
// Auth: requests must carry header  x-push-key: <PUSH_ADMIN_SECRET>
// Secrets required (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), PUSH_ADMIN_SECRET
// SB_URL / SB_SERVICE_ROLE_KEY fall back to the platform-injected SUPABASE_* vars.
//
// Body: { title, body, url?, tag?, mode? }
//   mode: "digest" fills in a default morning-digest title/body when omitted.

import webpush from "npm:web-push@3.6.7";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const adminSecret = Deno.env.get("PUSH_ADMIN_SECRET");
  if (!adminSecret || req.headers.get("x-push-key") !== adminSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  if (!vapidPublic || !vapidPrivate) {
    return json(500, { error: "VAPID keys not configured" });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  let { title, body: message, url, tag, mode } = body as {
    title?: string; body?: string; url?: string; tag?: string; mode?: string;
  };
  if (mode === "digest") {
    title = title || "Good morning ☀️";
    message = message || "Check today's classes and plan your day on TermFlow.";
    tag = tag || "daily-digest";
    url = url || "/?view=today";
  }
  if (!title || !message) return json(400, { error: "title and body are required" });

  const supabase = createClient(
    Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) return json(500, { error: error.message });
  if (!subs || subs.length === 0) return json(200, { sent: 0, failed: 0, pruned: 0 });

  const payload = JSON.stringify({
    title,
    body: message,
    url: url || "/",
    tag,
    icon: (body as { icon?: string }).icon || undefined, // SW falls back to bell tile
  });

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired or unsubscribed — prune it
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return json(200, { sent, failed: subs.length - sent, pruned: dead.length });
});
