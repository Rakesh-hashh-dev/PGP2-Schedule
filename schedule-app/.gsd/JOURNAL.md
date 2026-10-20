# Verification journal

## 2026-10-07 — Companion variety and lion redesign

User-approved scope: add Hoot, Byte, Pebble and Prickle; extend movements and
expressions for existing companions; redesign Lion after the user's follow-up.

- `npm.cmd test`: 45 files passed; 450 tests passed.
- Targeted ESLint on changed companion components, helpers, tests and preview
  scripts: exit 0, no errors or warnings.
- Production Vite build to `.local/pet-variety-build`: passed; PWA assets generated.
- Exact browser viewport checks: roster 1250px (168 previews), lion 1250px
  (14 previews), phone 390px (168 previews), and companion page 390px.
  All had no horizontal overflow. Motion-off previews had 0 running animations.
- OS reduced-motion case: 0 running animations across 168 previews.
- Inspected browser screenshots for the full roster, lion expressions/actions,
  new companions, wardrobe and phone companion page.
- `pet-sheet`: 1 lion x 16 moods rendered to `.local/lion-mood-sheet.png`.

Evidence: `.local/pet-browser-report.json`, `.local/pet-qa-roster.png`,
`.local/pet-qa-lion.png`, `.local/pet-qa-phone.png`, `.local/pet-qa-reduced.png`,
`.local/pet-qa-page-phone.png`. Previews use actual component art and CSS;
authenticated production interaction was not part of these offline checks.

Existing saved identities and progress retain their contract. No Git commit,
push or deployment was requested. Concurrent changes outside companion files
were preserved.

## 2026-10-07 — Prickle redesign and Luna asset review

Prickle now has a domed quill-covered back, cream pear-shaped face, clearer
nose, tiny paws and mint collar. Its saved key, Devotion 4 unlock and action
profile are preserved; wardrobe offsets follow the new face position.

- Targeted tests: 2 files passed, 26 tests passed.
- ESLint for `petExtras.jsx`: exit 0.
- Actual browser preview: 14 Prickle face/action/wardrobe tiles at 1250px;
  inspected `.local/pet-qa-prickle.png`.
- Roster and exact 390px previews: no overflow, 0 motion-off animations.
- Reduced-motion roster: 0 running animations across 168 previews.

Luna asset review only: `../luna all-states.gif`, 192 x 232 pixels, 114 frames
at 120ms/frame (13.68 seconds), 2,343,075 bytes, looping, no GIF transparency.
Frame contact sheet shows embedded state captions and an opaque pale backdrop.
The asset can be integrated after preparing clips/sprites for the individual
states, cleaning those baked-in presentation elements, and adding a static
motion-off pose plus raster-specific wardrobe placement. Luna was not added
by this review. Source file preserved. Evidence: `.local/luna-contact-sheet.png`.

## 2026-10-07 — Luna integration

User authorized adding the reviewed asset. Luna is now the 21st companion,
unlocking at Devotion 3 alongside Byte. All 114 supplied frames are retained in
nine transparent WebP strips, with captions removed and a separate still pose.
Prepared assets total 1,001,158 bytes. Source SHA256 remains
`f35720b660377ab8aa3a43c96a7c78764b3a78f81340ed404dedd812342fcd36`.

- `npm.cmd test`: 46 files and 453 tests passed.
- Targeted ESLint: exit 0.
- Production Vite build to `.local/pet-variety-build`: passed; all ten Luna assets
  copied into the build output.
- Isolated Chromium checks: desktop roster (187 tiles), Lion, Prickle, Luna,
  exact 390px Luna/roster/companion page, and reduced-motion Luna/roster passed.
  No horizontal overflow; motion-off and reduced motion had 0 running animations.
- Browser confirmed pet/play/treat care priority over mood and signature actions,
  actual sprite frame advancement, and exclusive still display with motion off.
- Inspected `.local/pet-qa-luna.png` and `.local/luna-mood-sheet.png` for supplied
  artwork, transparent backdrop, mood poses, running directions and wardrobe.

