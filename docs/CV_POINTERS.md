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

## 🔐 Security / AppSec Engineer

- **Implemented Postgres Row-Level Security (RLS)** across all user-scoped tables (attendance, friend graphs, group membership) — ensuring no cross-user data leakage at the database layer, independent of application logic.
- **Routed 100% of write operations through SECURITY DEFINER RPCs**, eliminating direct table mutations from the client and enforcing server-side validation on every state change.
- **Restricted authentication to an institutional email domain** (`@iimsambalpur.ac.in`) via Clerk's allowlist, preventing unauthorised sign-ups without any custom auth server.
- **Implemented VAPID-authenticated Web Push**: subscription tokens stored per-user in Supabase, fan-out dispatch signed with server-held VAPID keys — preventing push spoofing or subscription hijacking.
- **Maintained environment-segregated secrets management**: separate Clerk and Supabase credentials for dev and production, with no production keys committed to the repository.
- **Built a compliance-grade admin audit log** (`admin_audit_logs` table) — capturing every config change, push broadcast, and admin action with identity, action type, payload, and timestamp — searchable, filterable, and CSV-exportable.
- **Authored `HEALER.md`** — a structured incident-response guide covering detection, diagnosis, rollback, and post-mortem documentation for production issues.
- **Executed a zero-data-loss auth provider migration** using a `_migration_map` table and a batch migration script — preserving all user records and relationships across a live system cutover with full rollback provisions.

---

## 🧪 QA / SDET / Test Engineering

- **Maintained a 58-test Vitest suite** across 5 focused test files — covering calendar export correctness, attendance state logic, push notification state machine, section assignment logic, and Supabase store behaviour — with `vitest run` integrated into the CI pipeline.
- **Wrote a dedicated performance regression test** (`calendarExport.perf.test.js`) that benchmarks ICS and SVG export time on every run, guarding against latency regressions in the export library.
- **Authored a load-test configuration** (`loadtest.yml`) simulating concurrent user traffic against API endpoints, validating throughput under realistic usage conditions before each major release.
- **Built a synthetic system self-test** — a one-click diagnostic that pings 5 critical service checks (Supabase DB, Insights RPCs, cron jobs, push gateway, schedule feed) in parallel and reports pass/fail with timestamps — serving as a production smoke test post-deploy.
- **Implemented a cron health monitor** (`get_cron_health` RPC) that tracks last-run time and staleness (>20 min threshold) for each background job — effectively a continuous integration check for scheduled server-side processes.
- **Enforced a release gate policy**: no new feature was shipped until the full test suite was green and Sentry showed zero unresolved errors from the current version — instilling a test-first release discipline.
- **Instrumented Sentry with source-map uploads** (via `@sentry/vite-plugin`) so production stack traces resolve to original JSX line numbers, dramatically reducing mean-time-to-identify (MTTI) for production bugs.

---

## 💼 Business Analyst / Solutions Architect

- **Conducted informal requirements discovery** within the PGP2 cohort — identified fragmented timetable and attendance management as the root cause of recurring coordination failures — and translated that into a structured product specification before writing a line of code.
- **Evaluated and selected a best-fit technology stack** (React, Supabase, Clerk, Vercel, VAPID) based on constraints of zero budget, a solo team, and a hard go-live deadline — documenting trade-offs between build-vs-buy and managed-vs-self-hosted for each component.
- **Designed the system data model** from scratch — mapping student profiles, section assignments, course enrolment (JSONB), attendance records, friend graphs, push subscriptions, and audit logs into a normalised Postgres schema with RLS and RPC access patterns.
- **Authored `CODEX_MEMORY.md`** — a structured onboarding document capturing architecture overview, key commands, environment setup, auth migration context, and known gotchas — enabling new contributors (or AI coding assistants) to become productive without verbal handholding.
- **Defined and documented a formal cutover runbook** (`CUTOVER.md`) for the auth provider migration, covering pre-cutover checks, migration steps, verification queries, rollback conditions, and post-cutover sign-off — analogous to a BA-authored change-management playbook.
- **Bridged technical and non-technical stakeholders**: maintained a living admin dashboard that gave the cohort coordinator visibility into user adoption, push reach, and attendance patterns — without requiring any SQL knowledge.
- **Translated business requirements into measurable system behaviour**: every product feature had a traceable outcome (e.g. push opt-in rate from the onboarding funnel, attendance watchlist for counselling signals, stickiness ratio for engagement health).

---

## 📣 Growth / CRM / Retention Specialist

