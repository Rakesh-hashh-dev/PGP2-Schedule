# PGP2 Admin Tools enhancement implementation plan

Prepared 2026-11-04 from the current local checkout. Planning only: no application changes, database changes, notification sends, commits, pushes, or deployment are part of this deliverable.

## Scope and outcome

Implement all nine suggested enhancements plus private admin notes. An administrator should be able to prepare and recover changes, publish only the intended area, notify the affected students, investigate delivery problems, moderate reported content, and resolve support requests under explicit permissions.

Use the existing React, Supabase, Vitest, Lucide, notification pipeline, and admin components. No new external service or frontend dependency is planned. Discovery uses existing repository patterns; live database state still requires verification before migration execution.

## Current evidence

- `AdminDashboard.jsx` combines legacy staged config, immediate actions, schedule operations, student inspection, moderation, and database browsing. Its changes must be integrated sequentially.
- `AdminControlsPublish.jsx` and `appControls.js` already provide manual private drafts, review, revision checking, publishing, and restore for mess/navigation/dashboard controls. Extend these contracts rather than replacing them wholesale.
- Legacy config publication uses `updated_at` checks; `adminStore.js` exposes schedule drafts/versions, but draft publication bookkeeping is separate from config publication.
- `apply-scheduled-config/index.ts` currently applies a stored whole-config snapshot. Partial publishing must also change scheduled execution to avoid restoring unrelated stale settings.
- `can_write_config()` currently permits admins other than Monitor. Adding new roles before replacing that assumption would grant excessive access.
- Student notes are still edited through `flags.adminNotes`. Public config must contain only student-facing settings. Inspect legacy history, scheduled snapshots, imports, and exports for the same private fields.
- Moderation currently centres on live statuses and audit entries. Board reporting/restoration primitives already exist; reuse valid ones and extend reporting to the missing content types.
- Push delivery diagnostics and the notifications/dispatch pipeline already exist. Extend their evidence rather than claiming device display can be confirmed.
- The database explorer fetches up to 50 rows. Feedback and audit feeds also have fixed load limits.
- The checkout contains substantial user-owned tracked and untracked changes, including `App.jsx`, `main.jsx`, and `styles.css`. Preserve them; do not reset, broadly reformat, or include them in a release by default.

## Contracts to preserve

1. Keep the student-facing `flags.classOverrides` format, override identities, course/section matching, cancellations, and duplicate source rows intact.
2. Preserve mess source precedence, dated overrides, navigation protections, and existing student dashboard preferences.
3. Keep immediate actions immediate: sending now, clearing a status, and moderation decisions use explicit confirmation and audit. They are not silently staged for later publication.
4. Monitor remains read-only; existing Superadmins retain access. Unknown/missing roles fail closed. Preserve the last-Superadmin safeguard and explicitly remove reliance on legacy bootstrap fallbacks before adding roles.
5. Reuse `notifications` and dispatch; preserve preferences, quiet-hours rules, inbox behaviour, notification expiry, and deduplication. Never send production notifications during validation.
6. Private notes, drafts, report identities, and support details stay outside student-readable payloads. Ordinary config rollback must not republish them.
7. Record sensitive mutations on the server, using the authenticated actor. Do not depend on a browser-provided actor ID or best-effort client logging for accountability.
8. All surfaces need loading, empty, unavailable, permission-denied, stale, offline, and retry states where relevant. Zero results must not disguise a failed query.

## Delivery order and coverage

| Plan | Deliverable | Depends on | Original suggestion |
|---|---|---|---|
| 1 | Private notes and public-config cleanup | None | Foundation improvement |
| 2 | Permission foundation and backend audit | 1 | Specific admin permissions |
| 3 | Transactional publishing and scheduled publication | 2 | Consistent publishing |
| 4 | Shared publishing interface | 3 | Consistent publishing |
| 5 | Autosave, recovery, and conflict resolution | 4 | Automatic draft recovery |
| 6 | Report intake and moderation backend | 2 | Full moderation centre |
| 7 | Moderation workspace and role management | 6, 4 | Moderation and specific permissions |
| 8 | Notification diagnostics across types | 2 | Notification troubleshooting |
| 9 | Notify affected students on publication | 3, 4, 8 | Affected-student notifications |
| 10 | Searchable history and safe data browsing | 2, 3 | Searchable operational history |
| 11 | Unified student support view | 1, 7, 8, 10 | Unified support view |
| 12 | Commands, shortcuts, and saved filters | 4, 7, 10, 11 | Faster navigation |
| 13 | Integrated verification and release preparation | All | Whole scope |

