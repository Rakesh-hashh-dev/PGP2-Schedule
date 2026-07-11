/**
 * migrationMap — client helper for the dev→prod migration bridge.
 *
 * While the app runs on the DEV Clerk instance, we record every logged-in
 * user's { email → dev_user_id } into `_migration_map` so that at cutover no
 * user is orphaned. This is a fire-and-forget background write: it never
 * blocks the UI and silently no-ops on failure.
 *
 * It only runs on the dev instance (pk_test_…). On prod there is nothing to
 * record here — the migrate-user function handles the remap instead.
 */

const PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const IS_DEV_INSTANCE = PK.startsWith("pk_test_");

// Avoid re-hitting the endpoint every render/tab-focus within a session.
let syncedThisSession = null; // holds the userId we've already synced

export async function syncMigrationMap(devUserId, email) {
  if (!IS_DEV_INSTANCE) return;                 // prod: not our job
  if (!devUserId || !email) return;
  if (syncedThisSession === devUserId) return;  // already done this session
  syncedThisSession = devUserId;

  try {
    const token = window.Clerk?.session ? await window.Clerk.session.getToken() : null;
    if (!token) return;                         // no session → skip silently
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-map`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), dev_user_id: devUserId }),
      keepalive: true,
    });
  } catch {
    // Background best-effort only — never surface to the user, retries next login.
    syncedThisSession = null;
  }
}