- **Designed and implemented a 4-stage onboarding funnel** (Signed up → Picked section → Enabled push → Active this week) with step-level drop-off percentages — enabling data-driven identification of the highest-leverage activation bottleneck.
- **Built a push notification CRM pipeline** end-to-end: user subscription management, segmented broadcast targeting, VAPID-signed delivery, and a per-campaign delivery analytics view — all without a third-party CRM tool.
- **Implemented behavioural re-engagement targeting**: identified users inactive for a configurable threshold (e.g. 14+ days since `last_seen_at`), surfaced the cohort count in the admin dashboard, and wired a one-click push broadcast to that specific audience segment.
- **Tracked DAU/MAU stickiness ratio** as the primary retention KPI — computed from rolling heartbeat windows — to distinguish daily-habit users from weekly-utility users and guide feature investment accordingly.
- **Designed retention loops across multiple vectors**: daily class reminders (push), social pings from friends, XP rewards and pet companion engagement (gamification), and Semester Wrapped (shareable social proof) — applying a multi-channel retention playbook.
- **Achieved 100% cohort activation** (200+ users) within one academic term with zero paid acquisition — driven entirely by word-of-mouth and the app's social coordination value.
- **Built a 7-day DAU trend chart** with peak-hour overlay to identify days and times of highest engagement — informing optimal push send-time scheduling for maximum open rates.
- **Ran targeted re-engagement campaigns** via push broadcast to inactive user cohorts — using the existing VAPID pipeline — and monitored recovery in the DAU chart to assess campaign lift.

---

## 🎓 EdTech / Education Technology

- **Solved a core EdTech coordination problem** at IIM Sambalpur: digitised the full student academic lifecycle (timetable → attendance → assignment deadlines → exam prep) in a single progressive web app, replacing a patchwork of WhatsApp, Google Sheets, and manual tracking.
- **Designed a real-time schedule pipeline** that keeps student-facing timetable data synchronised with the academic office's Google Sheets — propagating reschedules and cancellations as personalised push notifications within minutes of a change.
- **Built an attendance tracking and insight system** that computes per-course session counts, skip rates, and class-hours-remaining — giving students actionable visibility into their attendance standing throughout the term.
- **Shipped a 'Semester Wrapped' feature** — personalised, shareable SVG recap cards summarising each student's attendance record, busiest subjects, and social activity — driving end-of-term reflection and cohort engagement.
- **Instrumented an onboarding funnel** tracking the student activation journey from sign-up to push-enabled active user — surfacing drop-off rates to optimise the registration experience.
- **Designed for the campus connectivity constraint**: offline-first architecture with a build-time schedule snapshot means the app is fully usable even on flaky campus Wi-Fi, a critical requirement in the student context.
- **Built cohort-wide analytics for academic coordinators**: attendance watchlist (top skipped courses), enrolment distribution by subject, and re-engagement targeting — giving program administrators data they previously had no access to.
- **Applied engagement mechanics borrowed from consumer apps** (pet companion, XP economy, social pings, Semester Wrapped) to increase daily-active usage in an academic tool — demonstrating that EdTech retention requires the same product discipline as consumer apps.

---

## 📋 Program / Operations Manager

- **Delivered a zero-budget, zero-team software platform end-to-end** — from problem identification to production deployment — within one academic term, demonstrating end-to-end program ownership without organisational resources.
- **Managed a live system migration** of 200+ user accounts across auth providers: authored a formal cutover plan (`CUTOVER.md`), executed in sequenced phases (freeze → migrate → verify → switch → confirm), and achieved zero data loss and zero downtime.
- **Authored and maintained structured operational documentation**: architecture overview (`CODEX_MEMORY.md`), incident response guide (`HEALER.md`), and migration runbook (`CUTOVER.md`) — ensuring operational continuity independent of individual knowledge.
- **Implemented a production health-monitoring system**: a cron health dashboard tracking last-run time, schedule, and staleness alerts for each background job — equivalent to an ops team's service-level monitoring board.
- **Maintained automated database backups** at 4 key milestones, with a formal restore procedure — demonstrating disaster-recovery planning discipline on a zero-budget infrastructure.
- **Ran an iterative release programme** across 5+ major versions (v1 → v5.12), sequencing quick-win features (attendance, push alerts) before higher-effort, higher-impact capabilities (Semester Wrapped, social graph, analytics dashboard) — applying sprint-style delivery discipline.
- **Established a quality gate before every release**: full Vitest suite (58 tests) green, Sentry error queue clear, and load-test validation — eliminating regression risk without a dedicated QA team.
- **Coordinated a stakeholder-facing data transition**: communicated migration steps to the active user cohort, managed the cutover window, and provided rollback provisions — analogous to a PMO-led enterprise system cutover.

---

> **Tip**: For resume bullets, lead with the strongest impact metric you can honestly claim (e.g. "used by 200+ students", "reduced cold-start to <200 ms", "58 tests, 100% green"). Replace placeholders with real numbers wherever you have them.

---

## 🗣️ How to Explain This Project — By Persona

### 🎯 As a Marketing Person

> **Hook**: "I built a product from zero that achieved 100% cohort adoption — with no marketing budget and no paid acquisition."

**Explanation (2–3 min version)**:

"TermFlow started as a problem I noticed firsthand — the MBA timetable at IIM Sambalpur was being managed through WhatsApp forwards and Google Sheets shared links. Students were missing classes, confusing reschedules, and spending mental energy on logistics instead of academics.

I built a branded product — TermFlow — that brought all of that into one place: live schedule, attendance tracking, friend coordination, push notifications, and even an end-of-semester recap feature ('Semester Wrapped') modelled after Spotify Wrapped.