Default execution is sequential. The dependency graph permits separate backend work, but shared `AdminDashboard.jsx` integration stays serial. Each plan below contains two or three bounded tasks. New file names are proposed; check migration timestamp uniqueness before creating them.

## Plan 1 — Private student notes and public-config cleanup

**Task 1.1 — Private storage and migration.**
Files: `supabase/migrations/20261104120000_admin_private_notes.sql` (new), `supabase/tests/admin_private_notes.sql` (new).
Action: Create an admin-only notes table keyed by student ID with revision, author, and timestamps. Backfill current notes without losing content. Inventory and scrub private notes from public config, nested config history, and queued snapshots. Preserve non-note settings. Add server-side rejection or sanitisation of private keys on all config writes so stale clients cannot reintroduce them; return an actionable error when appropriate. Private archived copies may retain notes only under explicit admin access.
Verify: SQL fixtures prove anonymous/student denial, Monitor write denial, successful migration, nested-history cleanup, and rejection of reintroduction through restore/import/scheduled paths.
Done: Notes are preserved in private storage and absent from every tested public config path.

**Task 1.2 — Inspector integration.**
Files: `src/lib/adminNotes.js` (new), `src/lib/adminNotes.test.js` (new), `src/components/AdminStudentNotes.jsx` (new), `src/components/AdminDashboard.jsx`, `supabase/functions/apply-scheduled-config/index.ts`.
Action: Replace `flags.adminNotes` editing with explicit private save/load and revision checks. Keep unsaved text on errors and identify the last saver. Update scheduler handling to respect the private-field boundary. Backend migration precedes frontend use; old clients must never regain the unsafe write path.
Verify: Focused Vitest checks for permission, stale save, failure preservation, and success; inspect the student config payload and notes UI.
Done: Note changes work independently of public config deployment.

## Plan 2 — Capabilities and trustworthy audit

**Task 2.1 — Backend permission boundary.**
Files: `supabase/migrations/20261104121000_admin_capabilities.sql` (new), `supabase/tests/admin_capabilities.sql` (new), `src/lib/adminRoles.js`, `src/lib/adminRoles.test.js` (new).
Action: Introduce explicit capabilities for schedule publication, communications, moderation, student support, private notes, diagnostics/data browsing, system controls, and role management. Define Monitor, Schedule Editor, Communications Editor, Moderator, and Superadmin presets. Inventory every admin table policy, RPC, direct config writer, and Edge Function authorization path. Restrict whole-row config writes to Superadmins; scoped editors use validated domain RPCs. Keep `can_write_config()` conservative rather than accepting every non-Monitor role. Derive audit actors from authentication and require audit insertion in the mutation transaction. Protect the final Superadmin and reject unknown roles.
Verify: SQL permission matrix tests every role against allowed and forbidden operations, including direct REST writes and forged actor IDs. Cover revoked roles and the final-Superadmin guard.
Done: Permissions are enforced without relying on UI visibility or a stale role cache.

**Task 2.2 — Client access and audit adapters.**
Files: `src/lib/adminRoleWatcher.js`, `src/lib/adminRoleWatcher.test.js`, `src/lib/adminAudit.js`, `src/components/AdminDashboard.jsx`, `src/components/CompanionAdmin.jsx`.
Action: Resolve explicit capabilities, gate individual controls, and refresh on existing role-change signals. Replace broad `!monitor` assumptions. Connect sensitive existing mutations to audited backend operations; retain client logging only for non-authoritative interaction events. Keep new editor role assignment unavailable until their scoped workflows are ready in Plan 7. Extend additional discovered privileged consumers before enabling role assignment.
Verify: Focused role-watcher tests and a signed-in role matrix; role revocation denies the next mutation even in an already-open tab.
Done: Existing Superadmin and Monitor flows work, and partial roles cannot access unrelated actions.

