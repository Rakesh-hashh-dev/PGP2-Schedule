/**
 * migrate-batch.mjs
 *
 * ADMIN-RUN, IDEMPOTENT batch that remaps all dev→prod Supabase data after the
 * Clerk cutover. Deterministic and browser-independent (does NOT depend on any
 * user having the app open). Complements the per-user `migrate-user` edge fn,
 * which stays as the on-login fallback for stragglers.
 *
 * What it does:
 *   1. Pages Clerk PROD /v1/users  → { email → prod_user_id }
 *   2. JOINs on email with _migration_map (email → dev_user_id) for unmigrated rows
 *   3. For each match, remaps every table dev→prod (same logic as the edge fn)
 *   4. FINAL PASS: rewrites cross-user friend/group cloudId references dev→prod
 *      using the FULL map, so friends resolve to each other's prod ids.
 *
 * Usage:
 *   node scripts/migrate-batch.mjs --dry-run     # report only, NO writes
 *   node scripts/migrate-batch.mjs               # execute
 *   node scripts/migrate-batch.mjs --skip-remap  # execute, skip step 4
 *
 * Required env vars:
 *   CLERK_PROD_SECRET_KEY   — Clerk PROD secret key (sk_live_...)
 *   SUPABASE_URL            — Supabase project URL
 *   SUPABASE_SERVICE_KEY    — Supabase service_role key
 *
 * Safety: run --dry-run first and review the tally. Take a DB snapshot before the
 * real run (UPDATE-based tables move rows). Re-running is safe (idempotent).
 */

import { createClient } from "@supabase/supabase-js";

// ── Config / flags ────────────────────────────────────────────────────────────
const DRY_RUN    = process.argv.includes("--dry-run");
const SKIP_REMAP = process.argv.includes("--skip-remap");

