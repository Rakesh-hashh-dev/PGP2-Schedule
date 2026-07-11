/**
 * useMigration — client hook that runs the one-time dev→prod data restore.
 *
 * Guarded to the PROD Clerk instance (pk_live_…): on dev it's a no-op, so it can
 * ship now and arms itself automatically at cutover. On first prod login it calls
 * the migrate-user edge function (which remaps the user's dev data to their new
 * prod id) and drives the MigrationBanner UI. On success it soft-reloads once so
 * the just-restored data is actually visible (the app had already fetched the
 * empty prod state before the migrate finished).
 *
 * Returns: null | "restoring" | "done" | "failed"  (feed straight to MigrationBanner)
 *
 * Lesson baked in (from the first migration attempt): NEVER persist the done-flag
 * on a `new_user` result. Only migrated / already_done are terminal. That way a
 * user who somehow logs in before their map row exists still retries next time.
 */

import { useEffect, useRef, useState } from "react";

const PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const IS_PROD_INSTANCE = PK.startsWith("pk_live_");
const DONE_KEY = "pgp2.migration-v1";
const MAX_ATTEMPTS = 3;

export function useMigration({ isSignedIn, userId, email }) {
  const [state, setState] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!IS_PROD_INSTANCE) return;                         // dev: nothing to do
    if (!isSignedIn || !userId || !email) return;
    if (ran.current) return;
    if (localStorage.getItem(DONE_KEY) === "done") return; // already restored
    ran.current = true;

    let cancelled = false;
    (async () => {
      setState("restoring");
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const token = window.Clerk?.session ? await window.Clerk.session.getToken() : null;
          if (!token) throw new Error("no token");

          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-user`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ email: email.toLowerCase().trim(), new_user_id: userId }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;

          // Data was found and migrated
          if (res.ok && data.migrated === true) {
            localStorage.setItem(DONE_KEY, "done");
            setState("done");
            // The app fetched this user's (still empty) prod data BEFORE the
            // migrate completed, so the screen behind the toast is blank. Show
            // the "Data restored!" confirmation briefly, then soft-reload so the
            // now-populated data actually appears — otherwise the user sees
            // "restored" over an empty screen and has to refresh by hand.
            // DONE_KEY is already set, so after reload this hook is a no-op:
            // no banner, no re-migrate, no reload loop.
            setTimeout(() => { if (!cancelled) window.location.reload(); }, 1600);
            return;
          }

          // Terminal "nothing to do" outcomes
          if (res.ok && data.migrated === false) {
            if (data.reason === "already_done") {
              localStorage.setItem(DONE_KEY, "done");   // terminal
            }
            // new_user → do NOT persist (retry next login is cheap + idempotent)
            // in_progress → another device is handling it; just dismiss
            setState(null);
            return;
          }

          throw new Error(data.error || `HTTP ${res.status}`); // → retry
        } catch (e) {
          if (cancelled) return;
          if (attempt === MAX_ATTEMPTS) {
            setState("failed");     // flag NOT set → retries next login
            return;
          }
          await new Promise((r) => setTimeout(r, 800 * attempt)); // backoff
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isSignedIn, userId, email]);

  return state;
}