## Plan 3 — Transactional publishing and schedules

**Task 3.1 — Domain publication backend.**
Files: `supabase/migrations/20261104122000_admin_domain_publication.sql` (new), `supabase/tests/admin_domain_publication.sql` (new), `src/lib/adminPublication.js` (new), `src/lib/adminPublication.test.js` (new).
Action: Define allowlisted domains: schedule, communications content, system/feature settings, mess, navigation, and dashboard defaults. Use private drafts and durable versions, extending existing stores/RPCs through adapters where practical. Publish a domain patch, validate its capability/schema, compare its expected revision, merge against current published state, and persist its audit/version/draft status atomically. Preserve other domains. Existing global app-control revisions remain compatible through adapters; retry only when a fresh read proves changes are disjoint. Rollback creates a new validated revision. Validate cross-domain dependencies and show them rather than silently publishing additional areas.
Verify: SQL concurrency fixtures cover two editors, disjoint and overlapping changes, stale revisions, tampered paths, failed audit/version writes, and rollback.
Done: Publication either records the complete intended change or changes nothing.

**Task 3.2 — Scheduled execution and compatibility.**
Files: `supabase/functions/apply-scheduled-config/index.ts`, `src/lib/adminStore.js`, `src/lib/appControls.js`, `src/lib/adminStore.test.js`, `scripts/verify-admin-publication.mjs` (new).
Action: Represent scheduled publications as private, bounded domain patches with base revision, author, and execution status. Replace whole-config snapshot replay with the same transactional publication contract. Recheck permission at execution and flag overlapping conflicts for review. Convert legacy queued snapshots by comparing them with a known base; ambiguous entries require restaging rather than guessing. Make cron claims/retries idempotent. Preserve the existing student config read format throughout cutover.
Verify: Local integration fixtures for due/not-due IST jobs, duplicate execution, revoked author, conflict, legacy conversion, and unrelated-domain preservation.
Done: A scheduled change cannot overwrite newer unrelated settings or claim success after a failed publish.

## Plan 4 — One publishing interface

**Task 4.1 — Shared review and domain adapters.**
Files: `src/components/AdminPublishWorkspace.jsx` (new), `src/lib/adminPublicationDomains.js` (new), `src/lib/adminPublicationDomains.test.js` (new), `src/components/AdminControlsPublish.jsx`, `src/components/AdminDashboard.jsx`.
Action: Use a common draft/review/publish/history interface with readable before/after values, publication state, affected scope, and conflict messages. Integrate the legacy schedule, communications content, and system/flag editors and the three newer controls. Keep action-specific previews. Provide a per-domain pending count and publish only the selected domain; avoid duplicate save bars or two competing sources of truth.
Verify: Adapter tests for domain ownership and no-op/deletion handling; manually edit two areas and publish one, confirming the second remains private.
Done: Every staged setting uses a consistent review flow and independent publication.

**Task 4.2 — Responsive integration and action clarity.**
Files: `src/styles/admin-publishing.css` (new), `src/components/AdminPublishWorkspace.jsx`, `src/components/AdminDashboard.jsx`, `src/components/AdminControlsPublish.jsx`.
Action: Add a compact contextual toolbar, explicit draft/live/scheduled labels, history restore, and contextual pending-change navigation. Immediate actions retain clear immediate semantics. Make dialogs keyboard accessible, preserve focus, and support narrow containers without creating horizontal page overflow.
Verify: Phone 390px, tablet 900px, desktop 1440px screenshots; keyboard-only review/publish/cancel/history, long labels, read-only and error states.
Done: All domain workflows remain usable at the three widths and with keyboard navigation.

## Plan 5 — Autosave and conflict recovery

