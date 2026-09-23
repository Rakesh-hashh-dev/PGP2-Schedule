# CV Pointers — TermFlow / PGP2 Schedule

> Ready-to-use bullet points. Pick the role section that fits, trim to 4–6 bullets, and tailor metrics to your own estimates.

---

## 🧑‍💻 Full-Stack / Product Engineer

- **Built TermFlow**, a full-stack PWA for 200+ MBA students at IIM Sambalpur — covering timetable, attendance, social planning, assignments, and push notifications — from greenfield to production.
- **Designed a real-time data pipeline**: timetable lives in Google Sheets → exposed via Apps Script → SHA-256 diff-detected at runtime → incremental updates pushed to users via Web Push (VAPID) and Supabase Edge Functions.
- **Architected a offline-first boot strategy**: build-time schedule snapshot baked into the React bundle via a custom `generate-snapshot.mjs` script, reducing cold-start perceived latency to near-zero.
- **Implemented row-level security (RLS) on Supabase Postgres**, routing all writes through stored RPCs to prevent direct table access; attendance, friend graphs, and group state are all user-scoped.
- **Shipped 10 Supabase Edge Functions** covering push dispatch, schedule diffing, class reminders, scheduled config application, health monitoring, and Clerk→Supabase user migration.
- **Integrated Clerk authentication** restricted by email domain (`@iimsambalpur.ac.in`), with a custom SSO callback and multi-phase migration from the Clerk dev environment to production (completed July 2026).
- **Led a zero-downtime auth migration** from Clerk development to production using a batch migration script (`migrate-batch.mjs`) and a `_migration_map` table, preserving all existing user attendance and social data.
- **Maintained a passing test suite of 58 Vitest tests** across 5 test files covering calendar export, attendance workspace, notification state, section logic, and Supabase store behaviour.

---

## 🎨 Frontend / React Engineer

- **Built a React 19 + Vite 8 PWA** with Workbox caching, home-screen install, app shortcuts (Today / Attendance), and an in-app update prompt that polls `dist/meta.json` on each deploy.
- **Designed and shipped 60+ React components** including a timeline view, week agenda, attendance panel, full-schedule browser, friends & group panel with undo-delete, drag-and-drop sortable lists (dnd-kit), and a pet companion system.
- **Extracted a `DesktopSidebar`** component and a `useSidebar` hook to unify navigation state across viewports, with sidebar preference persistence backed by localStorage.
- **Built a calendar export feature** (ICS + SVG formats) with a dedicated modal, a pure-JS export library, and a performance regression test suite (`calendarExport.perf.test.js`).
- **Developed a real-time friends panel** using Supabase Realtime channels — live schedule-comparison, pings, group membership, and social flash toasts — all reconciled without full re-fetches.
- **Implemented a gamified pet companion** (PetPage) with XP economy, mood state machine, neckwear/hat cosmetics, and an animated greeting layer — demonstrating product-thinking beyond functional requirements.
- **Created a Semester Wrapped** feature (`WrappedView`) with shareable SVG cards generated client-side, giving students a personalized end-of-term attendance and social summary.
- **Instrumented the app with Sentry** (source-map uploads via `@sentry/vite-plugin`) and Vercel Analytics + Speed Insights for production observability.

---

## ☁️ Backend / Infrastructure Engineer

- **Deployed and maintained 10 Supabase Edge Functions** (Deno runtime) for push notification dispatch, schedule change diffing, class reminders, health monitoring, and user migration.
- **Designed VAPID-based Web Push infrastructure**: subscription management in Supabase, fan-out dispatch via `send-push` edge function, and a dedicated `public/push-sw.js` service worker handling notification clicks and badge updates.
- **Authored Google Apps Script** (2,400+ lines) to serve the timetable as a structured JSON feed from Google Sheets, including a menu extension for admin overrides.
- **Managed multi-environment Supabase configuration** (`config.toml`, branch previews) with schema migrations and SQL snippets versioned in the repository.
- **Built a load-test configuration** (`loadtest.yml`) and a `get-metrics` edge function for monitoring API throughput under real usage.
- **Deployed on Vercel** with a custom `vercel.json` routing config, Sentry release tracking, and a `stats.html` bundle visualizer (rollup-plugin-visualizer) to keep bundle size in check.
- **Automated database backups** at key milestones (4 SQL dumps in repository), with a documented cutover runbook (`CUTOVER.md`) and a `HEALER.md` incident-response guide.

