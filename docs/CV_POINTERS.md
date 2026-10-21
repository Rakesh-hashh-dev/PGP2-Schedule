# CV Pointers — TermFlow / PGP2 Schedule

Reviewed on **4 October 2026** against the current local application, a fresh test run, project records, and the signed-in production app at https://pgp2.termflow.tech/.

> Choose 3–5 role-relevant bullets. Use verified figures with their period and definition. Estimates below are explicitly hypothetical. The previous draft is preserved in `archive/CV_Pointers.before-review-2026-10-04.md`; its unsupported claims should not be reused.

## Verified quantitative evidence

### Live application — 4 October 2026, approximately 11:20 AM IST

| Metric | Value | Definition / limitation |
|---|---:|---|
| Eligible PGP2 cohort | **304 students** | Owner-confirmed in this review. |
| Registered production profiles | **206** | Admin Tools → Users. Source filters development IDs, but the directory includes the owner/admin profile despite the summary tooltip saying admins are excluded. Not 206 verified non-admin students. |
| Indicative registration reach | **67.8%** | 206 / 304 × 100 = 67.76%. Approximate profile-to-cohort ratio; reconcile admin/test/duplicate accounts before claiming exact student adoption. |
| Profiles with saved course setup | **206/206** | Current setup completion among registered profiles. Not 100% cohort adoption or behavioural activation. |
| Active profiles, 30 calendar days | **134** | Durable presence, **5 September–4 October 2026**; current day incomplete. **65.0%** of registered profiles; **44.1%** relative to the 304-student cohort, subject to identity reconciliation. |
| Active profiles, 7 calendar days | **86** | Durable Weekly Presence, **28 September–4 October**; current day incomplete. **41.7%** of registered profiles. |
| User-days, same 7-day period | **449** | 64 + 64 + 74 + 66 + 59 + 67 + 55 daily unique-profile counts. These are not sessions or distinct users. At the earlier 11:15 AM observation the total was 281. |
| Mean active days per weekly active profile | **5.2** | 449 / 86 = 5.22 days in the observed period; repeat-day usage, not retention. |
| Highest daily activity that week | **74** | **30 September**, not an all-time peak. |
| Active today, partial day | **29** | Since midnight IST on 4 October, measured around 11:20 AM. Not a completed-day or rolling-24-hour DAU. |
| Previous week's unique active profiles | **96** | Adoption Trends, **21–27 September**. Current partial-week count does not establish growth. |
| Attendance-action usage | **107 student-days** | Daily unique users performing attendance marks, summed across **28 September–4 October**. Not 107 distinct users or total marks. Tracking introduced in late September; previous-week zero is not a growth baseline. |
| Announcement-view signal | **19 student-days** | Same week. Tracker fires on entering the notifications view; not proof of reading particular announcements. |
| Calendar-export usage | **0 recorded student-days** | Same week. Recent instrumentation cannot establish lifetime usage. |
| Active push devices | **12** | Header device count; Users separately reports push reach 0. Reconcile identities/subscriptions before calculating unique-user opt-in. |
| Active share codes / pending friend pings | **106 / 200** | Record inventories, not unique social users, accepted referrals, or completed interactions. |
| Live timetable feed | **698 class records** | Successful schedule-sync log; feed scope can change. Not 698 classes per student. |
| Scheduled jobs / self-test checks | **5 / 7** | Production Insights interface. Cron success alone does not prove end-to-end delivery. Self-test was not run in this review. |
| Recorded feedback | **7 items; all marked resolved** | Read in Users → Feedback triage → All; actual selected statuses checked. **6 owner-submitted reports and 1 other-student report**, not seven independent customer responses. |
| Feedback reply tracking | **7 closed with no recorded reply** | The response-tracking panel; absence of recorded timestamps does not establish whether older replies were sent. No response-time or satisfaction result can be calculated. |

**Metric discrepancies:** Users reports **67 profiles active within a rolling 7 × 24-hour window**; durable Insights reports **65 over seven IST calendar dates**. Use one definition consistently. The UI's “18% stickiness” used a partial-day numerator, so it is not a headline CV claim. Current source and UI label some calendar-date metrics as rolling windows.

