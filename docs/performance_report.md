# Performance Testing Report - PGP2 Project

**Last refreshed: 2026-07-12** (Lighthouse 13.4.0 against a local production build served via `vite preview`; the measured page is the signed-out sign-in screen, since Lighthouse cannot authenticate). Original report preserved where still relevant; superseded numbers replaced.

## 1. Frontend Performance (Lighthouse)

Both form factors were measured this time. The previous report's single score (90) did not state a form factor; treat the two runs below as the new baseline.

### **Desktop** (no throttling preset)
- **Performance Score**: **94/100**
- **FCP**: 0.5 s · **Speed Index**: 1.3 s · **LCP**: 1.5 s · **TBT**: 0 ms · **CLS**: 0

### **Mobile** (simulated slow-4G, 4× CPU throttle — Lighthouse default)
- **Performance Score**: **65/100**
- **FCP**: 2.4 s · **Speed Index**: 4.1 s · **LCP**: 5.9 s · **TBT**: 370 ms · **CLS**: 0

> [!TIP]
> **Analysis**: Desktop is excellent — FCP at 0.5 s reflects the new static boot splash painting straight from HTML (no JS required for first paint). Mobile is dominated by the Clerk auth chain: the LCP element (sign-in card) can only render after react-vendor + ClerkApp download, Clerk initializes, and its API handshake completes — a long serial chain under slow-4G. TBT (370 ms) is JS parse/execute on the throttled CPU. CLS remains a perfect 0 on both.
>
> Note: this local run slightly *understates* production mobile performance — the preconnect added for `clerk.pgp2.termflow.tech` only pays off on the real domain, and Vercel's CDN + HTTP/2 push behave better than `vite preview`. Re-measure against production for the true mobile number.

---

## 2. Bundle Size Analysis

Vite production build, gzipped sizes (via build output / `rollup-plugin-visualizer`, refreshed 2026-07-12):

### **Largest JavaScript Chunks (Gzipped)**
1. **React Vendor (`react-vendor.js`)**: 57.55 kB
2. **Supabase Client (`supabase.js`)**: 53.01 kB
3. **ClerkApp (`ClerkApp.js`)**: 32.30 kB *(initial)* + **Clerk SDK (`clerk.js`)**: 27.18 kB
4. **Sentry (`sentry.js`)**: **27.88 kB** — down from 51.37 kB *(idle-loaded, not on the critical path)*
5. **Admin Dashboard (`AdminDashboard.js`)**: 20.03 kB *(lazy — only loads when the admin view opens)*
6. **Vendor misc (`vendor.js`)**: 16.37 kB · **FriendsPanel**: 11.58 kB · **NotificationsPage**: 9.17 kB *(all lazy)*

> [!NOTE]
> **Analysis**: Code splitting is working well. AdminDashboard, FeedbackWidget, and 9 other panels are `React.lazy()` route-level chunks; Sentry loads on `requestIdleCallback` and never blocks paint. The Sentry chunk regression (tracing + profiling integrations with 1.0 sample rates had crept in, nearly doubling it) was fixed 2026-07-12 — back to the errors-only core.

---

## 3. Backend Load Testing (Supabase)

*(Unchanged from previous run — not re-tested.)*

Concurrent load test against the `profiles` table using the anonymous client key, 200 concurrent requests:

- **Success Rate**: 100% (200 OK) · **Total Time**: ~3.29 s · **Avg Response**: ~16.45 ms · **Throughput**: ~61 req/s

> [!TIP]
> **Analysis**: Supabase handles concurrent bursts extremely well; typical user spikes (many students checking schedules simultaneously) will not cause backend slowdowns. A future, more realistic test would replay the actual dashboard query mix with authenticated JWTs rather than a single anon-key table read.

---

## Recommendations — status

| # | Recommendation | Status |
|---|---|---|
| 1 | Lazy-load non-critical components (AdminDashboard, FeedbackWidget, Sentry) | ✅ **Already implemented** — verified in `App.jsx` (11 lazy chunks) and `lib/sentry.js` (idle load). Clerk cannot be deferred (auth gates the app) but already uses the headless variant. |
| 2a | Sentry chunk bloat (tracing/profiling crept in at 1.0 sample rates) | ✅ **Fixed 2026-07-12** — errors-only again: 51.37 → 27.88 kB gzip, no per-pageload transaction events. |
| 2b | Preconnect pointed at dev Clerk domain (`clerk.accounts.dev`) instead of prod (`clerk.pgp2.termflow.tech`) | ✅ **Fixed 2026-07-12** in `index.html`. |
| 2c | Fonts: Plus Jakarta Sans loaded (2 weights) but used by a single 12px class | ✅ **Fixed 2026-07-12** — class now uses `var(--body)`; family removed from the Google Fonts request. |
| 2d | FCP gated on JS (splash lived in React's Suspense fallback) | ✅ **Fixed 2026-07-12** — static splash markup inlined in `#root` in `index.html`; desktop FCP now 0.5 s. |
| 3 | Recompress `premium_hero_backdrop_v3.webp` (157 kB vs v2's 41 kB — odd-date users pay ~4× on the likely LCP image post-login) | ⬜ **Pending** |
| 4 | Re-run mobile Lighthouse against production (pgp2.termflow.tech) to baseline the real-world number with CDN + working preconnects | ⬜ **Pending** |
| 5 | Mobile LCP is serialized behind the Clerk handshake; if 65 holds in prod, options include an inline-rendered sign-in shell (paint the card chrome before Clerk hydrates it) | ⬜ **Investigate if prod confirms** |