---

## 🛠️ Platform / DevOps / Tooling Engineer

- **Built a prebuild pipeline**: `npm run build` automatically invokes `generate-snapshot.mjs` to refresh schedule data before every Vite production build, making the CI/CD output self-contained.
- **Established a lint + test baseline** with ESLint (react-hooks plugin) and Vitest, enabling fast feedback loops with `vitest run` for CI and `vitest` (watch) for local iteration.
- **Implemented Sentry source-map upload** as part of the Vite build, correlating production stack traces back to original JSX source.
- **Managed Vercel Analytics and IndexNow** integration (`.indexnow-key`) for SEO signalling on each deploy.
- **Wrote `CODEX_MEMORY.md`** — a structured onboarding document keeping architecture, commands, worktree state, and auth migration context up-to-date for future AI coding sessions and new collaborators.

---

## 📱 Mobile / PWA Specialist

- **Shipped a production PWA** installable on iOS and Android; offline capable via Workbox runtime caching with stale-while-revalidate for the schedule feed and network-first for dynamic user data.
- **Implemented app shortcuts** in the PWA manifest, enabling one-tap access to Today view and Attendance panel from the home screen.
- **Built a `DayGreeting` component** with time-of-day context, weather (Open-Meteo API), and animated greeting pets — replacing the generic loading screen with a personalised experience.
- **Developed haptic feedback utilities** (`haptics.js`) for attendance marking interactions on mobile.
- **Optimised for mobile-first navigation**: custom bottom-nav routing (`mobileNav.js`, `navItems.js`) with icon-only and labelled variants, persisted active-tab state, and smooth transitions between views.

---

## 📊 Product / Growth (for non-technical CVs / business roles)

- **Founded and shipped TermFlow**, a student productivity app adopted by the full PGP2 MBA cohort at IIM Sambalpur within one academic term.
- **Identified and solved a real campus pain point** — fragmented timetable communication — by building a centralised platform that integrates schedule, attendance, social coordination, assignments, and exams.
- **Drove engagement through social features**: friend scheduling, group planning, shared timetable comparison, and in-app pings — increasing daily active return rate beyond a utility app baseline.
- **Executed a live migration** of 200+ user accounts with zero data loss and no service downtime, coordinating auth provider switchover and database state reconciliation.
- **Iterated rapidly across 5+ major versions** (v1 → v5.12), adding features like calendar export, semester Wrapped, a pet companion, mess menu integration, and an admin dashboard based on real user feedback.

---

## 📈 Data Analytics / Business Intelligence / Data-Driven PM

> These bullets are grounded in specific features built inside the TermFlow admin dashboard and `insights.js` library.