### Current local implementation and tests

| Metric | Verified value | Scope |
|---|---:|---|
| Test suite | **437 passing tests / 42 files** | Fresh `npm test`, 4 October 2026; includes existing uncommitted local additions. Does not prove CI enforcement on every release. |
| React component source files | **87 JSX files** | Recursive `src/components` count excluding tests; file count, not unique features or remotely deployed components. |
| Edge Function implementations | **10** | Local directories with `index.ts`; not a fresh remote deployment inventory. |
| SQL migration/setup files | **44** | Local `supabase/migrations/*.sql`; not 44 independently deployed feature migrations. |
| Current version | **6.3.9** | Package and live app. Version numbers do not prove a count of major releases. |
| Earliest recorded Git commit | **15 June 2026** | Repository history; not definitive first-development or launch date. |
| Calendar export benchmark | **1.883 ms / 6.793 ms** | Timed `buildICS` on filtered synthetic datasets starting with 100 / 1,000 classes; excludes filtering and browser download time. |

### Historical evidence

- **12 July 2026 cutover:** `CUTOVER.md` records **100 development accounts** exported into the bridge and a pre-cutover backup containing **1,805 attendance rows**. Initial batch remapped **9 profile friend-reference entries with 0 reported failures**; remaining users self-migrated on first production login. This does not prove 200+ migrated accounts, zero downtime, or zero data loss.
- **Aftercare:** `HEALER.md` lists **41 numbered batch runs through 12 August 2026**, each with **0 reported failures**. Approximate migrated totals and narrative wording vary; no final reconciled migration count is asserted.
- **12 July local signed-out performance:** desktop Lighthouse **94/100**, FCP **0.5 s**, LCP **1.5 s**, CLS **0**; simulated mobile **65/100**, LCP **5.9 s**. Historical sign-in-screen tests, not current signed-in production measurements.
- **Historical Sentry chunk reduction:** **51.37 → 27.88 kB gzip = 45.7% reduction**, as documented in `docs/performance_report.md`. Confirm personal contribution before using this achievement. Not a 45.7% whole-app bundle reduction.
- Omit the report's “16.45 ms average response” load-test claim: total concurrent batch duration divided by request count is not measured per-request latency.

## Product Management / Product Strategy

- **Built and operated TermFlow**, an academic productivity PWA at IIM Sambalpur with **206 registered production profiles against a 304-student cohort**—approximately **68% registration reach**.
- **Integrated timetable, attendance, course workspaces, deadlines, and social coordination**, supporting **138 active profiles over 30 calendar days** as of 4 October 2026.
- **Built a presence analytics dashboard** recording **86 weekly active profiles and 449 user-days**, equivalent to **5.2 active days per weekly active profile**, over 28 September–4 October.
- **Instrumented three feature-action signals**—attendance marking, calendar exports, and announcement-view visits—alongside setup completion and durable daily presence.
- **Designed a personal academic planner with seven sections** spanning priorities, attendance forecasts, workload, calendar, changes, sync, and insights.

Use “sole owner” or “built independently” only after confirming ownership and assistance. Feature availability does not itself establish feedback-led prioritisation.

## Data Analytics / BI / Data-Driven PM

- **Built an in-app analytics dashboard** spanning active usage, feature actions, self-mark attendance coverage, notification diagnostics, and operational health for a **206-profile production application**.
- **Implemented durable IST daily presence**, with per-user daily records and hourly heartbeat counts; admin reporting supports **1–90-day query windows**.
- **Instrumented three feature actions**, recording **134 attendance-action student-days** and **28 announcement-view student-days** over 28 September–4 October.
- **Built course-and-section coverage reports**, distinguishing enrolled profiles, saved marks, and watch signals among profiles with at least **three marks**.
- **Implemented dispatch diagnostics for the latest 25 admin push broadcasts**, separating provider success, missing subscriptions, preferences, quiet hours, expiry, endpoint rejection, provider errors, and unknown outcomes.

