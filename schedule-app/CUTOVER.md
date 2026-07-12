# PGP2 / TermFlow — Dev → Prod Clerk Cutover Runbook

Single source of truth for migrating from the Clerk **dev** instance (`pk_test_…`)
to **prod** (`pk_live_…`) with **zero perceived change** for end users.

- Supabase project ref: `fzhfbttlbfpnwhempyav`
- Prod Clerk domain: `clerk.pgp2.termflow.tech`
- Data bridge: `_migration_map` (email → dev_user_id → prod_user_id), joined on **email**
- Guiding rule: nothing user-visible changes until the very last step (the key swap).

> **The golden rule:** the whole design hinges on `email` being a complete, stable
> join key. The app locks to `@iimsambalpur.ac.in`, so emails are stable. Keep
> `_migration_map` complete (it self-maintains via `sync-map`) and everything else
> is deterministic.

### Tables remapped (verified against a full schema dump, 2026-07-10)
Every user-scoped table the app uses is covered by both `migrate-user` and `migrate-batch.mjs`.
Confirmed against a real `supabase db dump` (all 13 public tables), not PostgREST probes:

| Table | Key(s) remapped | Action |
|---|---|---|
| `profiles` | `user_id` | merge (never skip/clobber) |
| `attendance` | `user_id` | UPDATE |
| `push_subscriptions` | `user_id` | UPDATE |
| `push_prefs` | `user_id` | copy if absent |
| `share_codes` | `user_id` | move DEV code (dev code always wins — friends saved it; after profiles, see FK note) |
| `friend_pings` | `from_id`, `target_id` | UPDATE |
| `feedback` | `user_id` | UPDATE |
| `admin_audit_logs` | `admin_id` | UPDATE |
| `reminder_log` | `user_id` | UPDATE |
| `system_config` | — (global) | not migrated (correct) |
| `schedule_cache` | — (global) | not migrated (correct) |
| `daily_stats` | — (global aggregate, no `user_id`) | not migrated (correct) |

> **FK ordering (verified against the live schema 2026-07-10):** `share_codes.user_id`
> has a FK → `profiles(user_id)` plus `UNIQUE(user_id)`. Both `migrate-user` and
> `migrate-batch` remap `profiles` **before** `share_codes`, so the referenced prod
> row always exists first. Do not reorder those steps.

---

## Phase 0 — Prepare now (safe, invisible, while still on dev)

Everything here ships to the live dev app but is a no-op or a background write.

### Supabase
- [x] **Prep SQL applied** — via `supabase db push` (migration `20260709120000_prep_migration_bridge.sql`).
      `profiles.email`, `_migration_map.status`, `idx_profiles_email` are live.
