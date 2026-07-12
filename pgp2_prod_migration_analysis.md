# PGP2 Schedule (TermFlow) — Dev → Prod Migration Analysis

## Project Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + Vite 8 | SPA, PWA-enabled |
| Auth | Clerk (`@clerk/clerk-react ^5.61.8`) | Google OAuth only, headless variant |
| Database | Supabase (`@supabase/supabase-js ^2.108.2`) | RLS via Clerk JWT |
| Hosting | Vercel (Hobby plan) | Auto-deploy from git |
| Push Notifications | Web Push + VAPID | 3 Supabase Edge Functions |
| PWA | vite-plugin-pwa + Workbox | Service Worker with runtime caching |

---

## ⏱️ Time Estimate

| Task | Estimated Time |
|---|---|
| Clerk: Create prod instance + copy settings | 10 min |
| Google OAuth: Create new OAuth client for prod | 15 min |
| Update `.env.local` + Vercel env vars | 5 min |
| Fix Workbox SW cache URL pattern (clerk.accounts.dev → prod domain) | 10 min |
| Supabase: Verify JWT issuer for prod Clerk | 10 min |
| VAPID: Decide keep/rotate + update if needed | 5 min |
| Vercel: Update env vars + redeploy | 5 min |
| End-to-end testing (auth, push, DB) | 20-30 min |
| **TOTAL** | **~1.5 – 2 hours** |

> [!TIP]
> If you already have a Google Cloud project with an OAuth app, creating the prod redirect URI is < 5 min. The bulk of time is testing.

---

## 🔧 What Actually Needs to Change (File-by-File)

### 1. `.env.local` + Vercel Environment Variables
**The biggest change.** Every secret key rotates.

```diff
- VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtbWFrby0xOS5jbGVyay5hY2NvdW50cy5kZXYk
+ VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx

# Supabase stays the same (same project, different Clerk issuer)
  VITE_SUPABASE_URL=https://fzhfbttlbfpnwhempyav.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_...

# VAPID can stay the same if you don't rotate keys
  VITE_VAPID_PUBLIC_KEY=BM5mc-tieMaMvz11qWwO...
```

### 2. `vite.config.js` — Service Worker URL Pattern
**Critical.** Line 46 hardcodes `clerk.accounts.dev`:

```diff
- urlPattern: /^https:\/\/.*\.clerk\.accounts\.dev\/.*/i,
+ urlPattern: /^https:\/\/.*\.clerk\.accounts\.(dev|com)\/.*/i,
```
Without this fix, the Service Worker will **not** correctly apply NetworkOnly to Clerk's prod API calls — risking stale/cached auth responses.

### 3. Supabase JWT Configuration
Your `supabase.js` uses Clerk's session token for RLS:
```js
accessToken: async () => window.Clerk?.session?.getToken()
```
The JWT issuer URL changes from `https://quiet-mako-19.clerk.accounts.dev` to your prod instance URL. You **must** update the JWT secret/issuer in your Supabase dashboard:

- Go to **Supabase → Authentication → Third Party Auth → Clerk**
- Update the Clerk Publishable Key / Domain to your prod instance

### 4. Google OAuth App
In [Login.jsx](file:///f:/Web%20Dev/Antigravity/PGP2%20Schedule/schedule-app/src/components/Login.jsx#L19-L23), the SSO redirect uses:
```js
redirectUrl: `${window.location.origin}/sso-callback`
```
This is dynamic — ✅ no code change needed. But you **do** need to:
- Add your prod domain to the **Authorized redirect URIs** in Google Cloud Console
- Update Clerk prod instance's Google OAuth credentials (Client ID + Secret)

### 5. No Changes Needed
- `SsoCallback.jsx` — fully dynamic, no hardcoded URLs
- `push.js` — VAPID keys can stay the same
- `profile.js`, `friends.js`, `attendance.js` — pure Supabase, no Clerk URLs
- `vercel.json` — no changes needed
- All 3 Edge Functions — Supabase-side, unaffected

---

## ⚠️ Developer Risks

| Risk | Severity | Detail |
|---|---|---|
| **SW caches Clerk prod auth** | 🔴 High | `vite.config.js` line 46 only patterns `*.clerk.accounts.dev`. Prod domain is `*.clerk.com`. SW may apply wrong cache strategy. |
| **Supabase RLS breaks silently** | 🔴 High | If JWT issuer isn't updated in Supabase, all DB reads/writes will fail with 401 — users see a broken app with no clear error. |
| **Vercel env vars not set** | 🔴 High | If `VITE_CLERK_PUBLISHABLE_KEY` isn't updated in Vercel, the deployed build will silently have no auth. |
| **Google OAuth redirect mismatch** | 🟠 Medium | Without adding prod redirect URIs to Google Cloud Console, sign-in will fail with `redirect_uri_mismatch`. |
| **Push subscriptions orphaned** | 🟡 Low | Existing dev push subscriptions (stored by endpoint in Supabase) remain valid — these are browser-level, not Clerk-level. No action needed. |
| **PWA cache serving stale build** | 🟡 Low | Users with the PWA installed may get a cached old build. The existing `Cache-Control: no-cache` on `sw.js` and `index.html` should handle this, but prompt users to refresh. |

---

## 👥 End-User Risks

| Risk | Impact | Who's Affected |
|---|---|---|
| **Must sign in again** | All 100+ existing dev users will be logged out. Sessions don't transfer. | Everyone |
| **Profile data preserved ✅** | Supabase data (courses, attendance, assignments, read state) is tied to `user_id` (Clerk's sub). **New prod user IDs will be different strings** — data appears lost. | Everyone |
| **Push notifications reset** | Existing push subscriptions are tied to the old Clerk `user_id`. New prod user IDs won't match → notifications stop until user re-enables them. | Users with push enabled |
| **Friends connections broken** | `friends.js` uses Clerk `user_id` as FK. New prod user IDs = new unknowns = all friend links broken. | All users with friends |
| **Attendance history orphaned** | Attendance records are keyed by Clerk `user_id`. | All users with attendance |
| **No gradual rollout** | It's a hard cutover. All users affected simultaneously. | Everyone |

> [!CAUTION]
> **The biggest end-user risk is profile/data loss.** Your Supabase tables use Clerk's `sub` (user ID like `user_2abc...`) as the primary key. Dev user IDs start with `user_` from the dev instance. Prod will generate entirely new `user_` IDs for the same Google accounts. Unless you run a migration script to remap old user IDs to new ones, all user data appears lost.

---

## 🛡️ How to Mitigate Data Loss

The Clerk `user_id` changes between instances, but **the Google account email stays the same**. Here's a migration strategy:

1. **Before switching:** Export a mapping of `dev_user_id → email` from Clerk dev dashboard
2. **After switching:** As users sign in to prod, capture their `prod_user_id → email`
3. **Run a Supabase migration script** that updates all FK references from the old user_id to the new one

This is optional complexity — assess based on how much data your 100 users have accumulated.

---

## ✅ Summary Recommendation

**You can safely migrate in ~2 hours** if you follow this order:

1. ✅ Create Clerk prod instance via "Go to prod" button
2. ✅ Set up Google OAuth prod credentials in Clerk + Google Cloud Console
3. ✅ Update Supabase JWT issuer to Clerk prod
4. ✅ Fix `vite.config.js` SW URL pattern for Clerk prod domain
5. ✅ Update Vercel environment variables with prod keys
6. ✅ Redeploy and test sign-in + DB access + push notifications
7. ⚠️ Decide on user data migration strategy before going live
