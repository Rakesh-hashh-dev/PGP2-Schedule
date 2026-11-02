# Admin controls implementation plan

Date: 2026-11-02
Status: Implemented locally; see admin-controls-verification.md for checks and deployment status.
Scope: All nine controls discussed: weekly mess menu editing, dated menu overrides,
meal timings, rotation settings, source/sync diagnostics, meal notices, aggregate
meal feedback, navigation configuration, and dashboard defaults.

## Current evidence and constraints

- `src/App.jsx` loads the mess feed independently and no longer applies
  `system_config.flags.messMenuOverrides`. Reusing that field alone will not work.
- `src/data/messMenu.js` defines meal times, breakfast extras and the rotation
  anchor in code. MessCard, MessMenuModal and GlanceView consume these helpers.
- `src/lib/messFeed.js` caches successful responses and returns cached data on
  failure. Diagnostics must distinguish cached service from a successful fetch.
- `src/lib/adminStore.js` establishes private admin drafts and version records;
  unpublished material must not enter the student-readable configuration.
- Monitor reads and Superadmin writes are enforced by database permissions.
- Desktop navigation uses `src/lib/navItems.js`; mobile More and some navigation
  in App.jsx are separate. Configuration must cover all supported entry points.
- Dashboard preferences are currently device-local and saved at startup. A saved
  key alone cannot establish that the student deliberately customized the layout.
- Existing menu ratings provide aggregate counts through an RPC. Individual votes
  are not required for the new admin summary.
- No tracked or untracked changes appeared in the initial `git status --short`.

## Product and data decisions

1. Keep the Google Sheet feed as the regular menu source. Admin weekly edits are
   explicit published patches above it, with a visible reset-to-sheet action.
2. Resolve menu data in this order: bundled fallback, valid live/cached sheet,
   published weekly patches, then published date-specific patches. Compose daily
   breakfast extras explicitly so date overrides cannot accidentally duplicate them.
3. A dated patch affects only its IST calendar date. General notices use explicit
   start/end timestamps. Timings support regular values and date-specific changes.
4. Support both snack rotations and an editable Monday anchor. Preview at least
   four weeks, including transitions between rotations.
5. Put mess controls under Schedule → Menu, alongside Schedule → Class. Put navigation and dashboard defaults under
   System. Reuse the existing visual language and admin role handling.
6. Store drafts and durable revision history in admin-only tables. Publish only
   the bounded, current student-facing configuration. Use an authenticated RPC to
   validate, compare the expected revision, publish, and write an audit record in
   one transaction. Rollback creates a new revision rather than erasing history.
7. Navigation settings target a fixed allowlist of existing destinations. Support
   labels, visibility and order within existing groups. Preserve Today, settings,
   sign-out and authorized Admin Tools access. Visibility does not confer access.
8. Dashboard defaults apply after configuration hydration only when there is no
   existing saved layout. Preserve existing layouts conservatively, even if older
   code may have saved them automatically. Offer an explicit reset to current
   institute defaults. Validate defaults against existing supported widget options;
   keep the timetable visible under its existing contract.
9. Source diagnostics provide validation, timestamps, source provenance and a fresh
   fetch action. Any feed URL setting accepts validated HTTPS Apps Script endpoints,
   must pass the payload check before publication, and contains no credentials.
   Refresh does not claim to invalidate an upstream Apps Script cache.

## Plan 1 — Publishable controls foundation

Depends on: none. Two sequential tasks.

### Task 1: Schema, validation, publication and revision history

Files:
- `supabase/migrations/20261102120000_admin_app_controls.sql` (new)
- `supabase/tests/admin_app_controls.sql` (new)

Action: Add private draft/revision storage and bounded public configuration for
mess, navigation and dashboard settings. Reuse existing role helpers. Validate
allowlisted keys, dish arrays, date/time ranges, rotation anchor and feed URLs.
Publish with an expected revision and transactionally record actor, timestamp and
change details. Rollback must use the same validation and conflict checks. Inspect
existing audit-table policy/schema before choosing the insert shape.

