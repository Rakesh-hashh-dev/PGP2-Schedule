# Admin Tools release and recovery

Prepared 2026-11-05 (IST). No production deployment has been performed. Read [verification limits](admin-tools-enhancement-verification.md) first.

## Compatible release unit

Ship all ten `20261104*_admin_*.sql` migrations from this enhancement set, the matching admin frontend/adapters and five updated functions: `apply-scheduled-config`, `send-push`, `dispatch`, `class-reminders`, `schedule-diff`. Include their shared modules `privateAdminConfig.js` and `scheduleNoticeCoverage.js`. The existing `20261102120000_admin_app_controls.sql` migration is a prerequisite.

There is no release commit yet. Identify the release by a reviewed scoped changeset and migration/function hashes; package version 7.8.0 alone is insufficient. Old clients may receive permission/reload errors. Never restore their ability to publish private fields or save obsolete shared drafts.

## Preflight

1. Verify the actual linked project, applied migration history, deployed functions, cron calls and policies. Do not infer hosted state from Docker or this checkout.
2. Confirm a registered Superadmin whose Clerk identity matches `admins.user_id`. The empty-admin bootstrap fallback is removed. Preserve a verified DBA recovery path.
3. Take a private, access-restricted backup. Record legacy note/config/history/queue counts, roles and control-draft authors. The private archive retains legacy data for DBA recovery.
4. Rehearse against a private hosted-schema clone, including stale clients, queued legacy snapshots, conflicting drafts and revoked job authors. The Docker harness supplements this rehearsal.
5. Pause scheduled config execution and concurrent admin publication for cutover. Hold new partial-role assignments until functions/frontend are active; the role-preset migration itself enables those assignments.

Read-only preflight on 2026-11-05 confirmed the intended PGP2 project. Its public-schema/synthetic-data upgrade rehearsal passed; see verification evidence. Live migration history has gaps for ten older local migrations (20261013110000 through 20261027180000), although the exported schema already contains some corresponding objects. Do not run a blanket `supabase db push`, mark them applied blindly or replay them automatically. Reconcile their actual objects first, then use an explicitly reviewed migration set for this release. The ten enhancement migrations remain absent from hosted migration history.

## Apply in order

1. Apply all ten reviewed migrations in timestamp order: notes, capabilities, domain publication, draft recovery, moderation, role presets, diagnostics, publication notifications, search, support. A prefix is not a supported application release.
2. Reconcile private note/archive counts and original authors' recovered drafts. Verify public config and nested history contain no `adminNotes` or `adminRoles`. Legacy whole-config queued jobs become private `needs_review` entries; replace them with reviewed scoped jobs.
3. Deploy the five functions and shared modules. Verify project URL and service credentials without printing secrets. Scheduler cron must supply the exact configured service bearer. Preserve existing dispatch cadence/preferences/quiet hours.
4. Deploy the matching frontend through the normal asset-update mechanism. Verify RPC availability before resuming admin work; the unversioned shared-draft writer is disabled.
5. Verify real role access, then grant scoped roles. Resume scheduling after a controlled job succeeds and stale-revision/revoked-author jobs fail safely.
6. Using an approved test cohort, verify preview, atomic inbox creation, dispatch evidence and duplicate automatic-alert suppression. Provider acceptance does not prove device display. Avoid broad test broadcasts.

## Acceptance and recovery

Verify independent publication preserves another area's edits; recover/merge a draft; save private notes independently; report/hide/restore each content type; paginate/search; inspect support; check keyboard/mobile flows and server audit. Prove students cannot read notes, drafts or report identities. Group-message reporting requires provable membership; legacy groups without it need membership repair first.

Prefer a forward fix with scheduling paused. Preserve private-field rejection, capability checks, archives, notes, reports, audit and publication history. Never restore public notes, the bootstrap admin fallback or broad scoped-role write permissions.

If withdrawing the frontend, use a compatible version from this release family or temporarily disable Admin Tools while preserving student reads. An older whole-config writer is not a safe rollback. Restore public settings through a reviewed scoped revision. Reconcile failed jobs before retry; do not replay created inbox entries. Use backups only under DBA control after a recovery rehearsal.

This checkout contains unrelated user changes. Review and stage only intended enhancement files/hunks before any later commit or release.
