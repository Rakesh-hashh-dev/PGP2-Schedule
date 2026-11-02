# Admin controls — implementation and verification

Date: 2026-11-02
Status: App controls backend deployed to the linked Supabase project and verified on 2026-11-02. This session did not deploy the frontend or publish Git changes.

## Delivered behavior

- **Schedule → Class / Menu:** Class retains the existing schedule tools. Menu
  contains the mess controls; there is no separate top-level Mess admin tab.
- **Weekly menu:** edit breakfast, lunch, both snack rotations and dinner;
  remove a patch to return to the sheet/bundled source.
- **Dated menu changes:** replace a complete meal for an IST date; empty dishes
  mean unavailable. Other dates automatically return to the regular menu.
- **Meal hours:** edit regular hours and date-specific exceptions. Invalid or
  overlapping ranges cannot be published.
- **Rotation:** configurable Monday anchor and four-week resolved preview.
- **Notices:** text with explicit IST start/end entry, stored as timestamps and
  automatically excluded at the end time.
- **Source diagnostics:** live/cache/bundled provenance, fetch time, upstream build
  timestamp when supplied, errors and fresh payload validation. Alternate sources
  have separate caches. URL changes require a successful live client probe before
  publication. A client refresh does not invalidate Google's upstream cache.
- **Feedback:** bounded 1–28-day aggregate ratings, sample size, approval share,
  no-vote and unavailable states. Individual ratings stay private.
- **System → Navigation menu:** supported labels, visibility and within-group
  order, composed with existing feature/role gates. Desktop, mobile More, legacy
  tools, command results and supported primary buttons consume the configuration.
  Existing order is preserved until an explicit order is published. Hidden page
  routes return to Today; settings, sign-out and authorized Admin Tools remain.
- **System → Student dashboard defaults:** supported widget visibility/order,
  density and week panel. Existing saved layouts survive publication; new layouts
  wait for successful config hydration. Reset opts into institute defaults.
- **Publishing:** private admin drafts; before/after review; expected-revision
  checks; transactional publication/history/audit; restore as a new revision.
  Students read only published settings; Monitors cannot write.

Menu resolution: bundled → live/cached sheet → published weekly patch → dated
patch. MessCard, MessMenuModal and Glance use shared menu/timing resolution.
Favourites, personal likes and existing meal rating writes remain in place.

## Tablet notification fix

The tablet sidebar's click-capture handler previously closed the drawer for all
utility buttons, including the bell. Since the notification panel lived inside
that drawer, opening it also hid its ancestor. The handler now closes the drawer
for the external search flow while leaving internal utility popups visible.

Only the clicked bell renders the notification dialog, preventing duplicate
topbar/sidebar dialogs. Switching bell surfaces while open keeps the dialog open
on the new surface. Tablet sidebar popup placement is bounded to the viewport.
Existing notification actions, read state and Escape handling are retained.

## Recorded checks

| Check | Result |
| --- | --- |
| Full Vitest run | 78 files, 835 tests passed |
| Full ESLint run | 0 errors; 12 existing hook-dependency warnings in App/FullSchedulePage |
| Production build | `npm run build` passed; final Vite build rechecked after the last adjustments |
| PostgreSQL assertions | 38 passed using isolated PGlite and the project's actual role helpers |
| Diff whitespace check | `git diff --check` passed |
| Browser screenshots / responsive visual QA | Unverified: browser host unavailable; native browser control then stopped because it could not establish the current URL reliably |
| Hosted database / frontend behavior | Backend deployed and API/schema permissions verified; frontend visual behavior remains unverified |

The SQL checks apply the new migration to an isolated PostgreSQL engine with
minimal prerequisite tables and the existing role helper function definitions.
They cover student/Monitor write denial, draft privacy, Superadmin publishing,
invalid fields/dates/timings, stale and null revision rejection, version restore,
and rollback of state/history when audit insertion fails. This is not a full
replay of every historical project migration or proof of hosted schema state.

`src/components/tabletNotifications.test.jsx` exercises the actual sidebar event
handler: bell, filter, popup-close and avatar actions must not close its ancestor;
search still closes it. It does not prove browser positioning or visual behavior.

The original build initially encountered a missing pet stylesheet from concurrent
work; the subsequent build passed after that stylesheet appeared. Other ongoing
pet and UI changes were left untouched. The standard prebuild also ran the
project's existing schedule snapshot and sitemap generators.

## Deployment sequence

1. Review/apply `supabase/migrations/20261102120000_admin_app_controls.sql` after
   confirming hosted prerequisites: `admins`, role helpers and `admin_audit_logs`.
2. Verify hosted RLS/RPC behavior for Monitor, Superadmin and student identities.
3. Deploy the frontend and verify Schedule → Class/Menu, System controls, publish,
   read-back, restore, saved student layouts and the tablet notification bell.
4. Capture actual desktop/tablet/phone visual evidence. Until then, visual success
   remains unverified.

The original implementation was local only. The subsequent backend deployment is recorded below. No Git commit, push or frontend publication was performed.

Reproduce isolated SQL checks with a temporary engine installation (not an app
dependency):

```powershell
npm install --prefix tmp/controls-validation --no-save --package-lock=false @electric-sql/pglite
node scripts/verify-admin-controls.mjs tmp/controls-validation/node_modules/@electric-sql/pglite/dist/index.js
```

## Premium UI refinement — 2026-11-02