Verify: Run the SQL assertions against a local Supabase database after migrations.
Cover student denial, Monitor write denial, Superadmin success, invalid input,
stale revision rejection, draft privacy and audit/revision consistency.

Done: Only authorized, valid, conflict-free publication changes public settings.

### Task 2: Client settings API and admin publication shell

Files:
- `src/lib/appControls.js` (new)
- `src/lib/appControls.test.js` (new)
- `src/components/AdminControlsPublish.jsx` (new)
- `src/components/AdminDashboard.jsx`

Action: Implement normalized reads, private draft save/load, publication preview,
revision comparison and rollback. Add a reusable admin shell and route to Schedule → Menu.
Surface loading, read-only, save failure and revision conflict states. Do not
declare publication successful when a request fails or returns no affected row.

Verify: `npm test -- src/lib/appControls.test.js` plus role/conflict SQL assertions.
Done: A draft can be reviewed, published and restored through one consistent flow.

## Plan 2 — Menu resolution and student integration

Depends on: Plan 1. Two sequential tasks.

### Task 1: Shared menu resolver and feed provenance

Files:
- `src/data/messMenu.js`
- `src/lib/messFeed.js`
- `src/lib/messControls.js` (new)
- `src/lib/messControls.test.js` (new)
- `src/lib/messFeed.test.js` (new)

Action: Resolve weekly/date patches, snack rotations, breakfast extras, regular
and dated timings, and expiring notices through pure helpers. Preserve existing
consumers with backward-compatible defaults. Extend feed fetching with explicit
live/cache/bundled provenance, fetched time, upstream build time when supplied,
validation errors, timeout and fresh-fetch support. Scope caches by source URL.
Never treat cached fallback as live success or publish malformed feed data.

Verify: `npm test -- src/lib/messControls.test.js src/lib/messFeed.test.js`.
Test precedence, partial menus, reset-to-source, empty/closed meal semantics,
rotation boundaries, IST midnight, expired notices, invalid payloads and failure
fallback. Confirm timings reject invalid and overlapping ranges.

Done: The same configuration/date always produces the same menu on every surface.

### Task 2: Connect all mess consumers

Files:
- `src/App.jsx`
- `src/components/MessCard.jsx`
- `src/components/MessMenuModal.jsx`
- `src/components/GlanceView.jsx`
- `src/lib/messView.js`

Action: Hydrate published controls and consume the shared resolved menu, timings
and notices. Ensure changes trigger rerenders and expiry works in an open tab.
Keep favourites, personal likes, cohort rating writes and offline fallback intact.

Verify: Use local fixtures to inspect the same date on Today, modal and Glance;
capture desktop/mobile screenshots for a changed meal, changed timing and notice.
Done: All mess views agree; dated changes cease to apply after their date ends.

## Plan 3 — Mess administration and feedback

Depends on: Plan 2. Two sequential tasks.

### Task 1: Mess control editor

Files:
- `src/components/AdminMessControls.jsx` (new)
- `src/styles/admin-mess-controls.css` (new)
- `src/components/AdminDashboard.jsx`

Action: Provide weekly dish editing, both snack variants, one-date patches,
regular/date-specific meal hours, rotation anchor, notices and four-week preview.
Show source values alongside admin patches, reset-to-sheet actions, before/after
review and revision rollback. Include feed diagnostics and validated source setup.
Keep draft, published and fetched states visibly distinct.

Verify: Keyboard edit/preview/publish/rollback flow; test validation failures,
Monitor mode, concurrent edits, network failure, and desktop/tablet/phone layouts.
Done: Every proposed mess control is usable without editing source code.

### Task 2: Aggregate meal feedback

Files:
- `src/lib/messRatings.js`
- `src/components/AdminMessFeedback.jsx` (new)
- `src/components/AdminMessControls.jsx`