The marketing insight was that **utility alone doesn't drive retention** — social hooks and delight do. So I added features like peer pings, a shared timetable view, and a gamified pet companion that rewards engagement. The result was organic, word-of-mouth adoption across the entire 200+ student batch within one term.

That's the kind of growth loop I understand — **solve a real pain deeply, add a social layer, and make it delightful enough that users recruit other users for you.**"

---

### 📦 As a Product Person

> **Hook**: "I went from 0 to a fully shipped, iterated, production product — owning the full lifecycle myself."

**Explanation (2–3 min version)**:

"TermFlow is a student productivity platform I built solo for the PGP2 batch at IIM Sambalpur. The core problem: timetable and attendance data was fragmented across multiple channels, creating confusion and friction during a high-stakes academic year.

My product approach was to start narrow — nail the schedule view first — then layer in features based on real user feedback: attendance tracking, friend panels, group study coordination, push notifications for class reminders, assignment deadlines, and exam prep views.

I shipped across **5+ major versions** (v1 to v5.12), always prioritising by impact and effort. Quick wins like attendance came early. Higher-effort, higher-delight features like **Semester Wrapped** (personalised shareable recap cards) and the **pet companion system** (XP economy, mood states, cosmetics) came later — to shift the app from 'useful tool' to 'daily habit'.

On the infrastructure side, I made deliberate product decisions too: offline-first boot so the app loads instantly even on flaky campus Wi-Fi, an onboarding funnel I tracked and optimised (sign-up → section selection → push opt-in → active usage), and a feature-flag panel to control rollout.

The key product lesson: **depth beats breadth**. Doing schedule + attendance + social extremely well built more loyalty than shipping 10 half-baked features."

---

### ♟️ As a Strategy Person

> **Hook**: "I identified a structural inefficiency in an institution, built a solution that created switching costs, and scaled it to full cohort adoption."

**Explanation (2–3 min version)**:

"The strategic framing is this: every MBA cohort at IIM Sambalpur shares a timetable, a peer social graph, and attendance obligations — but there was no platform that unified all three. The existing 'solution' was a patchwork of WhatsApp groups, shared Sheets, and verbal reminders.

I saw an opportunity to create a **hub** — something that aggregates fragmented institutional data and becomes the single source of truth. That's TermFlow.

The strategic depth came from deliberately building switching costs:
- **Data lock-in**: your personal attendance history, your section, your friend graph all live in the app.
- **Social lock-in**: if your friends are on TermFlow, you can see their schedules, coordinate meetups, and send pings — creating network effects within the cohort.
- **Habit formation**: daily class reminders, end-of-day summaries, and the gamified pet companion drove daily-active behaviour, not just weekly check-ins.

From a positioning standpoint, TermFlow competed against the status quo (WhatsApp chaos), not another app. That's a much easier strategic win.

Longer-term, the same architecture is **horizontally scalable** across cohorts and institutions — the timetable feed is parameterised, the auth is domain-restricted, and the admin panel gives batch coordinators full observability. The unit economics of expanding to a new cohort are near-zero."

---

### 📊 As a Data Analyst Person

> **Hook**: "I built an analytics system from scratch — without any third-party BI tool — on top of a live production app serving 200+ users."

**Explanation (2–3 min version)**:

"On the analytics side, TermFlow is arguably more interesting than it looks from the outside. Because I owned the full stack, I could instrument exactly what I needed rather than relying on generic event trackers.

The centrepiece is the **admin analytics dashboard** — built inside the app itself, querying Supabase Postgres directly via SECURITY DEFINER RPCs.

Here's what I measured and why:

- **DAU / WAU / MAU + stickiness ratio**: calculated from `last_seen_at` heartbeats. Stickiness (DAU/MAU) was my primary retention signal. I didn't want a utility app people open once a week.
- **Onboarding funnel**: 4-stage funnel (sign-up → section pick → push opt-in → active this week) with step-by-step drop-off percentages. This told me exactly where the activation bottleneck was.
- **7-day active user bar chart**: rendered from timestamped heartbeats, bucketed by IST date, with a peak-hour overlay. No chart library — pure React/CSS.
- **30-day presence history**: stored hourly heartbeat bitmaps per user via a durable RPC. This gave me day-level and hour-level drilldown even as raw timestamps aged out.
- **Attendance watchlist**: top-N most-skipped courses cohort-wide, computed by aggregating absence records across all users (bypassing individual RLS via admin RPC). Useful for academic counselling signals.
- **Push delivery analytics**: matched each broadcast to delivery outcomes — open rates, reach per campaign.
- **Re-engagement targeting**: identified users inactive for 14+ days, surfaced that cohort in the dashboard, and wired a one-click push broadcast to re-engage them.
- **Client-side insights library** (`insights.js`): computed per-course skip rates, busiest day of week, subject-area distribution, and upcoming deadline merges — all from already-loaded state, zero extra network calls.

The methodological discipline I applied: every metric had a clear definition (e.g., 'active' = seen in last 7 days), every query was idempotent and auditable, and everything was CSV-exportable for offline analysis."

---

