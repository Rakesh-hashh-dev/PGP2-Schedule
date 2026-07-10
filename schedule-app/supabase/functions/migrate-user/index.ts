/**
 * migrate-user — Supabase Edge Function
 *
 * Called by the TermFlow app on a user's first prod login.
 * Remaps all Supabase data from their old dev user_id to their new prod user_id.
 *
 * SECURITY: deployed with --no-verify-jwt (the Supabase gateway can't validate
 * Clerk tokens), so this function does its OWN cryptographic verification. The
 * caller's identity — prod user id (`sub`) and `email` — is taken ONLY from the
 * verified Clerk JWT, NEVER from the request body. This prevents anyone from
 * moving another user's data by POSTing an arbitrary email/new_user_id.
 *
 * Requires the Clerk PROD session token to carry an `email` claim
 * (Clerk Dashboard → Sessions → customize session token: email = {{user.primary_email_address}}).
 * Only the prod issuer is trusted → this is inert on the dev instance.
 *
 * Responses:
 *   { migrated: true }                         — data found and migrated
 *   { migrated: false, reason: "new_user" }    — no dev data
 *   { migrated: false, reason: "already_done" }— already migrated (idempotent)
 *   { migrated: false, reason: "in_progress" } — another device is migrating; retry later
 *   { error: string }                          — failure (caller should retry)
 *
 * Concurrency: uses a `status` claim on _migration_map so two devices logging in
 * at once can't double-run. The claim is released on failure so a retry re-claims.
 *
 * Note on cross-user friend refs: this remaps the user's OWN ids. Friend entries
 * still point at friends' *dev* cloudIds until the batch script's final pass
 * (migrate-batch.mjs) rewrites them once everyone has a prod id.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Only the PROD Clerk instance is trusted. (Dev tokens have a different issuer,
// so this function is a no-op on dev — which is what we want.)
const PROD_ISSUER = "https://clerk.pgp2.termflow.tech";
const JWKS = createRemoteJWKSet(new URL(`${PROD_ISSUER}/.well-known/jwks.json`));

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── 1. Verify the Clerk JWT and derive identity from it (NOT the body) ────
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  let email: string, newUserId: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: PROD_ISSUER });
    newUserId = String(payload.sub || "").trim();
    email     = String((payload as any).email || "").toLowerCase().trim();
  } catch (_e) {
    return json({ error: "Invalid or untrusted token" }, 401);
  }
  if (!newUserId) {
    return json({ error: "Token missing sub" }, 401);
  }
  if (!email) {
    // The session token has no email claim — add it in the Clerk dashboard.
    return json({ error: "Token missing email claim" }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

  // ── 3. Atomically CLAIM this user (status: null → in_progress) ────────────
  // Only claims a row that exists, is unmigrated, and is unclaimed. This is the
  // concurrency guard: a second concurrent call gets 0 rows back.
  const { data: claimed, error: claimErr } = await db
    .from("_migration_map")
    .update({ status: "in_progress" })
    .eq("email", email)
    .is("migrated_at", null)
    .is("status", null)
    .select("dev_user_id")
    .maybeSingle();

  if (claimErr) {
    console.error("Claim failed:", claimErr);
    return json({ error: "DB claim failed" }, 500);
  }

  // Didn't claim → figure out why (new user / already done / someone else running).
  if (!claimed) {
    const { data: row } = await db
      .from("_migration_map")
      .select("migrated_at, status")
      .eq("email", email)
      .maybeSingle();

    if (!row)                return json({ migrated: false, reason: "new_user" });
    if (row.migrated_at)     return json({ migrated: false, reason: "already_done" });
    return json({ migrated: false, reason: "in_progress" }); // status = in_progress elsewhere
  }

  const devUserId = claimed.dev_user_id;
  const errors: string[] = [];

  // ── 4. Migrate all tables ─────────────────────────────────────────────────

  // 4a. profiles — MERGE dev row into prod (never skip → never lose dev data,
  //     never clobber data the user just created on prod).
  try {
    const [{ data: devProfile }, { data: prodProfile }] = await Promise.all([
      db.from("profiles").select("*").eq("user_id", devUserId).maybeSingle(),
      db.from("profiles").select("*").eq("user_id", newUserId).maybeSingle(),
    ]);

    if (devProfile) {
      if (!prodProfile) {
        // No prod row yet → straight copy under the new id.
        const row = { ...devProfile, user_id: newUserId, updated_at: new Date().toISOString() };
        delete (row as any).id;
        const { error } = await db.from("profiles").insert(row);
        if (error) errors.push(`profiles(insert): ${error.message}`);
      } else {
        // Both exist (prod auto-created from localStorage) → merge field by field.
        const merged = {
          user_id: newUserId,
          email: devProfile.email || prodProfile.email || email,
          courses: mergeCourses(devProfile.courses, prodProfile.courses),
          friends: unionBy(devProfile.friends, prodProfile.friends, (f: any) => f.cloudId || f.name),
          groups:  unionBy(devProfile.groups,  prodProfile.groups,  (g: any) => g.id),
          updated_at: new Date().toISOString(),
        };
        const { error } = await db.from("profiles")
          .update(merged).eq("user_id", newUserId);
        if (error) errors.push(`profiles(merge): ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`profiles: ${e.message}`);
  }

  // 4b. attendance — COLLISION-SAFE move (PK is user_id+session_key).
  // If the user marked anything on prod during the brief window before this
  // ran, those prod rows WIN (a fresh mark is their latest intent). We copy
  // over only the dev sessions not already on prod, then drop the dev rows.
  // A blind UPDATE would throw a PK conflict on any session marked both places.
  try {
    const { data: devRows, error: selErr } = await db
      .from("attendance").select("session_key,status").eq("user_id", devUserId);
    if (selErr) throw selErr;
    if (devRows && devRows.length) {
      const { error: insErr } = await db.from("attendance").upsert(
        devRows.map((r: any) => ({ user_id: newUserId, session_key: r.session_key, status: r.status })),
        { onConflict: "user_id,session_key", ignoreDuplicates: true },   // prod marks win
      );
      if (insErr) throw insErr;
      const { error: delErr } = await db.from("attendance").delete().eq("user_id", devUserId);
      if (delErr) throw delErr;
    }
  } catch (e: any) {
    errors.push(`attendance: ${e.message}`);
  }

  // 4c. push_subscriptions — UPDATE user_id
  await remapUserId(db, "push_subscriptions", devUserId, newUserId, errors);

  // 4d. push_prefs — copy row if prod has none
  try {
    const { data: devPrefs } = await db
      .from("push_prefs").select("*").eq("user_id", devUserId).maybeSingle();
    if (devPrefs) {
      const { data: existingPrefs } = await db
        .from("push_prefs").select("user_id").eq("user_id", newUserId).maybeSingle();
      if (!existingPrefs) {
        const row = { ...devPrefs, user_id: newUserId };
        delete (row as any).id;
        const { error } = await db.from("push_prefs").insert(row);
        if (error) errors.push(`push_prefs: ${error.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`push_prefs: ${e.message}`);
  }

  // 4e. share_codes — the user's DEV code MUST persist: friends have it saved,
  // it's their sharing identity, so it can NOT change across the cutover. If a
  // code was auto-created on prod during the gap, discard it and carry the
  // ORIGINAL dev code onto the prod id (the code string is unchanged; only
  // user_id flips). PK is `code`, UNIQUE is user_id — so the prod-side row must
  // be cleared before the dev code can take the slot.
  try {
    const { data: devCode } = await db
      .from("share_codes").select("code").eq("user_id", devUserId).maybeSingle();
    if (devCode) {
      // free the UNIQUE(user_id) slot (drops any prod-generated code)…
      const { error: delErr } = await db.from("share_codes").delete().eq("user_id", newUserId);
      if (delErr) errors.push(`share_codes(clear prod): ${delErr.message}`);
      // …then carry the original dev code over, unchanged.
      const { error: mvErr } = await db.from("share_codes").update({ user_id: newUserId }).eq("user_id", devUserId);
      if (mvErr) errors.push(`share_codes(move): ${mvErr.message}`);
    }
    // no dev code → nothing to preserve; leave any prod code as-is
  } catch (e: any) {
    errors.push(`share_codes: ${e.message}`);
  }

  // 4f. friend_pings — remap BOTH from_id and target_id so ping history survives
  await remapColumn(db, "friend_pings", "from_id",   devUserId, newUserId, errors);
  await remapColumn(db, "friend_pings", "target_id", devUserId, newUserId, errors);

  // 4g. feedback — UPDATE user_id (keeps a user's submitted feedback linked)
  await remapUserId(db, "feedback", devUserId, newUserId, errors);

  // 4h. admin_audit_logs — UPDATE admin_id (same person, new id → audit stays attributed)
  await remapColumn(db, "admin_audit_logs", "admin_id", devUserId, newUserId, errors);

  // 4i. reminder_log — UPDATE user_id (keeps push dedup history → no duplicate reminders)
  await remapUserId(db, "reminder_log", devUserId, newUserId, errors);

  // ── 5. On any failure, RELEASE the claim so a retry can re-run ─────────────
  if (errors.length > 0) {
    console.error("Migration partially failed, releasing claim:", errors);
    await db.from("_migration_map")
      .update({ status: null })          // back to unclaimed
      .eq("email", email);
    return json({ error: "Partial failure", details: errors }, 500);
  }

  // ── 6. Mark migrated (and record prod id) ─────────────────────────────────
  await db.from("_migration_map")
    .update({ prod_user_id: newUserId, migrated_at: new Date().toISOString(), status: "done" })
    .eq("email", email);

  console.log(`✅ Migrated ${email}: ${devUserId} → ${newUserId}`);
  return json({ migrated: true });
});

// ── helpers ─────────────────────────────────────────────────────────────────

async function remapUserId(db: any, table: string, dev: string, prod: string, errors: string[]) {
  try {
    const { error } = await db.from(table).update({ user_id: prod }).eq("user_id", dev);
    if (error) errors.push(`${table}: ${error.message}`);
  } catch (e: any) {
    errors.push(`${table}: ${e.message}`);
  }
}

async function remapColumn(db: any, table: string, col: string, dev: string, prod: string, errors: string[]) {
  try {
    const { error } = await db.from(table).update({ [col]: prod }).eq(col, dev);
    if (error) errors.push(`${table}.${col}: ${error.message}`);
  } catch (e: any) {
    errors.push(`${table}.${col}: ${e.message}`);
  }
}

// Union two arrays of objects by a stable key; later (prod) wins on conflict.
function unionBy(a: any[] | null, b: any[] | null, keyOf: (x: any) => any): any[] {
  const out = new Map<any, any>();
  for (const x of a || []) out.set(keyOf(x), x);
  for (const x of b || []) out.set(keyOf(x), x);   // prod overrides dev on same key
  return [...out.values()];
}

// Merge the `courses` JSONB: prefer prod for plain course keys, but never lose
// dev read-state — union the `_`-prefixed id arrays and merge assignments.
function mergeCourses(dev: any, prod: any): any {
  dev = dev || {};
  prod = prod || {};
  const merged: any = { ...dev, ...prod }; // prod wins on plain course keys

  const unionArr = (x: any[] = [], y: any[] = []) => [...new Set([...(x || []), ...(y || [])])];
  if (dev._readPingIds || prod._readPingIds)   merged._readPingIds   = unionArr(dev._readPingIds, prod._readPingIds);
  if (dev._seenGroupIds || prod._seenGroupIds) merged._seenGroupIds  = unionArr(dev._seenGroupIds, prod._seenGroupIds);
  if (dev._readChangeKeys || prod._readChangeKeys) merged._readChangeKeys = unionArr(dev._readChangeKeys, prod._readChangeKeys);
  if (dev._lastSeenNotif || prod._lastSeenNotif) merged._lastSeenNotif = Math.max(dev._lastSeenNotif || 0, prod._lastSeenNotif || 0);
  if (dev._assignments || prod._assignments)   merged._assignments   = { ...(dev._assignments || {}), ...(prod._assignments || {}) };
  return merged;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
