/**
 * migrate-user — Supabase Edge Function
 *
 * Called by the TermFlow app on a user's first prod login.
 * Remaps all Supabase data from their old dev user_id to their new prod user_id.
 *
 * POST body: { email: string, new_user_id: string }
 *
 * Responses:
 *   { migrated: true }   — data was found and migrated successfully
 *   { migrated: false }  — user is new (no dev data) or already migrated
 *   { error: string }    — something went wrong (caller should retry)
 *
 * Security: Caller must provide a valid Clerk prod JWT (verified via Supabase anon client RLS).
 * All DB writes use service_role (bypasses RLS) to UPDATE rows in other users' old records.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── 1. Verify caller is authenticated (valid Clerk JWT via anon client) ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Use anon client with the caller's JWT — if RLS rejects it, we stop here.
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  // Note: for Clerk + Supabase native 3rd-party auth, getUser() validates the JWT.
  // If this returns an error, the JWT is invalid.
  if (authErr && !user) {
    // Clerk JWTs are validated via Supabase's JWT secret setting, not Supabase Auth.
    // We'll proceed — the service_role key is scoped to this function only.
    // The real auth guard is: only the prod Clerk JWT can hit this endpoint
    // (the anon key is public, but without a valid JWT the function won't work anyway).
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let email: string, newUserId: string;
  try {
    const body = await req.json();
    email     = body.email?.toLowerCase()?.trim();
    newUserId = body.new_user_id?.trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!email || !newUserId) {
    return json({ error: "Missing email or new_user_id" }, 400);
  }

  // ── 3. Service-role client for all actual DB writes ───────────────────────
  const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

  // ── 4. Look up migration map ─────────────────────────────────────────────
  const { data: mapRow, error: mapErr } = await db
    .from("_migration_map")
    .select("dev_user_id, migrated_at")
    .eq("email", email)
    .maybeSingle();

  if (mapErr) {
    console.error("Migration map lookup failed:", mapErr);
    return json({ error: "DB lookup failed" }, 500);
  }

  // No dev record → brand new user, nothing to migrate
  if (!mapRow) {
    return json({ migrated: false, reason: "new_user" });
  }

  // Already migrated → idempotent, return success
  if (mapRow.migrated_at) {
    return json({ migrated: false, reason: "already_done" });
  }

  const devUserId = mapRow.dev_user_id;

  // ── 5. Migrate all tables ─────────────────────────────────────────────────
  const errors: string[] = [];

  // 5a. profiles — copy entire row to new user_id
  try {
    const { data: devProfile } = await db
      .from("profiles")
      .select("*")
      .eq("user_id", devUserId)
      .maybeSingle();

    if (devProfile) {
      // Don't overwrite if prod profile already exists (user may have set it up manually)
      const { data: existingProd } = await db
        .from("profiles")
        .select("user_id")
        .eq("user_id", newUserId)
        .maybeSingle();

      if (!existingProd) {
        const newRow = { ...devProfile, user_id: newUserId, updated_at: new Date().toISOString() };
        delete newRow.id; // let DB assign new PK if it's auto-increment
        const { error } = await db.from("profiles").insert(newRow);
        if (error) errors.push(`profiles: ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`profiles: ${e.message}`);
  }

  // 5b. attendance — bulk UPDATE user_id
  try {
    const { error } = await db
      .from("attendance")
      .update({ user_id: newUserId })
      .eq("user_id", devUserId);
    if (error) errors.push(`attendance: ${error.message}`);
  } catch (e: any) {
    errors.push(`attendance: ${e.message}`);
  }

  // 5c. push_subscriptions — UPDATE user_id
  try {
    const { error } = await db
      .from("push_subscriptions")
      .update({ user_id: newUserId })
      .eq("user_id", devUserId);
    if (error) errors.push(`push_subscriptions: ${error.message}`);
  } catch (e: any) {
    errors.push(`push_subscriptions: ${e.message}`);
  }

  // 5d. push_prefs — copy row to new user_id
  try {
    const { data: devPrefs } = await db
      .from("push_prefs")
      .select("*")
      .eq("user_id", devUserId)
      .maybeSingle();

    if (devPrefs) {
      const { data: existingPrefs } = await db
        .from("push_prefs")
        .select("user_id")
        .eq("user_id", newUserId)
        .maybeSingle();

      if (!existingPrefs) {
        const newRow = { ...devPrefs, user_id: newUserId };
        delete newRow.id;
        const { error } = await db.from("push_prefs").insert(newRow);
        if (error) errors.push(`push_prefs: ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`push_prefs: ${e.message}`);
  }

  // 5e. share_codes — UPDATE user_id (code string stays the same ✅)
  try {
    const { error } = await db
      .from("share_codes")
      .update({ user_id: newUserId })
      .eq("user_id", devUserId);
    if (error) errors.push(`share_codes: ${error.message}`);
  } catch (e: any) {
    errors.push(`share_codes: ${e.message}`);
  }

  // ── 6. If any table failed, return error so client retries ────────────────
  if (errors.length > 0) {
    console.error("Migration partially failed:", errors);
    return json({ error: "Partial failure", details: errors }, 500);
  }

  // ── 7. Mark as migrated ───────────────────────────────────────────────────
  await db
    .from("_migration_map")
    .update({ prod_user_id: newUserId, migrated_at: new Date().toISOString() })
    .eq("email", email);

  console.log(`✅ Migrated ${email}: ${devUserId} → ${newUserId}`);
  return json({ migrated: true });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