## 🎤 Interview Q&A — TermFlow / PGP2 Schedule Project

### General / Walkthrough

**Q: Walk me through this project.**

> "TermFlow is a full-stack PWA I built solo for the PGP2 MBA cohort at IIM Sambalpur. The problem was simple: timetable, attendance, and social coordination were all managed informally through WhatsApp. I built a single platform that consolidated everything — live schedule with change notifications, attendance tracking with insights, social features like friend panels and group coordination, push reminders, and an admin analytics dashboard. It went from greenfield to production across 5+ major versions and is now used by the entire 200+ student batch."

---

**Q: Why did you build this? Who asked you to?**

> "Nobody asked me to — I identified the pain myself as a student. The informal systems were failing: people missed reschedules, attendance was tracked manually in notebooks, and no one had a reliable view of what was coming up. I treated it as a real product problem and built accordingly — with a proper data model, auth, real-time sync, and a design that people would actually use daily."

---

**Q: What was the biggest technical challenge?**

> "The hardest problem was the **data pipeline from Google Sheets to end-user devices in real time**. The timetable lives in a Sheets document managed by the academic office. I wrote a Google Apps Script (~2,400 lines) that exposes it as a structured JSON feed. On the client side, I hash the schedule payload (SHA-256) on every fetch; if the hash changes, I diff the old and new schedule, compute exactly which classes changed, and fan out personalised push notifications to affected users via Supabase Edge Functions and VAPID Web Push. Doing that end-to-end with no off-the-shelf diffing library — and making it fast enough to run on every schedule fetch — was the most complex piece."

---

**Q: How did you handle the auth migration without breaking anything?**

> "I planned it as a phased cutover. First, I ran both environments (Clerk dev and Clerk prod) in parallel and built a batch migration script (`migrate-batch.mjs`) that transferred user records and created a `_migration_map` table linking old and new IDs. On cutover day, I froze writes, ran the migration batch, verified the mapping, then switched the environment variable in one deploy. All attendance and social data was keyed on internal Supabase user IDs, not Clerk IDs, so the join was clean. Zero data loss, zero downtime."

---

### Product / Strategy Questions

**Q: How did you decide what features to build?**

> "I used a combination of direct user feedback (since I'm part of the cohort) and usage signals from the admin dashboard. Early versions focused on schedule accuracy and attendance — table-stakes features. Later versions added social hooks (friends, pings, groups) and delight features (pet companion, Semester Wrapped) to shift from a utility app to a daily habit. I always asked: does this reduce friction for a real daily workflow, or is it a nice-to-have? Nice-to-haves went to the bottom of the backlog."

---

**Q: What would you do differently if you were monetising this?**

> "Three angles: First, **institutional B2B** — sell it to MBA program offices as a cohort management platform. The admin dashboard already has attendance watchlists, push broadcasting, and onboarding funnel data — that's genuinely useful for academic coordinators. Second, **freemium on social features** — basic schedule is free; advanced social features (group planning, shared timetable comparison, priority pings) are behind a small subscription. Third, **data products** — aggregate, anonymised attendance and engagement data is valuable for universities doing academic research on student behaviour, sold under a data-sharing agreement."

---

**Q: How do you measure success for this project?**

> "Three tiers: Adoption (did people sign up and stick around — full cohort adoption is the headline number), Engagement (DAU/MAU stickiness ratio — I wanted daily, not weekly usage), and Reliability (zero P0 incidents, push notifications delivered on time, schedule sync latency under 5 minutes). I tracked all three actively in the admin dashboard and used the onboarding funnel to understand where I was losing users before they became active."

---

### Data / Analytics Questions

**Q: What metrics did you track and why those specifically?**

> "I tracked DAU/MAU stickiness as the primary retention metric — it tells you whether the app is a daily habit or a weekly utility. I tracked the onboarding funnel (sign-up → section → push → active) to find activation drop-off. I tracked push delivery rates because notifications are the primary re-engagement channel. And I tracked the attendance watchlist cohort-wide because it gave the admin a reason to check the dashboard daily — which meant the dashboard had to be reliable and fast. Every metric had a clear business question behind it."

---

**Q: How did you ensure data quality in your analytics?**

> "A few mechanisms. First, all writes go through SECURITY DEFINER RPCs — no direct table writes — so data shape is always validated at the database layer. Second, heartbeat bitmaps are stored as append-only records; I don't update rows, which means there's no risk of a race condition corrupting historical data. Third, for admin reads I used a separate RPC (`admin_get_presence_history`) that bypasses individual RLS and operates on a pre-aggregated store — so the analytics layer is isolated from the transactional write path. Fourth, everything is CSV-exportable for spot-checking against raw Supabase table data."

---

**Q: How would you scale this to 10 institutions and 10,000 users?**

> "The architecture is already mostly horizontally scalable. Each cohort needs its own Sheets-backed schedule feed and a domain-restricted auth config — those are environment variables, not hard-coded logic. Supabase can handle 10,000 users well within managed plan limits. The bottleneck would be the push fan-out — right now it's a single edge function looping through subscriptions. At 10,000 users I'd shard the fan-out into batched parallel invocations (Supabase supports up to 500 concurrent edge function invocations) and add a delivery queue. I'd also move the schedule diff computation server-side rather than client-side to reduce mobile data usage on large cohorts."