The Mess menu controls, Navigation menu and Student dashboard defaults now use
illustrated section headers, contextual icons, configuration-derived summary
cards, stronger form hierarchy and a shared publishing toolbar. The refinement
is implemented in `AdminControlVisuals.jsx` and `admin-mess-controls.css` with
focused changes to the existing three panels and publication shell.

- Mess: meal icon cards, weekday selector, dish chips, service-window timeline,
  structured four-week preview, notice cards, source status and rating bars.
- Navigation: icon rows, visibility switches, bounded reorder controls and a
  sidebar preview reflecting current labels/order/visibility.
- Dashboard: density selector cards, widget icons/switches, bounded reorder
  controls and a configuration-derived dashboard miniature.
- Shared: illustrated headers, source-aware status visuals, review/history
  hierarchy, keyboard focus states, responsive layouts and reduced-motion rules.

Verification: changed component files pass ESLint; 33 relevant existing tests
pass; production Vite build passes. Static server rendering succeeds for all
three panels in editor and Monitor modes. Browser screenshots remain unverified
because the browser access was unavailable earlier in this session. No deploy,
commit, push or backend modification was made for this visual refinement.

## Compact and responsive layout refinement — 2026-11-02

Reduced header height, card padding, section gaps, metric-card size and default
meal textarea height. Meal textareas now use 2–4 rows based on their dish count.
Navigation editor groups share columns when space permits; previews use a bounded
side column rather than half the workspace. Preview decoration stays around its
content instead of stretching down an otherwise empty column. Notices and feed
settings share a row when space permits. Removed duplicate outer panel margins.

Container breakpoints at 820, 680, 480 and 340 pixels adapt to the panel width,
including when the application sidebar reduces available space. Narrow layouts
stack editor/preview, wrap navigation previews, preserve paired time fields,
stack date-time fields when needed, and put the publishing toolbar in normal
flow on small panels. Date/time inputs and grid children can shrink within their
columns. Three-stat summaries fill their otherwise empty final row on phones.

Checks: changed component lint passed; 30 relevant tests passed; static editor
and Monitor rendering passed for all three panels. Production build passed.
Actual responsive screenshots remain unverified: the browser access host was
unavailable. No production deployment was performed.

## Missing-table fix — backend deployment, 2026-11-02

The frontend reported missing `app_controls` and `app_controls_drafts` tables.
Hosted inspection confirmed that none of the three new tables existed and
migration `20261102120000` was absent. The frontend Supabase URL and linked
project matched (`fzhfbttlbfpnwhempyav`). Existing role helpers and the JSONB audit
column were verified before applying anything.

Validation before deployment:

- Existing isolated PostgreSQL/PGlite suite: 38 assertions passed.
- Additional Docker PostgreSQL 15 test: actual migration, private draft save,
  publication, revision history, audit insertion, Monitor/student write denial,
  private-history filtering and stale-revision rejection all passed.
- The disposable Docker container used the cached image, no network, no exposed
  ports and no volumes. It was stopped and automatically removed after testing.
  Existing local Supabase containers were left running.

Applied only `20261102120000_admin_app_controls.sql` through the Supabase
Management API in a transaction, together with its migration-history record and
PostgREST schema-reload notification. Unrelated pending migrations were not
applied. No app configuration changes or student data edits were published.

Post-deployment verification:

- All three tables exist with RLS enabled.
- Both admin publishing/draft functions exist as SECURITY DEFINER, executable by
  authenticated callers and not by anonymous callers. Their internal role checks
  are preserved. Direct authenticated table UPDATE permission is absent.
- The public settings API resolves `app_controls` and returns the initial global
  row (revision 0, empty published payload).
- Both draft/history API table names resolve; anonymous reads return no rows.
- Migration `20261102120000` is recorded in hosted migration history.

Reload the app to clear its previous missing-table error state. Browser sign-in,
actual hosted Superadmin publishing and visual checks were not exercised in this
backend verification. No Git commit, push or frontend deployment was performed.

## Local stale history error recovery — 2026-11-02

For `http://localhost:3000/?view=admin`, inspected the actual Vite-served Supabase
module and confirmed it uses the linked hosted project. Fresh requests using the
local app's public configuration returned HTTP 200 for all three controls tables,
including `app_controls_versions`. No additional database migration was needed.

The publication panel previously fetched draft/history only once at mount and
stored a failed request in component state indefinitely. Reload refreshed only
published settings, leaving that error untouched. Replaced the one-shot effect
with a cancellable metadata watcher: bounded retries after failures, refresh on
focus/reconnect, partial-success retention, a dedicated Retry action, and private
metadata refresh during Reload/publication. Metadata retries do not modify the
editor's staged value. Explicit Reload retains its existing published-settings
reload behavior.

Six new regression cases passed; 30 focused tests passed in total. Changed-file
ESLint and production build passed. Local Vite HTTP responses confirm that the
admin panel now imports the recovery hook and serves its module successfully.
This was a local frontend fix; no hosted data changes, Git commit or push occurred.

## Commit verification — 2026-11-02

Before the requested commit/push, exported the exact staged Git tree to an
isolated directory and verified it independently of the unrelated, unstaged pet
and generated schedule changes. All 79 test files / 841 tests passed, and the
production Vite/PWA build passed. The commit scope is the app controls, shared
mess/menu/navigation integration, tablet notification fix, tests, migration and
supporting documentation. Browser visual verification remains unconfirmed.