Evidence: `.local/pet-browser-report.json`, `.local/pet-qa-luna.png`,
`.local/pet-qa-luna-phone.png`, `.local/pet-qa-luna-reduced.png`,
`.local/luna-mood-sheet.png`. These are offline component/CSS previews;
authenticated production interaction was not tested. Changes remain local.

## 2026-10-07 — Tablet layout alignment

Restored the forced landscape icon rail while retaining the saved desktop
sidebar preference. Unified portrait navigation through 1200px for V1/V2,
including sidebar and dialog breakpoints. Feature pages use the full tablet
content width; Today/Tomorrow keep the week rail beside them only above 1100px.
Added tablet grid, header wrapping, attendance, planner, course, and expense
layout rules, and contained the Exams decorative aura within the page width.
Kept fixed dialogs anchored to the viewport without layout containment.

- Isolated Chromium: 18 destinations at five V2 tablet sizes (90 cases) and
  three V1 tablet sizes (54 cases), with no page horizontal overflow.
- Expanded panels: Attendance, Exams calendar, Courses detail, Planner forecast,
  Split ledger, Board composer and Admin users. Final expanded checks: 24 cases,
  zero document-width or loading failures, including 768x600 touch landscape.
- Dark/Aurora, Compare and Login checks: 16 cases, zero width/loading failures.
- Course, expense and Board dialogs plus Login: 12 final cases at 768x600,
  820x1180 and 1100x1366; inspected screenshots for viewport fit and centering.
- Resize 1440 -> 1024 -> 820 -> 1440 retained `pgp2.sidebar=expanded`, showed
  the compact rail in landscape tablet, and restored expanded desktop/V1.
- Phone 390px and desktop 1280/1440px checks: no document horizontal overflow.
- Functional suite: 45 files, 450 tests passed. The unrelated calendar export
  performance benchmark was excluded. Added the tablet sidebar control regression.
- Targeted ESLint: exit 0; App.jsx reports 11 hook warnings and zero errors.
- Production Vite build to `.local/tablet-build`: passed (2415 modules).
- `git diff --check`: passed.

Evidence: `.local/tablet-qa/{fixed,v1-tablet,expanded,final-expanded,dialogs,
dark-aurora,narrow-touch,boundaries}.json` and corresponding PNG screenshots.
Browser validation uses the bundled schedule and local fixture services; no
authenticated production changes were made. The initial Login readiness probe
used the wrong selector; corrected Login checks passed. Changes remain local.

## 2026-10-08 — Social planning and group upgrades

Implemented all six accepted additions: shared timetable gaps, pending responses,
shared pinned notes/links/messages, plan templates, durations/class-clash warnings
and bounded weekly repeats, and optional explained study-buddy preferences.
Explicit availability is separate from having no scheduled class. Existing
attendance Risk Watch changes were preserved.

- Full Vitest suite: 50 files, 473 tests passed, including ongoing four-hour plans,
  atomic series writes, failures, recurring dates, unknown schedules and preferences.
- Targeted ESLint across all changed/new Social JS and JSX files: exit 0.
- Production Vite build: passed, 2423 modules, PWA 116 entries.
- Isolated Chromium with actual Social components and production CSS: 1280, 820,
  390 and 320px widths; no horizontal overflow and no console/page errors.
- Browser interactions passed: RSVP, correct poll destination/voting, chat read
  cursors, message/custom pins and removal, group plan navigation, templates,
  explicit class-clash override, four weekly occurrences, preference save failure
  and retry, explained matches, explicit availability filter and persistent dismissal.
- Reviewed desktop/phone screenshots and checked phone dialog viewport containment.
- New SQL migration applied to disposable PostgreSQL 15 with minimal platform
  schema and auth roles. Membership/forged groups, ownership, safe URLs, own read
  cursors, monotonic/future-clamped reads, preference isolation/preservation,
  interval/series constraints and all-or-nothing inserts passed.
- `git diff --check`: passed. No dependency install, commit, push or production
  migration. Local QA browser uses mock services; signed-in production and real
  realtime delivery have not been verified.

Evidence: `.local/social-qa/report.json`, corresponding overview/group/friends
screenshots and `plan-clashes-viewport.png`; `.local/social-sql-bootstrap.sql`.
Cloud features require `20261008120000_social_workspace_upgrades.sql` to be
applied before release. The disposable QA database was removed after validation.