## Management Consulting / Business Analysis

- **Translated fragmented academic coordination into a deployed digital product**, combining timetable, attendance, deadlines, and social planning with **206 registered production profiles**.
- **Structured a Google Sheets-to-app workflow** serving **698 timetable records**, with schedule-change detection and targeted notification infrastructure.
- **Developed a metrics framework** separating registration, setup completion, active usage, feature actions, and notification devices.
- **Planned an auth cutover around a 100-account development limit**, using a data bridge, backup, verification steps, and on-login migration aftercare.

## General Management / Strategy

- **Owned product and technical implementation for TermFlow**, spanning student workflows, analytics, backend integration, and operational controls for **206 production profiles**; confirm ownership wording.
- **Combined student planning with administrative workflows** for audience targeting, feedback triage, attendance coverage, incident handoffs, and audit history.
- **Built a managed-service architecture** with **10 locally implemented Edge Functions** and production visibility into **five scheduled jobs**.
- **Operated with owner-reported negligible running cost**, using managed infrastructure; exact ₹/month and cost per active user remain unverified.

## Entrepreneurship / Product Startups

- **Created TermFlow**, a student productivity platform reaching **206 registered production profiles** with **134 active profiles across the observed 30-day period**.
- **Expanded beyond timetable viewing** into course workspaces, personal planning, social coordination, expense splitting, and a gamified companion.
- **Built usage instrumentation and operations tooling** to support feature analysis, inactive-profile targeting, feedback follow-up, and notification diagnostics.

Acquisition channels and paid spend are unverified. Registration alone does not establish organic growth, product-market fit, network effects, or a moat.

## Marketing / Growth / CRM / Retention

- **Built activity segmentation and re-engagement tooling** for a **206-profile application**, with configurable inactivity thresholds and targeted push audiences.
- **Tracked 86 weekly active profiles and 449 user-days** in the observed week, providing a baseline for future engagement experiments.
- **Measured three feature-action signals**, distinguishing daily unique users from repeat-day activity and device subscriptions.

Do not claim campaign lift, notification opens, referral conversion, or improved retention without observed results and a valid baseline/control.

## EdTech / Education Technology

- **Built an academic coordination PWA** spanning timetable, attendance, coursework, deadlines, and exams for a **304-student cohort**, with **206 production profiles** registered at review.
- **Delivered course-specific planning**, surfacing upcoming classes, pending tasks, skip buffers, and recovery estimates from student-saved data.
- **Built self-mark attendance coverage and watch reports**, using an **80% early-watch signal** among profiles with at least **three marks**, distinct from official attendance and course penalty rules.
- **Added offline resilience** through bundled schedule snapshots and caching; fresh cloud data and authenticated writes still require connectivity.

## Program / Operations Management

- **Documented and executed a phased auth cutover**, including a **100-account development export**, backup, verification, and on-login migration.
- **Maintained aftercare records across 41 numbered batch runs**, with **0 reported batch failures** through 12 August 2026.
- **Built visibility into five scheduled jobs** and a diagnostic interface exposing **seven checks**.
- **Implemented feedback ownership, status/severity triage, response-target tracking, and incident handoffs**, with a **48-hour default response target**; configuration is not measured SLA attainment.

## Full-Stack / Product Engineering

- **Built a React 19 / Vite 8 PWA** integrating Clerk, Supabase, Google Sheets schedule ingestion, push notifications, and student planning for **206 production profiles**.
- **Implemented 10 Supabase Edge Functions** for dispatch, schedule diffs, class reminders, scheduled configuration, health, metrics, and migration.
- **Validated 437 automated tests across 42 files** in the current local checkout, covering scheduling, attendance, exports, notifications, social workflows, companions, and administration.
- **Automated prebuild snapshot generation**, providing a bundled schedule fallback when live requests fail.

## Frontend / React Engineering