- **Designed and built a full analytics dashboard** from scratch inside the TermFlow admin panel — covering user engagement, attendance trends, push notification reach, feature adoption, and infrastructure health — entirely without a third-party BI tool.
- **Implemented DAU / WAU / MAU active-user tiers** by querying `last_seen_at` heartbeats from Supabase Postgres, computing rolling 1/7/30-day windows client-side, and surfacing a **DAU/MAU stickiness ratio** as the primary retention metric.
- **Built a 7-day bar chart of daily active users** rendered as pure React/CSS (no chart library) — bucketing `last_seen_at` timestamps by IST date using `Intl.DateTimeFormat` with timezone-aware formatting, and overlaying a peak-hour signal derived from hourly heartbeat aggregates.
- **Shipped a durable 30-day presence history** via a SECURITY DEFINER RPC (`admin_get_presence_history`) that stores per-user hourly heartbeat bitmaps — enabling day-level and hour-level drilldown even after raw timestamps age out, with CSV export for offline analysis.
- **Built an onboarding funnel** tracking four lifecycle stages (Signed up → Picked a section → Enabled push → Active this week), computing step-to-step drop-off percentages to pinpoint activation bottlenecks.
- **Created an attendance watchlist panel** surfacing the top N most-skipped courses cohort-wide, backed by a `get_admin_stats` SECURITY DEFINER RPC that aggregates absence records across all user rows (bypassing individual RLS) and ranked by absolute absence count with proportional bar visualisation.
- **Implemented a push delivery analytics view** using a `get_push_broadcast_stats` RPC — matching each broadcast notification to its delivery outcome and surfacing per-campaign reach statistics directly in the dashboard.
- **Built a cron / edge-function health monitor** using a `get_cron_health` RPC — displaying last-run time, schedule expression, status, and a staleness alert (>20 min since last heartbeat) for each background job, with a colour-coded health summary badge.
- **Designed an enrolment distribution panel** ranking the top 5 most popular courses by enrolment count, computed from the `courses` JSONB field across all user profiles — useful for understanding resource demand by subject area.
- **Wrote a re-engagement analytics and targeting flow**: identified inactive user cohorts by configurable inactivity threshold (e.g. 14+ days since `last_seen_at`), surfaced the count and list in the dashboard, and wired a one-click push broadcast to that specific audience via the existing VAPID push pipeline.
- **Built a client-side analytics library** (`insights.js`) computing per-course stats (sessions done/remaining, next class, skip rate), weekly recaps (busiest day, subject-area distribution, hours in class, attendance %), and 7-day upcoming deadline merges — all without network calls, from already-loaded schedule and attendance state.
- **Implemented a feature-adoption panel** tracking live on/off status for 7 feature flags (social graph, attendance, exams, meetups, push dispatch) alongside real-time share code count and friend ping count — enabling quick read on which features the cohort is actively using.
- **Built a system self-test diagnostic**: a one-click runner that pings 5 critical service checks (Supabase DB, Insights RPCs, cron jobs, push gateway, schedule feed) in parallel and reports pass/fail with timestamps — equivalent to a synthetic monitor for the production stack.
- **Maintained an admin audit log** (`admin_audit_logs` table) capturing every config change, push broadcast, and user action with admin identity, action type, and payload — enabling compliance-style traceability with searchable, filterable, and CSV-exportable log views.

---

## 🏢 Management Consulting (McKinsey / BCG / Bain / Big-4)

- **Identified and structured an unmet institutional need** — fragmented timetable and attendance data across a 200+ student MBA cohort — and delivered a full-stack product solution end-to-end, from problem diagnosis to deployment.
- **Drove a zero-downtime platform migration** for 200+ users, managing stakeholder risk, sequencing the cutover in phases, and writing a formal incident-response runbook (`CUTOVER.md`, `HEALER.md`) to ensure operational continuity.
- **Designed a data pipeline** that converts an unstructured Google Sheets source into structured, diff-tracked, real-time schedule intelligence — applying structured problem-solving to a messy data environment with no existing tooling.
- **Built and shipped a multi-feature product across 5+ major releases** (v1 → v5.12), prioritising the backlog based on cohort feedback, balancing quick wins (attendance tracking) with longer-horizon features (calendar export, Semester Wrapped).
- **Quantified adoption impact**: app served as the single source of timetable truth for the PGP2 batch, replacing ad-hoc WhatsApp broadcasts and reducing schedule-related confusion during a high-stakes academic term.
- **Authored structured documentation** (architecture docs, migration runbooks, AI onboarding memory) demonstrating the ability to synthesise complex technical contexts into clear, transferable artefacts for diverse audiences.

---