## 2026-10-10 — SplitCircle-inspired Split implementation, v7.3

Adapted the reviewed local SplitCircle flows to TermFlow's Clerk/Supabase
contracts. Added responsive workspace, itemized/OCR-assisted review, FX,
budgets, reviewed recurring bills, comments/history, secure invitations,
transactional/versioned writes, CSV import/export and ledger backup. Preserved
existing financial rows and account identities; migration remains unapplied.
Package metadata is 7.3.0 and visible version is v7.3.

- Full Vitest output: `Test Files 52 passed (52); Tests 492 passed (492)`.
- PostgreSQL output: `Completed 26 PostgreSQL migration and authorization checks.`
- Chromium output: `Completed 19 browser checks.` Screenshots cover desktop,
  tablet, phone, dark theme, ledger, insights and item/detail dialogs.
- Targeted ESLint: exit 0. Production Vite/PWA build and version metadata
  verified; full final build output saved under `.local/split-qa/`.
- `git diff --check`: passed.

Database checks include atomic rollback, invalid participants, immutable audit,
exact allocation, retry/import deduplication, recurrence anchors, author-only
edits, private preferences/receipts and revoked/single-use invites. Browser
checks include save-failure draft retention, keyboard focus containment, CSV,
receipt-text reconciliation, FX and pre-migration fallback/error reporting.
New tests prove invitation persistence/cleanup across login reloads.

No production migration, deploy, commit or push. Real signed-in Supabase,
OAuth redirects, realtime delivery and external OCR image recognition remain
unverified; browser used mocked services and SQL used disposable PostgreSQL.
Release instructions: `.gsd/split-circle/IMPLEMENTATION.md`.

## 2026-10-10 - Split staged production expansion and v7.3 frontend

Split expansion was applied alone to PGP2 Supabase and registered atomically.
Production counts/totals/anomalies and original grants, policies, active triggers,
receipt settings and legacy invitation function were verified unchanged. Feature
version 0 / phase expanded keeps advanced controls disabled. Social migration
remains deferred; normal db push now reports that older missing migration and
must not be used blindly. No commit/push was performed.

Consistent Split JSON and full schema/data/roles logical backups were saved in
ignored `.local/split-release/`, with checksums. Platform PITR is disabled and
no listed restorable platform backup was returned. Storage logical dumps contain
metadata, not bytes; Split had zero receipt objects at backup time.

- 26 PostgreSQL authorization checks and 14 staged restore/rollback checks passed.
- Production Split backup restored in isolated PostgreSQL 17.6; expansion,
  cutover, compatibility rollback and re-cutover passed.
- Isolated release: 48 files / 473 tests passed; local production build passed.
- Vercel production build passed: 2447 modules, 117 PWA entries.
- Version, app shell, OAuth callback shell, main/Clerk/Split bundles, manifest
  and service worker were checked on the prepared deployment before promotion.
- v7.3 deployment `dpl_6B1guGiS47b1NJyk2nJW6gc9pEr7` promoted. Existing
  production baseline was `6.3.9+5f8860a`; its commit matches the isolated source
  baseline. New metadata is `7.3.0+local`; previous deployment retained for rollback.

Deployment includes committed baseline plus Split edits only. Unrelated dirty
Social/Attendance/Vite changes remain locally untouched. Signed-in production
flows, realtime, storage upload and external OCR remain unverified. Browser
automation could not start its runtime; requested the user's live smoke check.
Stage B is unapplied and intentionally outside the automatic migration queue
until that gate passes. Documentation: `.gsd/split-circle/ROLLOUT.md`.

### Split rollout completion

User confirmed signed-in pages, existing Split, timetable and attendance work;
they did not perform a browser expense test. A production authenticated-role
transaction verified legacy and RPC write/edit/delete, exact shares, retries,
version conflicts, invalid inputs, outsider isolation and settlements; all test
rows rolled back. Fresh nine-table backup captured and hashed.

Stage B was promoted to `20261010020000_split_circle_cutover.sql` and applied
with a fresh-backup equality guard, bounded write locks and another rollback-only
smoke test inside the migration transaction. Atomic writes, audit, private
preferences, comments, revoked invites and denied legacy writes/join links passed.
All test rows rolled back before atomic migration registration/commit.