const CLERK_SECRET = process.env.CLERK_PROD_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!CLERK_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("\n❌  Missing env: CLERK_PROD_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY\n");
  process.exit(1);
}
if (CLERK_SECRET.startsWith("sk_test_")) {
  console.error("\n❌  CLERK_PROD_SECRET_KEY looks like a DEV key (sk_test_). Refusing to run.\n");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (...a) => console.log(...a);
const banner = DRY_RUN ? "🔍 DRY-RUN (no writes)" : "⚙️  LIVE RUN";

// ── Clerk prod users (paginated) ──────────────────────────────────────────────
async function fetchAllClerkUsers() {
  const users = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${CLERK_SECRET}` } }
    );
    if (!res.ok) throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
    const page = await res.json();
    if (!page.length) break;
    for (const u of page) {
      const email = (u.primary_email_address_id
        ? u.email_addresses?.find(e => e.id === u.primary_email_address_id)?.email_address
        : u.email_addresses?.[0]?.email_address);
      if (email) users.push({ id: u.id, email: email.toLowerCase().trim() });
    }
    if (page.length < limit) break;
    offset += limit;
  }
  return users;
}

// ── Remap helpers ─────────────────────────────────────────────────────────────
async function countRows(table, col, val) {
  const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq(col, val);
  return count || 0;
}

async function remap(table, col, dev, prod, tally) {
  const n = await countRows(table, col, dev);
  if (n === 0) return;
  tally[`${table}.${col}`] = (tally[`${table}.${col}`] || 0) + n;
  if (DRY_RUN) return;
  const { error } = await db.from(table).update({ [col]: prod }).eq(col, dev);
  if (error) throw new Error(`${table}.${col}: ${error.message}`);
}

// attendance — COLLISION-SAFE move (PK is user_id+session_key). If the user
// marked anything on prod during the login gap, those prod rows WIN; we bring
// over only dev sessions not already on prod, then drop the dev rows. Mirrors
// the migrate-user edge fn. A blind UPDATE would throw a PK conflict.
async function remapAttendanceSafe(dev, prod, tally) {
  const { data: devRows, error } = await db.from("attendance").select("session_key,status").eq("user_id", dev);
  if (error) throw new Error(`attendance(select): ${error.message}`);
  if (!devRows?.length) return;
  tally["attendance"] = (tally["attendance"] || 0) + devRows.length;
  if (DRY_RUN) return;
  const { error: insErr } = await db.from("attendance").upsert(
    devRows.map(r => ({ user_id: prod, session_key: r.session_key, status: r.status })),
    { onConflict: "user_id,session_key", ignoreDuplicates: true },   // prod marks win
  );
  if (insErr) throw new Error(`attendance(insert): ${insErr.message}`);
  const { error: delErr } = await db.from("attendance").delete().eq("user_id", dev);
  if (delErr) throw new Error(`attendance(delete): ${delErr.message}`);
}

// share_codes — the user's DEV code MUST persist (friends saved it; it's their
// sharing identity and can't change across cutover). If a code was auto-created
// on prod during the gap, discard it and carry the ORIGINAL dev code onto the
// prod id (string unchanged). PK `code`, UNIQUE user_id → clear prod slot first.
async function remapShareCodeSafe(dev, prod, tally) {
  const { data: devCode } = await db.from("share_codes").select("code").eq("user_id", dev).maybeSingle();
  if (!devCode) return;   // nothing to preserve; leave any prod code as-is
  tally["share_codes"] = (tally["share_codes"] || 0) + 1;
  if (DRY_RUN) return;
  // free the UNIQUE(user_id) slot (drops any prod-generated code)…
  const { error: delErr } = await db.from("share_codes").delete().eq("user_id", prod);
  if (delErr) throw new Error(`share_codes(clear prod): ${delErr.message}`);
  // …then carry the original dev code over, unchanged.
  const { error: mvErr } = await db.from("share_codes").update({ user_id: prod }).eq("user_id", dev);
  if (mvErr) throw new Error(`share_codes(move): ${mvErr.message}`);
}

const unionArr = (x = [], y = []) => [...new Set([...(x || []), ...(y || [])])];
function unionBy(a, b, keyOf) {
  const out = new Map();
  for (const x of a || []) out.set(keyOf(x), x);
  for (const x of b || []) out.set(keyOf(x), x);
  return [...out.values()];
}
function mergeCourses(dev = {}, prod = {}) {
  const m = { ...dev, ...prod };
  if (dev._readPingIds || prod._readPingIds)     m._readPingIds    = unionArr(dev._readPingIds, prod._readPingIds);
  if (dev._seenGroupIds || prod._seenGroupIds)   m._seenGroupIds   = unionArr(dev._seenGroupIds, prod._seenGroupIds);
  if (dev._readChangeKeys || prod._readChangeKeys) m._readChangeKeys = unionArr(dev._readChangeKeys, prod._readChangeKeys);
  if (dev._lastSeenNotif || prod._lastSeenNotif) m._lastSeenNotif  = Math.max(dev._lastSeenNotif || 0, prod._lastSeenNotif || 0);
  if (dev._assignments || prod._assignments)     m._assignments    = { ...(dev._assignments || {}), ...(prod._assignments || {}) };
  return m;
}

// ── Migrate one user ──────────────────────────────────────────────────────────
async function migrateUser(email, devId, prodId, tally) {
  // profiles — merge (never skip, never clobber)
  const [{ data: devP }, { data: prodP }] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", devId).maybeSingle(),
    db.from("profiles").select("*").eq("user_id", prodId).maybeSingle(),
  ]);
  if (devP) {
    tally["profiles"] = (tally["profiles"] || 0) + 1;
    if (!DRY_RUN) {
      if (!prodP) {
        const row = { ...devP, user_id: prodId, updated_at: new Date().toISOString() };
        delete row.id;
        const { error } = await db.from("profiles").insert(row);
        if (error) throw new Error(`profiles(insert): ${error.message}`);
      } else {
        const merged = {
          email: devP.email || prodP.email || email,
          courses: mergeCourses(devP.courses, prodP.courses),
          friends: unionBy(devP.friends, prodP.friends, f => f.cloudId || f.name),
          groups:  unionBy(devP.groups,  prodP.groups,  g => g.id),
          updated_at: new Date().toISOString(),
        };
        const { error } = await db.from("profiles").update(merged).eq("user_id", prodId);
        if (error) throw new Error(`profiles(merge): ${error.message}`);
      }
    }
  }

  await remapAttendanceSafe(devId, prodId, tally);
  await remap("push_subscriptions", "user_id",   devId, prodId, tally);
  await remapShareCodeSafe(devId, prodId, tally);
  await remap("friend_pings",       "from_id",   devId, prodId, tally);
  await remap("friend_pings",       "target_id", devId, prodId, tally);
  await remap("feedback",           "user_id",   devId, prodId, tally);
  await remap("admin_audit_logs",   "admin_id",  devId, prodId, tally);
  await remap("reminder_log",       "user_id",   devId, prodId, tally);

  // push_prefs — copy if prod has none
  const { data: devPrefs } = await db.from("push_prefs").select("*").eq("user_id", devId).maybeSingle();
  if (devPrefs) {
    const { data: existing } = await db.from("push_prefs").select("user_id").eq("user_id", prodId).maybeSingle();
    if (!existing) {
      tally["push_prefs"] = (tally["push_prefs"] || 0) + 1;
      if (!DRY_RUN) {
        const row = { ...devPrefs, user_id: prodId };
        delete row.id;
        const { error } = await db.from("push_prefs").insert(row);
        if (error) throw new Error(`push_prefs: ${error.message}`);
      }
    }
  }

  // Mark migrated
  if (!DRY_RUN) {
    await db.from("_migration_map")
      .update({ prod_user_id: prodId, migrated_at: new Date().toISOString(), status: "done" })
      .eq("email", email);
  }
}

// ── Final pass: rewrite cross-user friend/group cloudId refs dev→prod ─────────
async function remapCrossUserRefs(dict, tally) {
  // dict: dev_id → prod_id for EVERY user with a known prod id.
  const { data: profiles, error } = await db.from("profiles").select("user_id, friends, groups");
  if (error) throw new Error(`refs select: ${error.message}`);

  for (const p of profiles || []) {
    let changed = false;

    const friends = (p.friends || []).map(f => {
      if (f.cloudId && dict[f.cloudId]) { changed = true; return { ...f, cloudId: dict[f.cloudId] }; }
      return f;
    });

    const groups = (p.groups || []).map(g => {
      let g2 = g;
      if (Array.isArray(g.cloudMemberIds)) {
        const ids = g.cloudMemberIds.map(id => dict[id] || id);
        if (ids.some((id, i) => id !== g.cloudMemberIds[i])) { g2 = { ...g2, cloudMemberIds: ids }; changed = true; }
      }
      if (Array.isArray(g.members)) {
        const members = g.members.map(m => (m.cloudId && dict[m.cloudId]) ? { ...m, cloudId: dict[m.cloudId] } : m);
        if (members.some((m, i) => m !== g.members[i])) { g2 = { ...g2, members }; changed = true; }
      }
      return g2;
    });

    if (changed) {
      tally["refs.profiles"] = (tally["refs.profiles"] || 0) + 1;
      if (!DRY_RUN) {
        const { error: uErr } = await db.from("profiles").update({ friends, groups }).eq("user_id", p.user_id);
        if (uErr) throw new Error(`refs update ${p.user_id}: ${uErr.message}`);
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  log(`\n${banner}\n`);

  log("📥  Fetching Clerk PROD users…");
  const prodUsers = await fetchAllClerkUsers();
  const emailToProd = new Map(prodUsers.map(u => [u.email, u.id]));
  log(`   ${prodUsers.length} prod users.\n`);

  const { data: mapRows, error: mapErr } = await db
    .from("_migration_map")
    .select("email, dev_user_id, prod_user_id, migrated_at")
    .is("migrated_at", null);
  if (mapErr) { console.error("❌  map load failed:", mapErr.message); process.exit(1); }
  log(`📋  ${mapRows.length} unmigrated map rows.\n`);

  const tally = {};
  let migrated = 0, skippedNoProd = 0, failed = 0;

  for (const row of mapRows) {
    const prodId = emailToProd.get(row.email);
    if (!prodId) { skippedNoProd++; continue; }      // hasn't logged into prod yet
    try {
      await migrateUser(row.email, row.dev_user_id, prodId, tally);
      migrated++;
      process.stdout.write(".");
    } catch (e) {
      failed++;
      log(`\n   ⚠️  ${row.email}: ${e.message}`);
    }
  }
  log("\n");

  // Final cross-user reference pass (uses the FULL map, not just this batch).
  if (!SKIP_REMAP) {
    const { data: allMapped } = await db
      .from("_migration_map")
      .select("dev_user_id, prod_user_id")
      .not("prod_user_id", "is", null);
    const dict = Object.fromEntries((allMapped || []).map(r => [r.dev_user_id, r.prod_user_id]));
    // include this batch's just-computed mappings in dry-run (not yet persisted)
    if (DRY_RUN) {
      for (const row of mapRows) {
        const prodId = emailToProd.get(row.email);
        if (prodId) dict[row.dev_user_id] = prodId;
      }
    }
    log(`🔗  Cross-user ref remap over ${Object.keys(dict).length} known ids…`);
    await remapCrossUserRefs(dict, tally);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  log("\n──────── SUMMARY ────────");
  log(`${banner}`);
  log(`users migrated:        ${migrated}`);
  log(`skipped (no prod id):  ${skippedNoProd}   ← haven't logged into prod yet`);
  log(`failed:                ${failed}`);
  log("rows affected by table:");
  for (const [k, v] of Object.entries(tally).sort()) log(`   ${k.padEnd(24)} ${v}`);
  log("─────────────────────────\n");
  if (DRY_RUN) log("Dry-run only — nothing was written. Re-run without --dry-run to execute.\n");
})().catch(e => { console.error("\n❌  Fatal:", e.message); process.exit(1); });