**Task 5.1 — Versioned draft persistence.**
Files: `supabase/migrations/20261104123000_admin_draft_recovery.sql` (new), `src/lib/adminDraftRecovery.js` (new), `src/lib/adminDraftRecovery.test.js` (new), `src/hooks/useAdminDraft.js` (new).
Action: Save debounced private drafts scoped to admin identity and domain, using a separate draft revision so two tabs cannot silently overwrite each other. Store original base, current payload, and published base revision. Ignore late responses from obsolete saves; do not clear a draft until confirmed publication. Prefer server persistence, with an identity-scoped local recovery option only for non-sensitive settings. Keep private notes and report contents out of local recovery. Show offline/unrecoverable save status honestly.
Verify: Tests for refresh recovery, delayed responses, identity change, two tabs, connectivity loss, draft schema migration, and storage failure.
Done: Confirmed saved edits survive refresh; failed saves remain visibly unsaved.

**Task 5.2 — Three-way reconciliation.**
Files: `src/components/AdminDraftRecovery.jsx` (new), `src/components/AdminPublishWorkspace.jsx`, `src/lib/adminDraftMerge.js` (new), `src/lib/adminDraftMerge.test.js` (new), `src/hooks/useAdminDraft.js`.
Action: Compare original base, local draft, and current publication. Auto-merge provably disjoint paths; require selection for overlapping values, deletions, and arrays. Revalidate the complete merged result. Add saved time, resume/discard, navigation guards, and a clear retry path. Retain existing edits while newer published state loads.
Verify: Merge fixtures include conflicting room changes, deleted overrides, ordered navigation arrays, stale restored drafts, and logout during a save.
Done: Conflict recovery preserves intent without an unconditional overwrite option for scoped editors.

## Plan 6 — Reporting and moderation backend

**Task 6.1 — Report and decision storage.**
Files: `supabase/migrations/20261104124000_admin_content_moderation.sql` (new), `supabase/tests/admin_content_moderation.sql` (new), `src/lib/adminModeration.js` (new), `src/lib/adminModeration.test.js` (new).
Action: Add a report queue for board posts/comments, polls, and group messages with content identity, reason, reporter, timestamps, status, owner, and decision. Preserve existing board reports as legacy reports without inventing reasons. Enforce unique reporting, valid content targets, and membership checks for group-message reporting. Store only the bounded evidence needed for a report. Implement capability-gated hide, restore, dismiss, and resolve operations with reasons and server audit. Preserve report history when restoring content. Ensure student reads/subscriptions omit hidden content while authors retain allowed access.
Verify: SQL fixtures cover non-member reporting, duplicate reports, deleted targets, hidden-content reads, unauthorized restoration, and audit consistency.
Done: Each supported content type can be reported and acted on under the same private queue contract.

**Task 6.2 — Student report entry points.**
Files: `src/components/BoardPage.jsx`, `src/components/notifications/CohortPolls.jsx`, `src/components/FriendsPanel.jsx`, `src/components/ReportContentDialog.jsx` (new), `src/lib/board.js`.
Action: Connect report controls to the shared API, collecting a reason and optional bounded detail. Reuse board controls, and add poll/group-message controls at the actual rendering surfaces; trace nested components before edits. Keep normal ownership actions and existing report safeguards intact. Avoid exposing reporter identities to content authors.
Verify: Local student flows for all supported targets, permission denial, success, duplicate reporting, and realtime removal/restore.
Done: Every moderation queue type has a functioning student intake route.

## Plan 7 — Moderation workspace and role presets

**Task 7.1 — Moderation UI.**
Files: `src/components/AdminModerationQueue.jsx` (new), `src/styles/admin-moderation.css` (new), `src/components/AdminDashboard.jsx`, `src/lib/adminModeration.js`.
Action: Add queue filters, report age, reasons, ownership, evidence, decision history, and hide/restore/dismiss controls. Show only reported group messages and bounded relevant context, never unrestricted chat browsing. Keep live-status moderation available. Confirm changes and distinguish reversible hiding from deletion; permanent deletion is not the default.
Verify: Moderator/Superadmin/Monitor/student flows, keyboard focus, empty/error states, and responsive screenshots.
Done: An authorized moderator can resolve and later review a report from intake to decision.