## 🏗️ General Management / Strategy (Leadership Development Programmes)

- **Conceptualised, built, and operated a zero-budget student platform** from scratch — demonstrating ownership, self-direction, and the ability to deliver results without organisational resources or a pre-existing team.
- **Managed end-to-end product lifecycle**: ideation → architecture → iterative development → production deployment → live incident response → version updates, across a 12+ month horizon.
- **Scaled a platform across two dimensions simultaneously** — feature depth (attendance, social, assignments, exams, push notifications) and operational reliability (Sentry monitoring, health checks, automated backups) — without sacrificing either.
- **Negotiated constraints creatively**: used free-tier infrastructure (Supabase, Vercel, Google Sheets) to build production-grade reliability, demonstrating resourcefulness and cost-conscious engineering judgement.
- **Led a complex stakeholder transition** (auth provider migration) with a documented plan, phased execution, rollback provisions, and zero user data loss — analogous to a live system cutover in an enterprise context.
- **Demonstrated cross-functional execution**: sole owner of product strategy, UI/UX, backend infrastructure, database design, DevOps, and user communication — building capability across all functions a GM role requires.

---

## 💻 Technology Management / IT Strategy (CTO Office / Digital Transformation)

- **Architected a modern SaaS-grade technology stack** (React 19, Vite 8, Supabase, Clerk, Vercel) for a real institutional use case, making deliberate trade-offs between build vs. buy, open-source vs. managed services.
- **Implemented enterprise-grade security controls** on a student budget: OAuth-restricted to institutional email domain, Postgres row-level security, RPC-only write access, VAPID-authenticated Web Push, and environment-segregated secrets management.
- **Evaluated and selected best-fit vendors** across auth (Clerk), database/realtime (Supabase), hosting (Vercel), error monitoring (Sentry), and push infrastructure (VAPID/Web Push) — demonstrating technology assessment and vendor management skills.
- **Designed for operational resilience**: automated database backups, a health-monitor edge function, Sentry alerting, a formal incident-response document, and a load-test configuration for throughput validation.
- **Built a custom CI/CD pipeline** integrating prebuild snapshot generation, ESLint quality gates, Vitest test suite (58 tests), Sentry source-map upload, and Vercel deployment — reducing manual release risk.
- **Translated a real-world business need into a technical architecture**, maintaining alignment between product goals (student experience, reliability) and infrastructure decisions (offline-first, realtime sync, push alerts) throughout development.

---

## 🚀 Entrepreneurship / Venture Capital / Product Startups

- **Founded and shipped TermFlow** — a vertically integrated student OS (timetable + attendance + social + assignments + exams + notifications) — achieving full cohort adoption within the PGP2 MBA batch at IIM Sambalpur.
- **Built a defensible moat through depth**: the combination of real-time schedule diffing, peer social graph, gamified engagement (pet system, XP economy, Semester Wrapped), and offline-first reliability creates switching costs a simple timetable app cannot replicate.
- **Demonstrated product-market fit through organic adoption**: the app became the de-facto scheduling tool for the batch without any marketing spend, validating both the problem hypothesis and the execution quality.
- **Executed with startup discipline**: used free-tier cloud infrastructure, automated testing to move fast without breaking things, and shipped features iteratively (v1 → v5.12 across one academic year) in response to real user behaviour.
- **Showed growth-product thinking**: added social hooks (friends, groups, pings), engagement loops (pet companion, XP rewards, Semester Wrapped), and notification nudges — applying retention and activation mechanics typical of consumer growth playbooks.
- **Built a technical moat independently**: end-to-end ownership of product, backend, mobile, and DevOps — the kind of founder-mode technical depth that reduces early-stage dependency on external hires and accelerates iteration speed.

---

> **Tip**: For resume bullets, lead with the strongest impact metric you can honestly claim (e.g. "used by 200+ students", "reduced cold-start to <200 ms", "58 tests, 100% green"). Replace placeholders with real numbers wherever you have them.