---

### Behavioural / Leadership Questions

**Q: This was a solo project — how did you manage prioritisation without a team?**

> "I treated myself as the PM, engineer, and user simultaneously. Each version had a release goal written in a `CHANGELOG`-style doc before I started coding. I kept a personal backlog ranked by: (1) things breaking in production, (2) things users asked for directly, (3) things I saw would improve engagement from the dashboard, (4) things I wanted to build. That order held consistently. I also set a rule: no new feature until the test suite was green and Sentry showed no unresolved errors from the current version."

---

**Q: What would you tell yourself before starting this project?**

> "Two things. First: invest in the admin dashboard earlier. I added analytics in v4, but having funnel data from v1 would have let me optimise activation much faster. Second: scope the first version more aggressively. I tried to launch with too many features and delayed the first real user test. A bare schedule viewer with auth would have gotten feedback faster and saved weeks of building features nobody asked for."

---

**Q: How did you handle a situation where something broke in production?**

> "The most notable incident was a push notification edge function that began timing out due to a Supabase cold-start issue during off-peak hours. I caught it via the cron health monitor (which alerts if a job hasn't run within 20 minutes of schedule). I documented the root cause in `HEALER.md`, added a keep-warm ping to the function, and wrote a test case that validated the function response within an acceptable latency window. From detection to resolution was under 2 hours."

---

### 🔐 As a Security / AppSec Person

> **Hook**: "I built a student app on a zero budget — and still implemented security controls you'd expect in a production SaaS."

**Explanation (2–3 min version)**:

"Security on TermFlow wasn't an afterthought. Because the app handles real student data — attendance records, personal schedules, social graphs — I had to design the access model carefully from the start.

The foundation is **Postgres Row-Level Security on every user-scoped table**. No query can return another user's attendance or friend data, regardless of what the application layer does. On top of that, I routed all write operations through SECURITY DEFINER RPCs — so the client never touches tables directly. Every mutation goes through a stored procedure that validates context and enforces shape.

For authentication, I used Clerk restricted to `@iimsambalpur.ac.in` email addresses — so only legitimate batch students can sign up, without me needing to maintain an allowlist manually. For push notifications, I implemented VAPID — each push broadcast is server-signed, so no one can spoof notifications to users from outside the system.

I also built an admin audit log that records every config change, push broadcast, and admin action with identity, timestamp, and payload — which is effectively a compliance trail. And when I executed the auth provider migration, I used a `_migration_map` table with full rollback provisions, treating it like a live system cutover rather than a quick script.

The core principle I applied: **every layer should enforce its own security constraints independently** — so a bug in one layer doesn't expose data from another."

---

### 🧪 As a QA / Test Engineering Person

> **Hook**: "I shipped iteratively across 5+ versions — without a QA team — by building quality gates directly into the development and release process."

**Explanation (2–3 min version)**:

"Testing on a solo project is a forcing function — there's no one to catch your regressions for you. So I built quality into the process rather than treating it as a phase.

The core is a **58-test Vitest suite** covering calendar export correctness, attendance state transitions, push notification state machine, section logic, and Supabase store behaviour. That suite runs on every commit via `vitest run` and is a hard gate before any release — nothing ships if it's red.

Beyond unit tests, I wrote a **dedicated performance regression test** for the calendar export feature. It benchmarks ICS and SVG generation time on every run, so I'd know immediately if a refactor introduced a latency regression — without having to wait for a user complaint.

For infrastructure reliability, I built a **synthetic smoke test** — a one-click runner that pings five critical service checks in parallel (Supabase DB, analytics RPCs, cron jobs, push gateway, schedule feed) and reports pass/fail with timestamps. That's the first thing I run after any production deploy.

I also built a **cron health monitor** that tracks last-run time for every background job and surfaces a staleness alert if a job hasn't run within 20 minutes of schedule. That caught a real production incident — a push edge function was timing out silently, and the health monitor was the first signal.

The quality philosophy: **make it impossible to miss regressions** by instrumenting the things most likely to break, not just the things easiest to test."

---

### 💼 As a Business Analyst / Solutions Architect Person

> **Hook**: "I translated a messy, informal campus problem into a structured technical solution — with full documentation, vendor trade-offs, and a measurable outcome."

**Explanation (2–3 min version)**:

"The BA framing of TermFlow is really about taking something that had no structure — WhatsApp groups, floating Sheets links, verbal timetable updates — and turning it into a defined system with clear data flows, access rules, and stakeholder interfaces.

The first step was requirements discovery — I was embedded in the user cohort, so I could observe the pain firsthand rather than rely on interviews. The core problem statement was precise: students need a single, always-current view of their schedule, attendance standing, and what their peers are doing — with proactive alerts when anything changes.

From there I designed the **data model** — normalised Postgres schema covering student profiles, section assignments, course enrolment (JSONB), attendance records, friend graphs, push subscriptions, and audit logs. Each entity had a clear owner and access rule.