**Task 7.2 — Role-management UI and activation.**
Files: `src/components/AdminRoleManager.jsx` (new), `src/components/AdminDashboard.jsx`, `src/lib/adminRoles.js`, `src/lib/adminRoles.test.js`.
Action: Expose the role presets with readable capability summaries once scoped publication/moderation endpoints exist. Restrict grants to Superadmins, protect the final Superadmin, and refresh capabilities after changes. Document any actions intentionally reserved for Superadmins, including companion adjustments and system settings.
Verify: Every preset's allowed workflow and a forbidden workflow; demotion/revocation from another session; direct API denial beyond the UI.
Done: Partial roles are useful without gaining whole-config or role-management powers.

## Plan 8 — Notification troubleshooting

**Task 8.1 — Evidence across notification types.**
Files: `supabase/migrations/20261104125000_admin_notification_diagnostics.sql` (new), `supabase/functions/dispatch/index.ts`, `src/lib/adminNotificationDiagnostics.js` (new), `supabase/tests/admin_notification_diagnostics.sql` (new).
Action: Extend diagnostic storage/RPCs to all existing notification types with bounded date/type/user filters and stable pagination. Record eligibility, queue state, preferences, quiet-hours deferral, expiry, missing subscriptions, attempted sends, provider acceptance, and failure when supported by evidence. Use explicit unknown/unavailable for older records. Persist bounded diagnostic events beyond inbox deletion if necessary, with a stated retention policy and no subscription secrets.
Verify: Seeded dispatch fixtures cover disabled preferences, quiet hours, expired messages, no devices, provider failure, and retry transitions; students cannot query other users' diagnostics.
Done: Every supported type has attributable states without claiming unobserved device display or historical evidence.

**Task 8.2 — Operational UI.**
Files: `src/components/AdminNotificationDiagnostics.jsx` (new), `src/components/PushDeliveryDiagnostics.jsx`, `src/styles/admin-notification-diagnostics.css` (new), `src/components/AdminDashboard.jsx`.
Action: Build aggregate health and per-user timelines, linked from broadcast/insights/support. Preserve existing broadcast diagnostics and explanatory wording. Provide drill-down by type/date/failure reason and distinguish audience size, unique students, devices, attempts, and accepted sends. Retry controls, if exposed, must only retry eligible existing work and remain deduplicated.
Verify: Compare displayed totals to known fixtures, including multiple devices and retries; inspect permission, loading, no-data, and backend-unavailable states.
Done: An admin can explain the known reason a notification was not sent without issuing a new broadcast.

## Plan 9 — Notify affected students on publish

**Task 9.1 — Transactional event production.**
Files: `supabase/migrations/20261104130000_admin_publication_notifications.sql` (new), `supabase/functions/schedule-diff/index.ts`, `supabase/functions/class-reminders/index.ts`, `src/lib/adminScheduleRecipients.js` (new), `src/lib/adminScheduleRecipients.test.js` (new).
Action: Extend publication to atomically record an optional notification job/outbox event with the actual committed diff. Resolve recipients server-side using the same course/section/session rules as schedule previews. Freeze the eligible cohort used for publication so later enrollment changes do not silently change the reviewed audience. Use a unique publication-event/class/student identity and reconcile existing cancellation/schedule-diff producers to prevent duplicate automatic alerts. Reuse current notification types when their semantics fit; any new type must update schema allowlists and student presentation/preferences. Retried workers must not republish settings or duplicate inbox rows. Superseded/expired schedule messages must not send late.
Verify: Fixtures for split sessions, duplicate source rows, cancellation plus existing cron alerts, room/time edits, rollback, no recipients, worker retries, and publication rollback.
Done: Notification work exists only for a committed change and deduplicates across all producers.

**Task 9.2 — Preview and delivery status.**
Files: `src/components/AdminScheduleNotificationPreview.jsx` (new), `src/components/AdminPublishWorkspace.jsx`, `src/lib/adminPublication.js`, `src/components/AdminNotificationDiagnostics.jsx`.
Action: Add an explicit notification choice, affected classes/sections/courses, eligible-student count, push-eligible estimate, and editable bounded message. Explain automatic alert behaviour to avoid implying that unchecking an optional message suppresses required existing alerts. Bind confirmation to the reviewed revision and audience; require refreshed review if either materially changes. Show published/notification-pending/notification-failed separately, linked to diagnostics. Scheduled jobs resolve and confirm their audience at execution under the chosen policy, recording any difference from the original estimate.
Verify: Dry-run previews send nothing; stale confirmation cannot target a different cohort silently; pending/failed dispatch never misreports a failed config publish.
Done: Admins can publish and notify intentionally, with an inspectable result.

