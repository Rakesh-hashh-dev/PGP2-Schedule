# Admin backend repair — 2026-11-09

Applied to the existing PGP2 Supabase project `fzhfbttlbfpnwhempyav` at the user's request to fix all reported schema-cache errors. No Git commit, push or frontend deployment was performed.

Applied all ten `20261104*_admin_*.sql` migrations and `20261108120000_notification_message_copy.sql` in one transaction, with corresponding migration-history records and PostgREST schema reload. Older unrelated migration-history gaps were left unchanged. Deployed the matching `send-push`, `class-reminders`, `dispatch`, `schedule-diff` and `apply-scheduled-config` functions with their shared imports. Existing gateway JWT settings were preserved.

The configuration scheduler was paused during cutover. Its stored bearer was invalid, so it was replaced with the project's verified service-role JWT without logging the key. The scheduler function now forwards the caller's bearer for PostgREST validation and database service-role enforcement rather than comparing it with one runtime key string. Its authenticated smoke test returned HTTP 200 with `applied: 0, failed: 0`; no due jobs existed during the probe. The normal one-minute schedule was restored.

Validation:

- All ten isolated SQL migration suites passed again.
- A fresh hosted public-schema export and synthetic upgrade tests passed.
- The exact combined repair transaction and hosted upgrade tests passed in an isolated database.
- Notification publication/copy SQL tests and five SQL/JavaScript message parity scenarios passed.
- Live authenticated-role SQL exercised publication loading, draft loading, diagnostics, all five search datasets, report queue and both missing tables. Draft-save and publication checks ran inside a rolled-back transaction.
- All six reported REST endpoints resolved in the live schema cache; anonymous RPC execution was denied and tables exposed no anonymous data.
- All five deployed functions rejected unauthenticated requests.
- Live checks confirmed 11 recorded migrations, clean public config, RLS enabled and anonymous execution denied for the affected admin functions.
- `git diff --check` passed.

Local ignored evidence and recovery files are under `.local/admin-repair-*`; these include configuration/admin/scheduler backup, schema export, exact transaction and migration hashes. They contain private configuration and must remain local. Browser interactions in the user's signed-in preview and real push-provider delivery were not tested. No test broadcasts or user role changes were made.
