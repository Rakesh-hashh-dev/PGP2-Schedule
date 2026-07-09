/**
 * export-dev-users.mjs
 *
 * ONE-TIME SCRIPT — Run BEFORE switching Clerk to production.
 *
 * What it does:
 *   1. Fetches all users from your Clerk DEV instance (via Backend API)
 *   2. Inserts email → dev_user_id rows into Supabase `_migration_map`
 *
 * Usage:
 *   node scripts/export-dev-users.mjs
 *
 * Required env vars (set in .env.migration or pass inline):
 *   CLERK_DEV_SECRET_KEY   — Your Clerk DEV secret key (sk_test_...)
 *   SUPABASE_URL           — Your Supabase project URL
 *   SUPABASE_SERVICE_KEY   — Your Supabase service_role key (NOT the anon key)
 *
 * ⚠️  IMPORTANT: Run this again on the actual day of the switch to capture
 *    any users who signed up between your first run and the cutover.
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────
const CLERK_SECRET   = process.env.CLERK_DEV_SECRET_KEY;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;

if (!CLERK_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "\n❌  Missing env vars. Set:\n" +
    "   CLERK_DEV_SECRET_KEY\n" +
    "   SUPABASE_URL\n" +
    "   SUPABASE_SERVICE_KEY\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Fetch all Clerk dev users (paginated) ────────────────────────────────────
async function fetchAllClerkUsers() {
  const users = [];
  let offset  = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${CLERK_SECRET}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Clerk API error ${res.status}: ${text}`);
    }

    const page = await res.json();
    if (!page.length) break;

    for (const u of page) {
      const email = u.email_addresses?.[0]?.email_address;
      if (email) users.push({ id: u.id, email });
    }

    if (page.length < limit) break;
    offset += limit;
  }

  return users;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log("\n📥  Fetching users from Clerk dev instance…");
  let clerkUsers;
  try {
    clerkUsers = await fetchAllClerkUsers();
  } catch (err) {
    console.error("❌  Failed to fetch Clerk users:", err.message);
    process.exit(1);
  }
  console.log(`✅  Found ${clerkUsers.length} users in Clerk dev.\n`);

  if (!clerkUsers.length) {
    console.log("Nothing to insert. Exiting.");
    process.exit(0);
  }

  // Build rows for Supabase
  const rows = clerkUsers.map(u => ({
    email:       u.email.toLowerCase(),
    dev_user_id: u.id,
  }));

  console.log("📤  Inserting into Supabase _migration_map…");

  // Upsert in batches of 100 (Supabase row limit per request)
  const BATCH = 100;
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("_migration_map")
      .upsert(batch, {
        onConflict:      "email",
        ignoreDuplicates: false,   // overwrite dev_user_id if email already exists
        count:           "exact",
      });

    if (error) {
      console.error(`❌  Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`   Batch ${Math.floor(i / BATCH) + 1}: ${batch.length} rows upserted.`);
  }

  console.log(`\n✅  Done! ${inserted} rows written to _migration_map.`);
  console.log("   Rows with migrated_at = NULL are ready for prod migration.\n");
  console.log("⚠️   Remember: re-run this script on the DAY of the switch to");
  console.log("    capture any late sign-ups before the cutover.\n");
})();