Final production checks: version 1 / active; private receipt bucket; expected
audit/group triggers and write revocations; all nine Split tables and receipt
metadata exactly preserved; financial counts/totals/anomalies unchanged. Both
Split migrations registered, Social absent. Live custom-domain metadata verified
`7.3.0+local`. Saved prior frontend deployment and compatibility rollback SQL.
Rehearsal containers removed by verified exact identity. Root ignore-file content
restored after Vercel metadata setup. No Git commit/push; user Social/Attendance
work preserved.

Remaining verification limits: actual browser expense cycle, realtime delivery,
receipt upload and external OCR downloads. SQL synthetic-role checks are not an
OAuth exchange or browser-to-API save. Evidence: ignored
`.local/split-release/final-verification.txt` and the linked logs/backups.


### 2026-10-13 cancellation and notification release completion

- Supabase API deployment verified ACTIVE: dispatch v5, send-push v12, dispatch-scheduled-pushes v5, class-reminders v15. Existing verify_jwt=false retained; handler authentication confirmed with four unauthenticated POST requests returning 401 Unauthorized. No notification broadcasts sent.
- Cancelled rows now show a diagonal cancellation band and faded native-disabled class actions in Timeline, Week Agenda and Full Schedule. Admin Room/Edit controls disable until Restore; recovery and visibility controls remain usable.
- Actual component preview exposed an existing Full Schedule list grouping bug that discarded cancelled rows. Fixed grouping, including cancellation-only days; excluded cancelled rows from Up next. Two render regression tests pass.
- Live feed roster confirmed CRM/SCA/AOA Single allocations despite stray A/B rows; normalization now uses current roster confirmation and removes exact duplicates only. Cached/live regression coverage preserves genuinely sectioned courses and distinct sessions.
- Meetup time assertion uses a fixed Date clock. Calendar benchmarks run separately through npm run test:perf, with warmup and median microbenchmark sampling; all original budgets retained.
- Validation: 59 unit test files / 559 tests passed; all four isolated performance tests passed. Changed-source lint has no errors (one pre-existing FullSchedulePage hook warning). Production Vite/PWA build passed; final build rerun after grouping fix. Version bumped to 7.3.1.
- Browser: authenticated dev Admin Schedule showed cancellation selectors and Config is up to date. Date navigation only; no config changes deployed. September SOM overrides have no matching current feed rows, so stripe/actions verified in isolated actual-component preview using sample data at default desktop and 390x844 phone viewport. Disabled properties=true and opacity=.45 confirmed. Temporary viewport reset.
- Physical installed Android PWA notification delivery, lock-screen appearance and tap routing remain unverified: user has no Android phone. Preview and worker tests do not substitute for device validation.

## Companion artwork completion - 14/10/2026, 22:21:25


- Vitest: Test Files 60 passed (60); Tests 589 passed (589).
- Targeted companion/app/Node preview ESLint: PASS.
- Vite production build: built in 15.13s; PWA 122 precache entries; isolated .local/companion-polish-build output.
- Browser QA: all 15 cases PASS, including 4 full-roster sweeps of 4,025 state/size combinations each; 25 application-page heroes per sweep. Both themes, 390px phone, reduced-motion, keyboard calm pose, care priority, wardrobe sync, hidden/offscreen pausing, unique/resolved defs, zero out-of-canvas geometry at sampled poses.
- All 550 mood renders captured and visually inspected on each theme.
- git diff --check: PASS.

Review: .local/companion-preview.html. Details and regeneration: docs/companion-artwork-review.md. Reports: .local/pet-browser-report.json and .local/luna-visual-report.json.

Boundaries: isolated offline SSR/component/CSS verification, no saved data/authenticated app operations. Preview application-page buttons are static; preview controls only mutate preview DOM. Geometry sampled at 550ms, not every in-between frame. Existing build warnings are documented.

Preserved unrelated sheet.js, sheet.test.js, vite.config.js and docs/pet-codex-lessons-plan.md changes. Original paused checkpoint remains under session/20261014_183848 as history.