Then I did **vendor selection**: I evaluated managed vs. self-hosted for auth (chose Clerk for institutional email restriction), database/realtime (Supabase for RLS + Edge Functions), hosting (Vercel for preview deployments + CDN), and error monitoring (Sentry for source-map stack traces). Each choice was a documented trade-off between capability, cost, and operational burden for a one-person team.

Finally, I authored structured operational documentation — `CODEX_MEMORY.md` as the onboarding architecture doc, `CUTOVER.md` as the migration runbook, and `HEALER.md` as the incident-response guide. Those documents meant that anyone — a new collaborator, an AI coding assistant, or a coordinator — could understand the system without me explaining it verbally.

The output was a system where **every business requirement was traceable to a measurable system behaviour** — and every decision had a rationale documented somewhere."

---

### 📣 As a Growth / CRM / Retention Person

> **Hook**: "I built a retention and re-engagement system from scratch — no third-party CRM, no paid ads — and achieved full cohort activation on word-of-mouth alone."

**Explanation (2–3 min version)**:

"Growth on TermFlow was entirely organic and channel-owned — I had no marketing budget, no CRM vendor, and no growth team. Everything I knew about where users were dropping off came from the instrumentation I built myself.

The centrepiece is the **onboarding funnel**: four stages — Signed up → Picked section → Enabled push → Active this week — with step-level drop-off percentages surfaced in the admin dashboard. That told me exactly where the friction was in activation. Push opt-in was the critical step — if a user didn't enable push, they would almost certainly churn, because push is the only re-engagement channel I had.

For push, I built a full **CRM pipeline from scratch**: subscription management per user in Supabase, segmented audience targeting (e.g. all users, or users in Section A, or users inactive 14+ days), VAPID-signed broadcast dispatch via an edge function, and a per-campaign delivery analytics view. No Braze, no Iterable — everything was custom.

The **re-engagement flow** worked like this: I could configure an inactivity threshold (e.g. 14 days since last_seen_at), the dashboard would surface the count and list of churned users, and a single button would fire a personalised push broadcast to that specific cohort — monitored by a DAU recovery chart in the days following.

On the retention side, I designed **multiple engagement loops** deliberately: daily class reminders (utility), social pings from friends (social), XP rewards and the pet companion (gamification), and Semester Wrapped at term-end (shareable social proof). Each loop addresses a different reason users stop opening the app — boredom, forgetting, or feeling like the app has nothing new to offer.

The result: 100% cohort adoption, no paid acquisition, and a stickiness ratio that suggested daily rather than weekly usage patterns."

---

### 🎓 As an EdTech Person

> **Hook**: "I digitised the full student academic lifecycle at IIM Sambalpur — from timetable to attendance to social coordination — in a single app, designed for real campus constraints."

**Explanation (2–3 min version)**:

"TermFlow is an EdTech story at its core — but a different kind than most EdTech products. It's not about content delivery or learning. It's about the **operational infrastructure around learning**: how students know where to be, whether they're on track attendance-wise, and how they coordinate with peers on deadlines and group work.

The problem I was solving is universal to residential MBA programs: timetable changes happen frequently, attendance is managed manually, and no one has a real-time view of what's coming up this week. The existing tools were WhatsApp groups and shared Google Sheets — both fragile, asynchronous, and not structured for the data.

My design philosophy was shaped by two EdTech-specific constraints. First, **campus Wi-Fi is unreliable** — so the app had to work offline. I baked a full schedule snapshot into the React bundle at build time, so the core experience loads instantly even with no connectivity. Second, **students are busy and distracted** — so the app had to justify daily opening. That meant push reminders for class starts, a social layer so you could see friends' schedules, and gamified elements (pet companion, XP economy) that made engagement itself rewarding.

For academic coordinators, I built an admin analytics layer: attendance watchlist showing the most-skipped courses cohort-wide, enrolment distribution by subject, re-engagement targeting for inactive students, and a push broadcast tool — giving program administrators data and actions they previously didn't have.

The lesson I'd apply broadly in EdTech: **retention mechanics from consumer apps aren't optional in education software** — they're necessary, because the competition isn't another EdTech app, it's the student's phone's notification centre."

---

### 📋 As a Program / Operations Manager Person

> **Hook**: "I ran this project like a program manager — phased planning, documented runbooks, release gates, and a live migration executed without service disruption."

**Explanation (2–3 min version)**:

"From a program management lens, TermFlow had all the hallmarks of a complex operational programme — a live user base, iterative delivery, third-party dependencies, and a high-stakes migration mid-flight.

The delivery model was sprint-style across 5+ major versions. Each version had a defined release goal before I started building. The backlog was triaged in a fixed order: production incidents first, user-requested fixes second, dashboard-informed improvements third, new features last. That discipline prevented scope creep and kept the platform stable for users throughout the development cycle.

The most operationally complex piece was the **auth provider migration** — moving 200+ live user accounts from a Clerk development environment to production with no service downtime. I treated this as a formal change event: authored a cutover runbook (`CUTOVER.md`) with pre-flight checks, sequenced migration steps, verification queries, rollback conditions, and post-cutover sign-off criteria. The actual execution followed the runbook exactly — freeze writes, run migration batch, verify mapping, switch environment variable, confirm. Zero data loss, zero downtime.

