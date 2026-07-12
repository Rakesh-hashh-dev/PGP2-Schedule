# PGP2 Data Migration: Dev → Prod (Corrected Plan v2)

> Rewritten 2026-07-09 after a first attempt exposed several failures. This version
> fixes the root causes, replaces the fragile per-user client migration with a
> deterministic server-side batch, and adds hard verification at every step.

---

## Current State (what is already true)

| Item | State |
|---|---|
| Clerk prod instance + custom domain (`clerk.pgp2.termflow.tech`) | ✅ Live, SSL issued |
| `VITE_CLERK_PUBLISHABLE_KEY` in Vercel | `pk_live_...` (prod) |
| `_migration_map` table | ✅ Exists, **populated with 98 dev users** (export script was run) |
| `migrate-user` edge function | ✅ Deployed |
| Supabase → Third-Party Auth → Clerk domain | ✅ Now `https://clerk.pgp2.termflow.tech` |
| App.jsx migration hook | ✅ Fixed to not lock out retry on `new_user`, pushed |
| **Data actually visible to users after login** | ❌ **BLOCKED** — see root cause below |

The dev→prod data copy itself **works** — verified directly with the service-role key:
Rakesh's prod row (`user_3GGaSTk1YSAPMIuVPc3pc0gniSa`) has all 5 friends, both groups,
assignments, and 85 attendance rows. The problem is **not** the migration copy. The
problem is users cannot *read* their migrated data.

---

## THE REAL BLOCKER (fix this first — nothing else matters until it's done)

### Symptom
After signing into the prod instance, the app shows empty everything (0% attendance,
0 assignments, no friends) even though the data exists. Network tab shows:

```
GET /rest/v1/attendance?select=...   → 200 OK   → []   (NO Authorization header sent)
```

### Root cause
`200 OK` + `[]` + **no `Authorization` header** = the request went to Supabase
**anonymously**. With RLS enabled (`auth.jwt()->>'sub' = user_id`), an anonymous request
matches zero rows, so PostgREST returns an empty array (not an error).

The Supabase client is configured to attach the Clerk token per request:

```js
// src/lib/supabase.js
createClient(URL, ANON_KEY, {
  accessToken: async () => (window.Clerk?.session ? window.Clerk.session.getToken() : null)
});
```

No header means `window.Clerk.session.getToken()` returned **null/undefined** on the prod
instance. This worked on dev, so the difference is the prod Clerk instance is not minting
a Supabase-valid token. Two candidate causes, disambiguated by one diagnostic:

### Step 0 — Diagnose (do this in the browser console on prod, signed in)

```js
const t = await window.Clerk.session.getToken();
console.log("token:", t);
if (t) console.log("claims:", JSON.parse(atob(t.split('.')[1])));
```

- **If `t` is null** → Clerk prod is not issuing a token → **Cause A**.
- **If `t` exists** but `claims.iss` ≠ `https://clerk.pgp2.termflow.tech`, or there is no
  `role: "authenticated"` claim → **Cause B** (token minted but Supabase rejects/ignores it).

### Fix — Cause A (most likely): enable the Supabase integration on Clerk **prod**
The Clerk→Supabase native integration is per-instance and does **not** copy from dev.
1. Clerk Dashboard → switch to the **Production** instance → **Integrations** (or
   "Connect with Supabase" / Configure → Supabase).
2. Enable it and complete the connect flow for the prod instance.
3. Re-run Step 0 — confirm `getToken()` now returns a JWT.

### Fix — Cause B: claims/issuer mismatch
- Confirm Supabase → Third-Party Auth → Clerk domain is exactly
  `https://clerk.pgp2.termflow.tech` (already set ✅).
- Ensure the Clerk token includes `role: "authenticated"` (the Supabase integration adds
  this; if you use a manual JWT template it must set that claim).

### Exit criteria for the blocker
In the Network tab, the `attendance`/`profiles` requests now carry
`Authorization: Bearer eyJ…` **and** return non-empty data. Only then proceed.

---

## Migration approach change: batch server-side, not per-user client

The v1 design migrated each user from their browser on first login. That path already
failed three separate ways (empty `_migration_map`, a localStorage "done" flag that
permanently blocked retry, and the auth-token issue above). It depends on every user's
browser, token, and localStorage all being correct.

**v2 uses a single admin-run batch script** that is deterministic, idempotent, and
verifiable, and does not depend on any user's browser:

```
Clerk PROD Backend API  ──→  { email → prod_user_id }   (all 98 users)
        │
        └── JOIN on email with _migration_map  ( email → dev_user_id )
                    │
                    └── for each matched email, service_role remaps every table:
                            dev_user_id → prod_user_id
                    └── mark _migration_map row migrated
```