## Plan 10 — Searchable history and data browsing

**Task 10.1 — Bounded backend queries.**
Files: `supabase/migrations/20261104131000_admin_operational_search.sql` (new), `supabase/tests/admin_operational_search.sql` (new), `src/lib/adminOperationalSearch.js` (new), `src/lib/adminOperationalSearch.test.js` (new).
Action: Add indexed, authorized search for audit actions, feedback, publication versions, and allowlisted database views. Use deterministic cursor pagination and bounded date/text/actor/status filters. Return explicit totals or label estimates/unavailable totals. Define safe field projections per view and permission tier; exclude credentials, subscriptions, raw private chats, and unrestricted SQL/table names. Audit sensitive lookups without feeding audit-page reads back into an endless self-generated feed. Bound exports server-side and prevent spreadsheet formula execution in CSV fields.
Verify: SQL fixtures for redaction, unknown tables/fields, cross-role access, cursor ties, new records during pagination, search accuracy, and export limits.
Done: Search retrieves authorized results beyond current fixed load limits with stable pagination.

**Task 10.2 — History and explorer UI.**
Files: `src/components/AdminHistoryExplorer.jsx` (new), `src/components/AdminDataExplorer.jsx` (new), `src/components/AdminDashboard.jsx`, `src/components/AdminWorkflowPanels.jsx`, `src/styles/admin-data-explorer.css` (new).
Action: Add filters, linked detail views, next/previous pages, date ranges, safe export, and explicit dataset scope. Replace the explorer's unlabelled first-50 behaviour. Preserve useful change-timeline links and show publication history separately from ordinary interaction events.
Verify: Seed more than one page, locate older records, navigate back, export the stated scope, and verify redacted fields never reach the browser.
Done: Admins can find an old incident or change without mistaking a partial browser dataset for the complete database.

## Plan 11 — Unified student support

**Task 11.1 — Support summary API.**
Files: `supabase/migrations/20261104132000_admin_student_support.sql` (new), `supabase/tests/admin_student_support.sql` (new), `src/lib/adminStudentSupport.js` (new), `src/lib/adminStudentSupport.test.js` (new).
Action: Assemble bounded student summaries for onboarding, enrollment, notification eligibility, feedback ownership, and relevant admin interventions. Reuse private notes and diagnostics via capability-specific queries. Provide explicit reasons for support signals and data timestamps. Exclude message bodies, individual mess ratings, and unrelated sensitive data. Audit student lookups and enforce field-level access through server projections.
Verify: Fixtures for missing profiles, no enrollment, no subscription, preferences disabled, inaccessible notes, stale data, and revoked permission.
Done: Summary fields accurately explain the known support problem without granting unrelated data access.

**Task 11.2 — Inspector integration.**
Files: `src/components/AdminStudentSupport.jsx` (new), `src/components/AdminDashboard.jsx`, `src/components/AdminWorkflowPanels.jsx`, `src/styles/admin-student-support.css` (new).
Action: Open one unified view from the directory, support queue, feedback, and notifications. Show next actions and deep links; keep existing profile/course/pet tools under their appropriate capability. Refresh after a successful intervention and preserve context when returning to the queue.
Verify: Complete onboarding and notification support scenarios, including a failed intervention, missing data, role-specific sections, and narrow-screen navigation.
Done: An admin can investigate a student and act without manually switching among disconnected tabs.

## Plan 12 — Commands, shortcuts, and remembered filters

**Task 12.1 — Command registry and navigation.**
Files: `src/lib/adminCommands.js` (new), `src/lib/adminCommands.test.js` (new), `src/components/AdminCommandPalette.jsx`, `src/components/AdminDashboard.jsx`.
Action: Register capability-aware destinations and task entry points for schedule dates/classes, menu dates, overrides, failed notifications, reports, and student support. Commands navigate/open a draft; publishing, sending, and moderation retain their own confirmation. Support clear aliases and IST interpretation for tomorrow/today. Revalidate capability and target existence when executing a result.
Verify: Registry tests for permission filtering, stale targets, date boundaries, aliases, and zero accidental mutations; keyboard open/search/select/escape and focus return.
Done: The suggested everyday tasks can be reached directly from the existing palette.