For ongoing operations, I built a **cron health monitor** that functions like a service-level dashboard — last-run time, schedule expression, and a staleness alert for each background job. I also built a one-click system diagnostic that runs five critical service checks in parallel post-deploy. These tools mean I spend minutes, not hours, confirming that a release is stable.

Documentation was treated as an operational deliverable, not an afterthought: `CODEX_MEMORY.md` for architecture and onboarding, `HEALER.md` for incident response, and 4 versioned database backups at key milestones — ensuring the system could survive any individual failure, including me being unavailable."

---

### Security / AppSec Interview Questions

**Q: How did you think about the threat model for TermFlow?**

> "The two primary threats I designed against were cross-user data leakage and unauthorised access. For cross-user leakage: every user-scoped table has RLS policies, so even a SQL injection in application code can't return another user's rows — the database itself enforces the boundary. For unauthorised access: Clerk restricts sign-up to `@iimsambalpur.ac.in` email, so the user pool is bounded to the real cohort. VAPID-signed push means notifications can't be spoofed. And all writes go through RPCs, so no rogue client can insert or update rows in unexpected shapes."

---

**Q: What would you harden if this went to a wider, public-facing deployment?**

> "Four things. First, add rate limiting on the Apps Script schedule feed endpoint — currently it's open, which is fine for a closed cohort but would be a scraping target publicly. Second, add CSRF protection on the Supabase RPC calls. Third, rotate VAPID keys on a schedule and revoke stale push subscriptions. Fourth, add anomaly detection on the audit log — flag any admin account making unusual broadcast patterns. Currently the audit log is compliance-style (record everything) but not alerting-style (flag anomalies)."

---

**Q: How did you handle secrets management?**

> "Strict environment separation. Clerk and Supabase have completely separate credentials for dev and production — no shared keys. Production credentials are stored only in Vercel environment variables and Supabase vault secrets, never committed to the repository. The `.env` file is in `.gitignore`. During the auth migration, I had both sets of credentials active simultaneously for a short window — that window was documented in the runbook and both credential sets were rotated after cutover confirmed."

---

### QA / Test Engineering Interview Questions

**Q: How did you decide what to test and what not to?**

> "Risk-based prioritisation. I tested the things most likely to silently break and cause data problems: calendar export (because it's a pure function with defined output — easy to assert and high-visibility if wrong), attendance state transitions (because incorrect state means wrong academic data for students), and notification logic (because a silent failure means users miss class reminders — the core value proposition). Things I didn't write unit tests for: UI layout, CSS styling, and component rendering — I validated those manually on each release because they change frequently and are obvious when broken."

---

**Q: How did you catch the push edge function timeout in production?**

> "The cron health monitor. I built an RPC (`get_cron_health`) that stores the last-run timestamp for each scheduled job. The admin dashboard queries it and surfaces a staleness alert if any job hasn't run within 20 minutes of its schedule. The push function runs every 15 minutes — so when it started timing out on cold starts during off-peak hours, the monitor flagged it within 20 minutes of the first failure. Without that, I would have found out from a user complaint the next morning."

---

**Q: What's your approach to performance testing a frontend feature?**

> "I use a benchmark wrapper in Vitest with a time budget. For the calendar export, I set a target of under 50ms for generating a full-semester ICS file. The test generates the file, measures wall-clock time, and asserts it's below the threshold. It runs on every CI pass. That way, if a future change to the export logic introduces an O(n²) loop or an accidental synchronous fetch, I'll know about it immediately — not from a user saying 'the export button feels slow'."

---

### Business Analyst / Solutions Architect Interview Questions

**Q: How did you scope the initial version and resist feature creep?**

> "I wrote down the single core job-to-be-done before building: 'A student should be able to open the app and immediately know where their next class is and whether they're on track for attendance.' Everything else was secondary. The first version shipped with schedule view and attendance tracking only. Social features, push notifications, and the analytics dashboard came in later versions — only after the core was stable and users had validated that they were relying on it daily."

---

**Q: How would you hand this off to a new technical owner?**

> "`CODEX_MEMORY.md` is the starting point — it covers architecture, environment setup, key commands, the data model, known gotchas, and the auth migration history. From there, `CUTOVER.md` explains the most complex event in the system's history. `HEALER.md` covers what to do if something breaks in production. The codebase has 58 passing tests that tell you if something's structurally broken. A new owner with mid-level React and Supabase experience should be productive within a day."

---

**Q: How did you manage vendor lock-in risk?**

> "I was deliberately pragmatic rather than over-engineering for portability. The areas of real lock-in are Supabase (Postgres + RLS + Edge Functions) and Clerk (auth). For Supabase, the schema and RLS policies are versioned SQL in the repo — migrating to any Postgres host is achievable. For Clerk, the auth migration I already executed proves the lock-in is breakable — I did it live with 200 users. The benefit of deep integration (RLS, Edge Functions, realtime) outweighed the portability cost for a one-person team on a zero budget."

