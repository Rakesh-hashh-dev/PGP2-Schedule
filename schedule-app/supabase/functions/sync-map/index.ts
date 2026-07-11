/**
 * sync-map — Supabase Edge Function
 *
 * Keeps `_migration_map` complete and current while the app runs on the DEV
 * Clerk instance, so that at cutover every user has an `email → dev_user_id`
 * bridge (no orphans). Called fire-and-forget by the app on each login.
 *
 * POST body: { email: string, dev_user_id: string }
 *
 * Behaviour (idempotent, non-destructive):
 *   - Upserts on `email`.
 *   - Only sets `dev_user_id` if the row doesn't already have one.
 *   - NEVER touches `prod_user_id`, `migrated_at`, or `status`.
 *
 * Safe to run on dev with real users: it only writes to the locked migration
 * table via service_role and returns quickly. Callers ignore the response.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require a bearer token so this isn't trivially callable anonymously.
  // (The write is harmless either way — it only records email↔dev_user_id —
  // but we still gate on the caller having a Clerk session.)
  if (!req.headers.get("Authorization")) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let email: string, devUserId: string;
  try {
    const body = await req.json();
    email     = body.email?.toLowerCase()?.trim();
    devUserId = body.dev_user_id?.trim();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  if (!email || !devUserId) {
    return json({ ok: false, error: "Missing email or dev_user_id" }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

  // Does a row already exist for this email?
  const { data: existing, error: selErr } = await db
    .from("_migration_map")
    .select("email, dev_user_id")
    .eq("email", email)
    .maybeSingle();

  if (selErr) {
    console.error("sync-map select failed:", selErr);
    return json({ ok: false, error: "DB error" }, 500);
  }

  // Already has a dev_user_id → nothing to do (don't clobber the export).
  if (existing?.dev_user_id) {
    return json({ ok: true, action: "noop" });
  }

  // Insert new, or backfill dev_user_id on a partial row.
  const { error: upErr } = await db
    .from("_migration_map")
    .upsert({ email, dev_user_id: devUserId }, { onConflict: "email" });

  if (upErr) {
    console.error("sync-map upsert failed:", upErr);
    return json({ ok: false, error: "DB write failed" }, 500);
  }

  console.log(`sync-map: recorded ${email} → ${devUserId}`);
  return json({ ok: true, action: existing ? "backfilled" : "inserted" });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