- [x] **`sync-map` deployed with `--no-verify-jwt`** — the Edge Function gateway's JWT
      verification rejects Clerk tokens (they're not Supabase-issued), so it must be off;
      the function does its own auth. Verified end-to-end: writes `200 {"ok":true}`.
- [x] **`migrate-user` hardened + deployed `--no-verify-jwt`.** Verifies the Clerk JWT
      via JWKS (issuer `clerk.pgp2.termflow.tech`); identity (`sub` + `email`) comes ONLY
      from the verified token, never the body. Verified: a forged token → `401 Invalid or
      untrusted token`. **Depends on a Clerk session-token `email` claim (see Clerk list).**
- [x] **Third-Party Auth: BOTH Clerk issuers registered + enabled** —
      `clerk.pgp2.termflow.tech` (prod) alongside `quiet-mako-19.clerk.accounts.dev` (dev).
      Prod is pre-trusted, so cutover needs NO Supabase auth change and there's no 401 cliff.
      (Remove the dev entry only after cutover, once dev sessions have drained.)

> ⚠️ **Bridge blind spot (2026-07-09 → 2026-07-11):** commit `3a14138` reverted the
> client bridge out of `App.jsx`, so the deployed app recorded NOTHING into
> `_migration_map` / `profiles.email` in that window (every map row still carries the
> bulk-export timestamp `2026-07-09 11:28`). Restored + verified live in `9da1407`
> (2026-07-11: cleared own map row + email stamp; a single reload recreated both).
> Anyone who first signed up in the blind spot is caught by the Phase 1 export —
> **do not skip Phase 1 step 1.**

### Verify Phase 0 (on dev, signed in)
- [ ] Network tab shows `POST …/functions/v1/sync-map` → `200 {"ok":true}`.
- [ ] `select email, dev_user_id, status from _migration_map where email = '<you>';`
      → your `dev_user_id` is filled; `status`/`migrated_at`/`prod_user_id` NULL.
- [ ] `select user_id, email from profiles where email = '<you>';` → email stamped.
- [ ] Coverage: `select count(*) filter (where dev_user_id is null) from _migration_map;`
      → trends to 0 as users log in.
- [ ] **Reconciliation (the check above misses users absent from the map entirely):**
      ```sql
      select p.user_id, p.email, p.last_seen_at from profiles p
      where not exists (select 1 from _migration_map m
                        where m.dev_user_id = p.user_id or m.prod_user_id = p.user_id);
      ```
      → should trend to only known test/self accounts. As of 2026-07-11 the leftovers
      were: 2× "Alpha" + 1 duplicate "Rakesh Kumar" (test accounts, safe to ignore) and
      real users Amit / Vipin / Sagar / Rane / 1 unnamed — the latter group self-heals
      via sync-map on their next login, or via the Phase 1 export.

### Clerk (prepare prod ahead — does NOT affect the running dev app) — DONE 2026-07-12
> **Why cutover became urgent:** the Clerk **dev** instance is hard-capped at **100 users**
> (can't be raised). At ~100 users with a 300-student batch, new students can't sign up.
> Prod (10,000 MAU free tier) is the only way out — this migration IS the fix. The 300 new
> students carry NO data, so they don't touch the bridge; only the ~100 existing users migrate.

- [x] Production instance created; custom domain `clerk.pgp2.termflow.tech` live + SSL.
- [x] Google OAuth **prod** client created (Google Cloud Console); prod redirect URI
      `https://clerk.pgp2.termflow.tech/v1/oauth_callback` added (alongside the dev callback
      on the same client); Client ID/Secret pasted into Clerk prod → Google connection.
- [x] ⭐ **Supabase integration ENABLED on the PROD instance** (Clerk Production →
      Integrations → Supabase → Enabled). Clerk domain `https://clerk.pgp2.termflow.tech`
      already registered in Supabase Third-Party Auth (done in Phase 0). *Historical #1 blocker (Cause A) — cleared.*
- [x] **`email` claim added to the PROD session token** (Clerk → Sessions → Customize
      session token), alongside the Supabase-managed `role` claim:
      `{ "role": "authenticated", "email": "{{user.primary_email_address}}" }`.
      Required by the hardened `migrate-user` (it reads email from the verified token).
- [x] ⭐⭐ **Google OAuth consent screen PUBLISHED (`In production`, External).** This was a
      *second* 100-user wall: while publishing status = `Testing`, Google caps the app at 100
      users for its lifetime. Scopes are only `openid`/`email`/`profile` (non-sensitive), so
      publishing was instant — **no verification review, no cap.** Do NOT upload a custom logo
      (that would trigger Google brand verification; the text-only "TermFlow" consent screen is fine).
- [x] Email restriction: enforced in **app code** (not Clerk allowlist), same as dev. Prod runs
      the same deployed code → `@iimsambalpur.ac.in` lock applies automatically. Clerk prod
      allowlist left OFF to match dev exactly. Nothing to configure.

### Pre-flight token check — ✅ PASSED 2026-07-12
Sign into the **prod** instance once, browser console:
```js
const t = await window.Clerk.session.getToken();
console.log(JSON.parse(atob(t.split('.')[1])));
// MUST show:  role: "authenticated"  AND  email  AND  iss = https://clerk.pgp2.termflow.tech
```
If present, the #1 blocker is dead before cutover. If `t` is null → integration not
enabled. If `role`/`iss`/`email` wrong → Cause B (claims/issuer mismatch).

> **Result 2026-07-12 (PASS):** decoded prod token showed all three —
> `role: "authenticated"`, `email: "…@iimsambalpur.ac.in"`,
> `iss: "https://clerk.pgp2.termflow.tech"`. Chain verified end-to-end.
>
> **How to capture the prod token before cutover** (the live app is still on `pk_test_`):
> sign in at `https://accounts.pgp2.termflow.tech/sign-in`. Clerk redirects you to the app
> (`pgp2.termflow.tech`, still dev) after sign-in — so DON'T read the token there. Instead
> navigate the same browser back to `https://accounts.pgp2.termflow.tech/user` (you're already
> authenticated on that domain → `window.Clerk` = the **prod** instance) and run the snippet there.
> Reading it on `pgp2.termflow.tech` returns a **dev** token (`iss: quiet-mako-19…`, no `email`).

---

## Phase 1 — Cutover day — ✅ COMPLETE 2026-07-12

> **Cutover executed 2026-07-12 — live and healthy.** Sequence run:
> 1. Bridge refreshed via `export-dev-users.mjs` → **100 dev users** in `_migration_map`.
> 2. Full backup `backup_20260712_0037.sql` (464 KB) — verified real row counts:
>    attendance **1805**, profiles 91, friend_pings 45, share_codes 44,
>    push_subscriptions 11, push_prefs 4, reminder_log 12, feedback 3, `_migration_map` 103.
>    (`admin_audit_logs` + `daily_stats` empty by design.)
> 3. Vercel `VITE_CLERK_PUBLISHABLE_KEY = pk_live_…` flipped (Production) + redeployed.
> 4. Live-app auth verified on own account: prod token decoded to
>    `iss: clerk.pgp2.termflow.tech`, `role: authenticated`, `email` present, `azp: pgp2.termflow.tech`;
>    Supabase REST calls carried `Authorization: Bearer …` and returned real data (own data healed on-login).
> 5. `migrate-batch.mjs --dry-run` reviewed → real run: **9 `refs.profiles` remapped, 0 failed.**
>    (Only 1 prod user known at run time — the admin; other ~100 self-migrate on their own first prod login.)
>
> **Remaining work is the Day 2–7 aftercare loop (Phase 2), not a cutover step.**

### 0. Redeploy edge functions if the repo changed since Phase 0
Vercel deploys the frontend only — **edge functions ship separately.** `9da1407`
committed changes to `migrate-user/index.ts`; make sure what's deployed matches
the repo before relying on the on-login remap:
```bash
npx supabase functions deploy migrate-user --no-verify-jwt
npx supabase functions deploy sync-map --no-verify-jwt      # only if changed
```

### 1. Refresh the bridge (capture late sign-ups)
```bash
cd schedule-app
cp .env.migration.example .env.migration     # first time only; then fill secrets
set -a; source .env.migration; set +a
node scripts/export-dev-users.mjs
```

### 2. Snapshot (rollback insurance — UPDATE-based tables MOVE rows)
This is the no-data-loss guarantee. Most tables migrate by **UPDATE (moving `user_id`
dev→prod)**, so after the batch a rollback to the dev key would leave a dev-id login
unable to see rows now filed under the prod id. This backup is the restore point.

- [x] **Full data backup — TESTED, one command (needs Docker running):** — done 2026-07-12 → `backup_20260712_0037.sql` (464 KB, 1805 attendance rows verified).
      ```bash
      cd schedule-app
      npx supabase db dump --linked --data-only -f "backup_$(date +%Y%m%d_%H%M).sql"
      ```
      Read-only (pure SELECTs, zero impact on the live app). Dry-run 2026-07-10 captured
      all 13 tables incl. ~1,600 attendance rows (446 KB). `admin_audit_logs` + `daily_stats`
      are empty by design → they emit a header comment but no rows (that's "visited, empty",
      not "skipped").
      **Verify coverage after dumping:**
      ```bash
      for t in _migration_map admin_audit_logs attendance daily_stats feedback friend_pings \
               profiles push_prefs push_subscriptions reminder_log schedule_cache share_codes \
               system_config; do echo "$t: $(grep -c "INSERT INTO \"public\".\"$t\"" backup_*.sql)"; done
      ```
- [x] Keep the backup file OFF this repo (contains user PII; never commit it). — gitignored.
- [ ] Also take a Supabase → Database → Backups managed backup (belt + suspenders). *(optional; local dump taken)*
- [ ] Export `_migration_map` to CSV and keep it off-Supabase. *(optional; local dump covers it)*

### 3. Flip the key
- [x] Vercel → Env Vars → `VITE_CLERK_PUBLISHABLE_KEY = pk_live_…` (Production). — done 2026-07-12.
- [x] Supabase Third-Party Auth — prod issuer ALREADY registered (done in prep). No change needed.
- [x] Vercel → redeploy. — done 2026-07-12.

### 4. Confirm the blocker is clear (FIRST, before migrating)
Sign in on prod. Network tab: `attendance`/`profiles` requests carry
`Authorization: Bearer eyJ…` **and** return non-empty once migrated.
`200 [] with no Authorization header` = still broken — STOP and fix auth first.

### 5. Run the batch migration
```bash
node scripts/migrate-batch.mjs --dry-run     # review the per-table tally
# (only if the tally looks right)
node scripts/migrate-batch.mjs               # execute (idempotent, safe to re-run)
```
Users who log in later are still covered by the `migrate-user` on-login fallback,
or by re-running the batch.

### 6. Verify (SQL Editor, service_role)
```sql
-- remaining unmigrated
select count(*) from _migration_map where migrated_at is null;

-- per-user spot check (replace :prod)
select 'profiles' t, count(*) from profiles    where user_id = ':prod'
union all select 'attendance', count(*) from attendance where user_id = ':prod'
union all select 'share_codes', count(*) from share_codes where user_id = ':prod';

-- friend refs resolve prod→prod (pick a user with friends; cloudIds should be user_… prod ids)
select user_id, friends from profiles where user_id = ':prod';
```
Spot-check 3–5 users incl. your own account and someone with friends + attendance.

---

## Phase 2 — Aftercare

### Day 2–15 — run the healer loop until everyone's across
As students log back in over the next couple of weeks, each one **self-migrates their own data
on first prod login** (`migrate-user`). Re-run the cross-user healer periodically to stitch
references between people who've both logged in:
```bash
cd schedule-app
set -a; source .env.migration; set +a
node scripts/migrate-batch.mjs --dry-run   # eyeball the tally
node scripts/migrate-batch.mjs             # then run for real (idempotent)
```
- [ ] **Day 2–3** — re-run healer; note `skipped (no prod id)` count (your progress bar → should shrink).
- [ ] **Day 4–7** — re-run every day or two; spot-check a user with friends + attendance in SQL (see Phase 1.6).
- [ ] **Day 8–15** — re-run every couple of days to catch stragglers (people who log in late).
      When `skipped` ≈ 0 and stops shrinking for several days, migration is effectively
      complete — stop running it.

### One-off cleanup items
- [ ] **Delete the old/unused Google OAuth client secret.** The web client `679799519431-…`
      has TWO enabled secrets (`****Ht3l` Jun 18, `****lq7c` Jul 9). Clerk prod uses the newer
      one. Left BOTH enabled during cutover on purpose (the dev callback shares this client, so
      deleting mid-cutover risks breaking a live login). Once dev sessions have drained and prod
      is confirmed stable, disable → verify → delete the stale secret.
- [ ] Users who logged in during any broken window: have them clear the stale flag —
      console `localStorage.removeItem('pgp2.migration-v1')` then reload.
- [ ] Push notifications: per-origin, so they reset. On next load, if
      `Notification.permission === 'granted'`, the app should re-subscribe silently.
- [ ] Friend live features (ping/live-removal) heal once both parties are migrated —
      the batch's cross-user cloudId pass handles this; re-run the batch if any lag.
- [ ] (2–4 weeks, once `_migration_map.migrated_at IS NULL` count ≈ 0):
      remove the `useMigration` hook + `sync-map`, drop `_migration_map`, remove scripts.

---

## Rollback

- Revert `VITE_CLERK_PUBLISHABLE_KEY` to the dev `pk_test_…` in Vercel + redeploy.
- Leave Supabase / `_migration_map` as-is (dev rows for copy-based tables are intact;
  the snapshot from Phase 1.2 restores UPDATE-based tables if needed).
- Keep the dev Clerk instance + dev rows untouched until fully verified, so the batch
  is always re-runnable.

---

## What each piece does (map)

| Piece | Role |
|---|---|
| `supabase/functions/sync-map` | Dev-side: keeps `_migration_map` complete on every login (no orphans) |
| `src/lib/migrationMap.js` | Fire-and-forget client caller for sync-map (guarded to `pk_test_`) |
| `profiles.email` (`stampProfileEmail`) | Denormalized email → rebuild the bridge from data if map is lost |
| `supabase/functions/migrate-user` | Prod on-login remap: claim-lock, merge-not-skip profile, friend_pings |
| `src/lib/useMigration.js` | Prod-only client gate driving the MigrationBanner (guarded to `pk_live_`). On success it **soft-reloads once** so restored data is visible (the app had already fetched the empty prod state before migrate finished). `DONE_KEY` set first → no reload loop. |
| `scripts/export-dev-users.mjs` | Seeds/refreshes `_migration_map` from Clerk dev |
| `scripts/migrate-batch.mjs` | Deterministic batch remap + cross-user cloudId pass (`--dry-run` first) |
| `_migration_map.status` | Concurrency claim (null → in_progress → done) |