This runs once, after cutover, once enough users have logged into prod at least once
(so their prod user_id exists in Clerk). Users who log in later are still covered by the
existing client hook as a fallback (now that it's fixed) — or by re-running the batch.

---

## Proposed Changes

### [NEW] `scripts/migrate-batch.mjs` (admin-run, idempotent)
Env: `CLERK_PROD_SECRET_KEY` (sk_live_…), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

Steps:
1. Page through Clerk **prod** `/v1/users` → build `email → prod_user_id`.
2. `select email, dev_user_id from _migration_map where migrated_at is null`.
3. For each email present in both:
   - `profiles`: SELECT dev row → UPSERT with `user_id = prod_user_id`
     (skip/merge if a prod row already exists so we never clobber newer prod data).
   - `attendance`: `update user_id = prod where user_id = dev` (idempotent).
   - `push_subscriptions`: same UPDATE.
   - `push_prefs`: SELECT dev → INSERT as prod if absent.
   - `share_codes`: `update user_id = prod where user_id = dev` (code string unchanged).
   - `friend_pings`: **(new — was missing in v1)** remap `from_id` and `target_id`
     dev→prod so ping/nudge history survives.
   - Set `_migration_map.prod_user_id`, `migrated_at = now()`.
4. Print a per-user, per-table summary (rows moved) and a final tally.

Idempotency: re-running is safe — already-migrated rows have `migrated_at` set and are
skipped; UPDATEs on already-remapped rows match nothing.

### [MODIFY] `supabase/functions/migrate-user/index.ts`
- Add the `friend_pings` remap (parity with the batch script).
- Otherwise keep as the per-user fallback for stragglers.

### [KEEP] `src/App.jsx` migration hook
Already fixed (only persists the done-flag on a confirmed `migrated`/`already_done`,
retries on `new_user`). No further change needed.

### One-time cleanup for users who already logged into prod during the broken window
Their browsers may hold a stale `pgp2.migration-v1` flag and a locally-generated share
code. After the auth blocker is fixed, they self-heal on next load, but to be safe:
- Console one-liner for affected users: `localStorage.removeItem('pgp2.migration-v1')` then reload.
- Verify no duplicate `share_codes` rows were persisted (checked for Rakesh — only the
  original `RAK-3AFN` exists; the `RAK-4LF1` seen in the UI was an un-persisted client
  placeholder created while RLS was failing).

---

## Affected Supabase Tables (reference)

| Table | Key | Action | v1 covered? |
|---|---|---|---|
| `profiles` | `user_id` PK | copy dev row → prod (no clobber) | ✅ |
| `attendance` | `user_id`+`session_key` | UPDATE user_id | ✅ |
| `push_subscriptions` | `endpoint` PK, `user_id` | UPDATE user_id | ✅ |
| `push_prefs` | `user_id` PK | copy row | ✅ |
| `share_codes` | `user_id` | UPDATE user_id | ✅ |
| `friend_pings` | `from_id`,`target_id` | UPDATE both | ❌ **added in v2** |

> Friends/groups lists live inside `profiles.friends` / `profiles.groups` (JSONB) and in
> localStorage; they ride along with the `profiles` copy. Friend *connections* reference
> each other by `cloudId` = Clerk user_id — see the caveat below.

---

## Known caveat: cross-user friend `cloudId` references
Each friend entry stores the friend's **dev** `cloudId` (e.g. Sneha =
`user_3FIJEEkZ…`). After migration your *own* id changes to prod, but your stored friends
still point at your friends' **dev** ids. Real-time features (pings, live removal) match
on cloudId, so until *both* people are migrated and their stored references updated, live
sync between two friends may not fire. Schedule comparison (which uses the embedded
`courses`) still works. Options:
- **Accept** (simplest): comparisons work now; live ping/removal re-heals as people
  re-add or as pings re-establish ids.
- **Remap references** (optional follow-up): a second pass that rewrites every
  `friends[].cloudId` and `groups[].cloudMemberIds` dev→prod using `_migration_map`.
  Recommend only if live friend features prove broken after cutover.

---

## Execution Order

```
[ ] 0. FIX THE AUTH BLOCKER (Clerk prod → Supabase token). Verify Authorization header
       appears and a query returns non-empty data. NOTHING ELSE UNTIL THIS PASSES.
[ ] 1. Add friend_pings remap to migrate-user edge fn; redeploy.
[ ] 2. Write scripts/migrate-batch.mjs.
[ ] 3. Dry-run migrate-batch.mjs in report-only mode (no writes) → review tally.
[ ] 4. Run migrate-batch.mjs for real. Review per-table summary.
[ ] 5. Verify (queries below) for 3–5 sample users incl. Rakesh.
[ ] 6. Tell users who logged in during the broken window to clear pgp2.migration-v1.
[ ] 7. (Optional) friend cloudId remap pass if live friend features are broken.
[ ] 8. (2–4 weeks later) remove client hook + batch script, drop _migration_map.
```

---

## Verification queries (service_role)

```sql
-- unmigrated remaining
select count(*) from _migration_map where migrated_at is null;

-- per-user spot check (replace prod id)
select 'profiles' t, count(*) from profiles     where user_id = :prod
union all select 'attendance', count(*) from attendance where user_id = :prod
union all select 'share_codes', count(*) from share_codes where user_id = :prod;

-- no orphaned dev rows left behind (replace dev id)
select 'attendance' t, count(*) from attendance where user_id = :dev;
```

---

## Rollback / safety
- The batch only ever writes to prod ids or flips `migrated_at`; dev rows for UPDATE-based
  tables move (not copy), copy-based tables leave the dev row intact. Keep the dev Clerk
  instance and dev rows untouched until verified, so a re-run is always possible.
- Reverting to dev Clerk (temporary) only needs `VITE_CLERK_PUBLISHABLE_KEY` set back to
  the dev `pk_test_…` in Vercel + redeploy; leave Supabase/`_migration_map` as-is.
```
```

## What users experience (after v2)
- Sign in with Google → data present immediately (already migrated server-side).
- Push notifications need re-enabling (browser permission is per-origin/instance).
- Friend schedule comparison works; live ping/removal may lag until both parties migrate.