- **Developed 87 React component source files** in the current checkout across scheduling, course workspaces, planning, social tools, companions, and administration.
- **Implemented shared navigation and phone/tablet V2 views**, with a **1,200 px boundary** and retained desktop navigation.
- **Built client-side ICS/SVG export**, measuring the local ICS generation step at **1.883 ms / 6.793 ms** for filtered synthetic datasets starting with 100 / 1,000 classes.
- **Integrated error monitoring and lazy-loaded views**, with historical evidence of a **45.7% Sentry gzip-chunk reduction**, subject to confirmation of personal contribution.

## Backend / Infrastructure Engineering

- **Implemented 10 Deno-based Supabase Edge Functions** for notifications, schedule processing, scheduled actions, health, metrics, and migration.
- **Designed user-scoped daily presence and feature-use stores**, with **three instrumented feature actions** and admin reporting.
- **Built push dispatch diagnostics for the latest 25 admin broadcasts**, retaining failure/skip categories and unknown legacy states.
- **Versioned 44 SQL migration/setup files**, alongside cutover and aftercare documentation.

## Platform / DevOps / Technology Management

- **Automated schedule snapshot and sitemap generation**, plus optional Sentry source-map upload within the Vite build.
- **Established a runnable regression suite with 437 currently passing tests**, lint tooling, and bundle visualisation.
- **Built production operations visibility for five scheduled jobs**, diagnostic checks, and timestamped session sync logs.
- **Designed a staged auth transition** with environment configuration, a user-ID bridge, backup procedures, and aftercare.

Tests and lint scripts do not establish enforced CI/CD quality gates. Historical backup files do not establish scheduled automatic backups.

## Mobile / PWA

- **Implemented an installable PWA** with shortcuts, update prompts, bundled snapshots, and Workbox caching.
- **Built V2 navigation for phone/tablet viewports up to 1,200 px**, retaining desktop/V1 above that boundary.
- **Added personalised greeting/weather views and mobile interaction utilities** alongside academic workflows.

Authentication is network-only; cached information can be stale. This review did not validate every page/device or current mobile performance.

## Security / AppSec

- **Implemented RLS and scoped RPCs** for user and admin workflows, including self-scoped presence recording and admin-only analytics.
- **Verified authentication identities in migration services** before remapping user data.
- **Built admin audit history and role-aware operational controls** for configuration, account, and support workflows.

Do not claim 100% RPC-only writes: feature-use instrumentation and other modules make direct table writes. The cutover runbook says institutional domain restriction was enforced in app code with the Clerk allowlist off. RLS, SECURITY DEFINER, and VAPID do not alone guarantee security or compliance. No current security audit or Git-history secret review was performed.

## QA / Test Engineering

- **Validated 437 tests across 42 files** in the current local checkout, covering transactional/date logic, exports, student workflows, admin utilities, and navigation logic.
- **Built synthetic calendar-export performance benchmarks**, isolating ICS generation from filtering/download behaviour.
- **Added regression coverage across attendance, notifications, scheduling, companion state, and admin workflows**.

Passing tests do not establish code coverage, zero regressions, device correctness, or uptime.

## User feedback analysis — recorded outcomes

The live app contains **seven feedback records, all marked resolved**. **Six were submitted by the project owner**, and only **one by another student**. Therefore this is an issue-tracking sample, not a seven-customer validation study.

| Theme | Items | What the records show |
|---|---:|---|
| Timetable accuracy / freshness | **2** | Wrong-day/stale schedule and a missing section-specific guest session. This supports prioritising feed freshness, day mapping, and section coverage. |
| Navigation / interaction | **3** | Bottom-navigation animation, transparent navigation, and notification swipe interaction. |
| Push reliability | **1** | A report that push notifications were not working. |
| Admin usability | **1** | A request to fix Admin Tools. |
| Total marked resolved | **7/7** | Status verified in the UI; no independent reporter confirmation, resolution timestamps, or before/after outcome established. |

**Defensible wording:** “Tracked seven issue reports across timetable accuracy, navigation, push reliability, and admin usability; all seven were marked resolved at review.”

For an MBA CV, the seven-record figure is weaker than adoption/active usage because most reports were self-submitted. Do not describe this as seven student interviews, 100% satisfaction, a 100% verified fix rate, or proven reduction in missed classes.