**Task 12.2 — Personal shortcuts and filter persistence.**
Files: `src/lib/adminWorkspacePrefs.js` (new), `src/lib/adminWorkspacePrefs.test.js` (new), `src/components/AdminWorkspaceShortcuts.jsx` (new), `src/components/AdminDashboard.jsx`.
Action: Store a small versioned set of identity-scoped pinned destinations and non-sensitive filter choices. Do not persist student notes, content evidence, student search text, or user-specific support results. Handle storage denial gracefully and discard inaccessible pins after role changes. Keep a visible reset option and preserve the existing admin tab structure.
Verify: Tests for reload, different accounts, revoked capabilities, invalid saved versions, missing storage, and reset; inspect phone/tablet shortcut density.
Done: Each admin can resume routine work quickly without leaking another account's workspace context.

## Plan 13 — Integrated validation and release preparation

**Task 13.1 — End-to-end evidence.**
Files: `scripts/verify-admin-enhancements.mjs` (new), `docs/admin-tools-enhancement-verification.md` (new), `supabase/tests/admin_enhancements_integration.sql` (new).
Action: Verify a clean disposable migrated database and a representative upgrade with legacy config/history/queued jobs. Exercise each role from student to Superadmin, concurrent publication/autosave, private-data boundaries, report lifecycle, scheduled changes, notification outbox retry, search pagination, and support diagnosis. Use local seeded recipients and mocked push transport; never send real test broadcasts. Run focused tests during each plan, then `npm test`, `npm run lint`, `npm run build`, and `git diff --check`. Inspect build/prebuild-generated changes rather than reverting user files; report existing failures separately. Capture signed-in phone/tablet/desktop evidence and keyboard flows. If an environment is unavailable, record the outstanding check rather than mark it passed.
Verify: All ten requested outcomes map to recorded checks; check browser/network payloads for forbidden private fields as well as UI appearance.
Done: Evidence covers each requested workflow and failure mode, with any unavailable checks explicitly listed.

**Task 13.2 — Release and recovery procedure.**
Files: `docs/admin-tools-enhancement-release.md` (new), `docs/admin-tools-enhancement-verification.md` (new).
Action: Prepare the reviewed migration/function/frontend order, backfill counts, required job configuration, and deployment verification steps. Roll out additive backend contracts first, update old scheduler/notification writers, switch clients, then enforce final restricted write policies and activate partial roles only when all paths are ready. Rehearse this sequence against the upgrade fixture; private-key rejection must remain active throughout. Include the exact minimum compatible frontend/function versions and a rollback path that preserves private-data removal and new audit/publication records. Capture a private backup before data migration and restrict its access. Verify live linked-project state before any later deployment rather than infer it from local files. Prepare a scoped diff; commit, push, production migrations, and deployment remain separate from this planning request.
Verify: Rehearse release and recovery locally with a pending scheduled job and a stale browser; ensure old restore/import paths cannot leak notes or overwrite unrelated domains.
Done: Implementation is reviewable, its deployment order is explicit, and recovery does not restore the original private-data exposure.

## Completion checklist

- [ ] Private notes are absent from public config and public snapshots.
- [ ] Every role is enforced server-side, including direct API attempts.
- [ ] Every staged area supports scoped draft/review/publish/history.
- [ ] Draft recovery and conflicts preserve edits and reject stale overwrites.
- [ ] Reported posts/comments, polls, and group messages have a complete moderation path.
- [ ] All notification types expose supported diagnostics with honest unknown states.
- [ ] Schedule publication can queue one deduplicated message per intended recipient.
- [ ] Search, history, pagination, and exports operate on authorized server datasets.
- [ ] Student support joins relevant facts with permission-aware actions.
- [ ] Commands, pins, and filters speed routine tasks without bypassing review.
- [ ] Existing schedule, mess, navigation, dashboard, companion, and student workflows retain their contracts.
- [ ] Verification evidence and release/recovery instructions are complete; any live checks still pending are named.
