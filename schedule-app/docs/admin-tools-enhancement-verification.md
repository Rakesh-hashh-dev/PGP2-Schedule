# Admin Tools verification

Recorded 2026-11-05 (IST). See [implementation coverage](admin-tools-enhancement-progress.md) and [the original plan](admin-tools-enhancement-plan.md).

| Check | Result |
|---|---|
| `npm test` | 93 files, 871 tests passed |
| `npm run lint` | Zero errors; 12 existing hook warnings in App.jsx and FullSchedulePage.jsx |
| `npx vite build` | Passed, including PWA generation; existing splitCloud import warning |
| Function bundle check | All five changed Edge Function entry points and local imports bundled with Vite; remote/npm imports external, no Deno runtime/type or provider check |
| `git diff --check` | Passed; Git also reports Windows line-ending notices |
| `node scripts/verify-admin-enhancements.mjs` | Repeated after legacy RPC capability fixes: all ten suites passed in `admin_tools_verify_1793862841527` |
| `node scripts/verify-admin-hosted-schema.mjs` | Actual hosted public-schema export plus synthetic upgrade rows passed in `admin_upgrade_verify_1793862795790` |
| Synthetic headless Chrome | 18 checks passed, 16 screenshots, 390/900/1440px; no horizontal page overflow |

Direct Vite compilation avoids `npm run build`'s prebuild, which regenerates user-owned schedule snapshots. No dependency changes were required.

## Database evidence

The harness creates a new database in `supabase_db_schedule-app`; it never migrates the default app database or linked hosted database. Representative source tables, legacy private config, shared control drafts, notifications and social content are seeded before the existing controls migration and ten new migrations run in order.

The SQL suites cover note backfill/privacy; capability enforcement and forged actors; domain isolation, stale revisions and scheduled-job checks; per-author drafts; reporting/membership/hidden reads and moderation history; preset grants; notification evidence permissions and bounded retention; audience validation, replay prevention and atomic fanout rollback; projected search/pagination; and support privacy/auditing. Frontend tests additionally cover merge semantics, autosave serialization/retry, capability-aware commands, config sanitation and navigation guards.

Final SQL output and source hashes: `.local/admin-enhancement-sql-verification.log` and `.local/admin-enhancement-sql-manifest.json`. Compare hashes before reusing evidence after edits.

## Continuation: hosted-schema rehearsal

On 2026-11-05 the linked project's actual public schema was exported read-only to `.local/admin-hosted-schema-20261105.sql`. No hosted table data was downloaded. The new harness imported it into a fresh Docker database, added synthetic legacy notes/drafts/reports/jobs, applied all ten migrations and exercised runtime RPCs.

This exposed legacy attendance, feature usage, push-delivery, presence and companion read RPCs whose broad admin guards would admit newly introduced roles. The capability migration now wraps those additional deployed feeds, preserving result shapes, argument names and defaults. Diagnostic feeds require diagnostics.read, presence requires support.read, and companion administration requires system.publish. Tests prove denied editor/communications/Monitor calls and permitted calls, including the default presence argument.

Other hosted-schema checks passed: private-note cleanup/backfill, original-author draft recovery, legacy jobs held for review, all five search datasets, support, legacy report hide/restore, student denial, Monitor publication denial, and scheduled publication notifications. The scheduled test adds an enrollment after preview, verifies two recipients at execution and verifies a repeated worker creates no duplicate inbox rows. An initial assertion used the wrong notification type name; correcting the test to schedule_change produced the passing run.

Evidence: `.local/admin-hosted-upgrade.log` and `.local/admin-hosted-upgrade-manifest.json`. This covers the real public schema with synthetic data and a local auth.jwt shim, not hosted Clerk, internal platform schemas, real data volumes or real transports. No frontend code changed during this continuation; earlier frontend/browser results remain the recorded results.

Read-only preflight confirmed PGP2-Schedule (`fzhfbttlbfpnwhempyav`) and existing function inventory: send-push v12, class-reminders v15, dispatch v5, schedule-diff v7, apply-scheduled-config v3. None was deployed this session. Browser access host was unavailable, so real signed-in checks remain pending.

## Browser evidence

The fixture renders actual components with synthetic accounts and mocked service responses. Fetch/WebSocket substitutes are installed before importing the dashboard. No real authentication or push transport is used.

Screenshots/checks are in `.local/admin-ui-evidence/`. Moderation, operational search, diagnostics and system tabs were captured at all three widths. Other checks exercised pagination, scoped publication, Monitor restrictions, keyboard commands, private-note save and report receipt. Screenshots include desktop publication review/commands and phone notes/report receipt; selected images were visually inspected.

An initial attempt timed out before mounting while other verification ran. The subsequent complete run passed. This establishes local rendering and mocked interactions, not hosted authorization or provider delivery.

## Outstanding checks

- Extend the completed public-schema/synthetic-data rehearsal with real-data-volume and multi-session concurrency checks as needed. Hosted internal schemas and real Clerk authentication were not cloned.
- Exercise real Clerk sessions for each role, revocation in an open tab, direct REST denial, realtime hide/restore, two-tab recovery and scheduled notification execution.
- Inspect actual public config/history after migration and reconcile note/archive/draft counts.
- Verify scheduler authentication/secrets/cron and notification preferences/quiet hours with an approved test cohort and controlled transport. Functions were edited but not deployed or exercised against a real provider.
- Repeat responsive/keyboard checks in the full signed-in app. Synthetic checks do not cover every legacy action or assistive technology.

No production sends, migrations, commits, pushes or deployments were performed.