The response panel shows **seven closed items without a recorded reply timestamp**. Historical replies may predate tracking. Neither average response time nor SLA adherence can be calculated. No CSAT, NPS, or satisfaction survey result was found.

## Time-saving analysis — hypothetical workflow estimates

**These figures are a planning model, not measured user outcomes or CV-ready achievements.** Source/UI review shows that TermFlow consolidates steps; it does not reveal how long students previously took in WhatsApp/Sheets or how frequently they use each workflow.

| Task | Assumed manual baseline | Assumed app time | Illustrative saving | Workflow basis |
|---|---:|---:|---:|---|
| Find next class, room, and time | 60–120 seconds | 15–30 seconds | **30–105 seconds per lookup** | Today/Courses present the relevant class; manual baseline assumes finding a message or spreadsheet and filtering section/course. |
| Calculate attendance standing or recovery | 2–5 minutes | 10–30 seconds | **1.5–4.8 minutes per check** | Attendance/Planner compute percentages, skip buffers, and recovery scenarios from saved marks. |
| Find shared availability | 2–5 minutes | 15–45 seconds | **1.25–4.75 minutes per comparison** | Social timetable comparison reduces manual cross-checking; actual coordination may still need messages. |

The assumed times are judgement ranges, **not observations made in this review**. Attendance data-entry time and correctness, stale-feed risk, login friction, and personal commitments can reduce or eliminate savings.

**Illustrative aggregate model:** assuming **65 weekly active profiles**, **five timetable lookups each per week**, and **30–90 seconds saved per lookup**, estimated lookup savings would be:
- Low: `65 × 5 × 30 / 3,600 = 2.7 hours/week`.
- High: `65 × 5 × 90 / 3,600 = 8.1 hours/week`.

Lookup frequency and seconds saved are assumed. Presence heartbeats/user-days do not prove task completion. Do not extrapolate this scenario to all 304 students or claim it as realised savings.

**Measure before adding to the CV:** ask 10–15 students to complete matched timetable/attendance tasks with their usual workflow and TermFlow; counterbalance task order, record completion times and errors, and report paired median savings, sample size, dates, and task scope. Use observed task frequency separately for aggregate estimates.

**Until measured:** “Centralised timetable lookup and automated attendance calculations, reducing manual searching and arithmetic.” This describes workflow simplification without inventing a percentage.

## Suggested compact MBA / Product CV version

**TermFlow — Academic Productivity Platform | Product Development Project**

- Built and operated a PWA with **206 registered production profiles across a 304-student cohort**, representing approximately **68% registration reach**, integrating timetable, attendance, deadlines, and social coordination.
- Supported **138 active profiles over 30 calendar days** and developed presence analytics showing **86 weekly active profiles averaging 5.2 active days** in the observed week.
- Instrumented **three feature-action signals** and built setup, attendance coverage, targeted communication, and feedback workflows to support product decisions.
- Implemented **10 backend Edge Functions** and validated **437 automated tests across 42 files** in the current local application.

Usage period ends **4 October 2026**, with the final day incomplete. Counts include the owner/admin profile and require final account reconciliation for exact student-only adoption.

## Interview explanations — evidence-bounded

**Product impact:** “At review the app had 206 production profiles against a 304-student cohort. Durable activity showed 105 active profiles across 30 calendar dates. Weekly usage averaged 4.3 active days among 65 weekly active profiles. I have not yet measured time saved or demonstrated feature-caused retention improvements.”

**Feedback:** “The recorded queue contains seven resolved-status issues, six self-reported and one from another student. Their themes are timetable accuracy, navigation, push, and admin usability. That is evidence of issue tracking, not a broad customer-satisfaction study.”

**Analytics:** “I distinguish profiles, devices, daily unique feature users, and user-days. A latest-heartbeat timestamp cannot reconstruct historical activity, so daily presence is persisted. Weekly feature totals sum daily uniques rather than deduplicating users across the week.”