Action: Add a bounded date-range view of the existing aggregate ratings. Show vote
counts, approval share and sample size per meal; distinguish no votes from an
unavailable RPC. Start with existing aggregate RPCs; add an admin aggregate-range
RPC only if needed for bounded request performance. Do not expose individual votes.

Verify: Check totals against known fixture counts and verify empty/error states.
Done: Admins can compare meals by date without accessing individual ratings.

## Plan 4 — Navigation control

Depends on: Plan 1; implement after Plan 3 to keep shared-file edits sequential.
Two sequential tasks.

### Task 1: Shared navigation settings resolver

Files:
- `src/lib/navItems.js`
- `src/lib/navigationControls.js` (new)
- `src/lib/navigationControls.test.js` (new)

Action: Normalize allowlisted settings, apply labels/order/visibility, and compose
them with existing feature and role gates. Define consistent hidden-route behavior
for bookmarks, browser history, command/search navigation and in-app actions.
Avoid treating a navigation toggle as a backend permission change.

Verify: `npm test -- src/lib/navigationControls.test.js`; cover protected routes,
unknown IDs, duplicate order entries and interaction with disabled feature flags.
Done: One resolver governs supported student navigation settings.

### Task 2: Editor and navigation consumers

Files:
- `src/components/AdminNavigationControls.jsx` (new)
- `src/components/AdminDashboard.jsx`
- `src/components/DesktopSidebar.jsx`
- `src/components/mobile/MobileV2MorePage.jsx`
- `src/App.jsx`

Action: Add label, within-group ordering and visibility controls with desktop and
mobile previews. Apply the resolver to sidebar, legacy mobile menus, V2 More,
app routing and any discovered navigation/search consumers. Preserve role gates,
badges, unread counts and existing actions.

Verify: Run existing sidebar/mobile tests and inspect supported navigation surfaces;
exercise direct routes to hidden views and restoration to defaults.
Done: Published settings produce consistent labels and visibility across layouts.

## Plan 5 — Dashboard defaults and release verification

Depends on: Plans 1–4. Two sequential tasks.

### Task 1: Admin defaults and safe preference hydration

Files:
- `src/lib/dashboardPrefs.js`
- `src/lib/dashboardPrefs.test.js`
- `src/components/AdminDashboardDefaults.jsx` (new)
- `src/components/AdminDashboard.jsx`
- `src/App.jsx`

Action: Provide supported widget order/visibility, density and panel defaults.
Wait for published configuration before initializing and saving an unsaved device's
layout; preserve existing layouts. Track initialization/customization explicitly
going forward. Give students an explicit reset to published defaults. Display an
admin preview and preserve current timetable/focus-mode behavior.

Verify: `npm test -- src/lib/dashboardPrefs.test.js`; cover cold start, slow/error
config fetch, saved customization, legacy saved layouts and reset behavior.
Done: New layouts adopt defaults; existing layouts survive admin publication.

### Task 2: Integrated checks and deployment preparation

Files:
- Existing and newly added relevant tests
- `docs/admin-controls-verification.md` (new)

Action: Run focused tests, required lint checks and production build. Inspect
responsive views with screenshots, verify role enforcement against migrated local
database, publication conflicts, offline/cache behavior, and rollback of each
settings section. Record actual evidence and unavailable checks. Audit final diff
for unrelated changes. Prepare migration and deployment order without publishing.

Verify: `npm test`, `npm run lint`, `npm run build`, `git diff --check`, local SQL
assertions, and browser evidence at phone, tablet and desktop widths. Identify
pre-existing failures separately rather than claiming all checks passed.

Done: All nine controls have evidence covering admin editing and student behavior.
Production deployment remains a separate action; a successful local build is not
remote verification. No commit, push or production migration in this planning step.

## Execution order

Plan 1 → Plan 2 → Plan 3 → Plan 4 → Plan 5.
No new third-party dependency is planned. Recheck repository status and applicable
instructions before implementation; preserve any changes introduced after planning.