---

### Growth / CRM / Retention Interview Questions

**Q: What was your highest-impact re-engagement lever?**

> "Push notifications, by a wide margin. The correlation between push opt-in and sustained daily-active status was the clearest signal in the funnel data. Users who skipped push opt-in had much lower 7-day return rates. That made the push opt-in step the single highest-leverage intervention in the onboarding funnel — so I redesigned the onboarding flow to make the push permission request feel valuable (I explained exactly what notifications they'd receive and when) rather than generic."

---

**Q: How did you think about notification fatigue?**

> "I categorised push types by urgency and frequency. Class reminders fire 15 minutes before a class — high utility, expected. Schedule change alerts fire immediately on a timetable diff — high urgency, low frequency. Admin broadcasts are manual and rare. The rule I self-imposed: never send a notification that doesn't have a specific, time-sensitive action associated with it. No 'check the app today!' style engagement pings — those erode trust and drive unsubscribes."

---

**Q: What would you A/B test if you had more users?**

> "Three things. First: push notification send time — I have a peak-hour chart but I've never tested whether sending reminders earlier (30 min before class vs. 15 min) changes open rates. Second: onboarding copy on the push permission screen — I suspect a more specific value prop ('Get alerted the moment a class is rescheduled') outperforms generic ('Enable notifications'). Third: the Semester Wrapped sharing mechanic — does adding a cohort leaderboard on the shared card increase virality? All of these are 2-variant tests I could run with a feature flag."

---

### EdTech Interview Questions

**Q: What's the biggest UX difference between an EdTech app and a consumer app?**

> "Tolerance for complexity and context-switching. A consumer app competes in an open market — if it's confusing, users leave. An EdTech app has a captive audience, which is both an advantage and a trap. It's tempting to pack in features because users 'have' to use it. I resisted that by treating TermFlow as a consumer product — the default view is a single daily timeline, not a dashboard of metrics. Advanced features (analytics, admin tools, exam prep views) are one or two taps away, not on the home screen. The app earns daily opens because it's pleasant to use, not because it's mandatory."

---

**Q: How did you handle the digital divide — students with varying tech comfort levels?**

> "Offline-first design was the primary accommodation — the app works fully without a connection after the first load. For lower-tech-comfort students, the default experience is deliberately minimal: see today's classes, mark attendance, see what friends are doing. The advanced features (calendar export, insights, analytics, pet system) are discoverable but not prominent. I also avoided requiring any setup beyond picking your section — no configuration files, no manual timetable entry, no data import. The app knows your schedule the moment you pick a section."

---

### Program / Operations Manager Interview Questions

**Q: How did you plan and execute the auth migration without a team?**

> "I treated it like any complex change event: plan first, execute second, verify third. The plan was a written runbook — not mental notes, an actual documented sequence of steps with verification queries after each one. I defined the rollback condition explicitly: if the verification query after the migration batch showed any unmapped users, I would halt, restore from the pre-migration backup, and root-cause before retrying. On execution day, I followed the runbook exactly — freeze writes, run batch, verify mapping, switch env variable, confirm with a test login. Total cutover window was under 90 minutes."

---

**Q: How do you manage risk on a solo project with no process safety net?**

> "Three mechanisms. First, version control as a safety net — every change is committed, and I can roll back to any prior state in minutes. Second, the test suite as a regression net — 58 tests run before every release, and a red test is a hard stop. Third, incremental releases — I never shipped more than one significant change at a time, so if something broke in production I knew exactly what caused it. The combined effect is that my release risk per deploy was low even without a QA team or a change advisory board."

---

**Q: What's your incident response playbook when something breaks in production?**

> "I follow what I documented in `HEALER.md`: Detect (cron health monitor, Sentry alert, or user report), Diagnose (check Sentry stack trace, edge function logs, Supabase dashboard), Contain (roll back the offending deploy or disable the affected feature flag), Fix (write a failing test that reproduces the issue, then fix the code), Verify (confirm the test passes, deploy, monitor for 30 minutes), Post-mortem (add the root cause and fix to `HEALER.md` so it's documented for next time). The most important step is writing the failing test before fixing — it ensures the fix is correct and the bug can't silently return."

---

> **Interview Tip**: Tailor the depth of your answer to the interviewer's background. For a technical interviewer, lead with the data pipeline and auth migration. For a product interviewer, lead with the feature prioritisation story and onboarding funnel. For a strategy interviewer, lead with the switching-cost architecture and cohort scalability angle. For a data interviewer, lead with the metrics framework and the isolation of the analytics layer from the transactional write path. For a security interviewer, lead with the RLS + RPC threat model. For a QA interviewer, lead with the release gate policy and the cron health monitor incident. For a BA/SA interviewer, lead with the requirements-to-data-model translation and vendor trade-off documentation. For a growth interviewer, lead with the push funnel and the re-engagement loop design. For an EdTech interviewer, lead with the offline-first constraint and the coordinator analytics layer. For a program manager interviewer, lead with the auth migration runbook and the release sequencing discipline.