**Migration:** “The documented cutover began with a 100-account development export and a backup containing 1,805 attendance rows. Users migrated on first production login, with batches remapping stale references. Recorded batches reported no failures; final reconciliation and availability logs would be needed for zero-loss or zero-downtime claims.”

**Performance:** “The current local benchmark measured ICS generation at about 1.9 and 6.8 ms for filtered synthetic datasets starting with 100 and 1,000 classes. This is not full browser export latency. Historical signed-out Lighthouse was 94 desktop and 65 simulated mobile.”

**Cost:** “Running cost is negligible according to my current estimate; I would reconcile hosting, auth, database, monitoring, and domain expenses before claiming an exact rupee figure or zero cost.”

**Launch date:** Pending clarification. The owner supplied August 2027, which is after this review and conflicts with existing June/July 2026 usage/cutover records. Do not state a launch year or time-to-MVP until clarified.

## Remaining inputs / measurements

| Needed | Why |
|---|---|
| Correct first-launch date and distinction between pilot and broader rollout | August 2027 is future-dated; repo and feedback show activity in June/July 2026. |
| Student-only account reconciliation | Exact adoption requires excluding admins, tests, and duplicates and applying the 304-student eligibility scope. |
| Actual cost breakdown | “Almost negligible” does not establish ₹0, cost per MAU, or avoided spend. |
| Ownership/contribution confirmation | Code and records do not establish sole authorship or attribution of every optimisation. |
| Timed user task study | Required for measured time-saving claims. |
| Feedback resolution dates / reporter validation | Required for turnaround times, independently confirmed fix rates, or satisfaction claims. |
| Cohort-based retention and campaign comparison | Repeat usage and instrumentation do not establish week-4 retention or campaign lift. |
| Final migration record checks and uptime logs | Required for zero-loss/downtime claims. |

## Evidence and corrections to the previous draft

**Production review:** Admin Tools → Insights, Users → Feedback triage, Moderation audit summary; student Courses and Personal Planner. No messages, broadcasts, account actions, configuration saves, student-detail exports, or deployments were performed. Only aggregate findings and anonymised feedback themes are retained.

**Local sources:** package.json; AdminDashboard.jsx; AdminWorkflowPanels.jsx; adminWorkflow.js; featureUsage.js; navItems.js; App.jsx; CalendarExportModal.jsx; calendarExport.perf.test.js; vite.config.js; Edge Function directories; presence/feature-use/attendance-coverage/feedback-response/push-diagnostic migrations; CUTOVER.md; HEALER.md; performance_report.md; Git history; fresh test output.

- Replaced **200+ users / full-cohort adoption / 100% activation** with dated profile counts, activity, and setup definitions.
- Replaced **58 tests / 5 files** with **437 passing tests / 42 files**; replaced **60+ components** with **87 scoped JSX component files**.
- Retained **10 Edge Functions** as local implementation evidence.
- Removed **2,400+ Apps Script lines**: the root schedule script has **570 lines**, with a separate **135-line menu script**. Alternate copies should not be summed as unique work; line count is weak impact evidence.
- Removed **5+ major releases / 12+ months / one academic year**; version 6.3.9 and history since June do not substantiate these claims.
- Removed speculative migration/incident stories. HEALER.md documents migration aftercare, not a generic incident-response programme or evidence of a two-hour cold-start incident resolution.
- Removed unsupported near-zero latency, fully offline operation, automated milestone backups, guaranteed uptime, campaign lift, and compliance-grade claims.
- Removed unverified Vercel Speed Insights and automated IndexNow claims; current review supports Vercel Analytics, Sentry, and sitemap generation.
- Local code implements VAPID Web Push; production UI labels devices “FCM” and shows inconsistent user-level reach. Reconcile deployed implementation before claiming an FCM migration or unique-user opt-in.
- Changed the onboarding story to setup/activity/device signals: the current snapshot is not a timestamped sequential conversion funnel.

For every final metric retain: **scope → period → source → formula → personal contribution → limitation**. Refresh usage figures when submitting the CV; migration/performance results remain explicitly historical.
