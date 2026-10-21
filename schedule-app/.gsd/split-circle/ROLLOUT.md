# Split v7.3 staged rollout - 2026-10-10

## Current state

- PGP2 Supabase project: `fzhfbttlbfpnwhempyav`, PostgreSQL 17.6.
- Stage A expansion and Stage B cutover applied and verified; feature version 1, phase active.
- v7.3 Vercel deployment built successfully: `dpl_6B1guGiS47b1NJyk2nJW6gc9pEr7`.
- v7.3 promoted to the production domain; live metadata verified. User confirmed sign-in, Split and other pages work; actual browser expense cycle not performed.
- Stage B registered as `20261010020000_split_circle_cutover`; advanced cloud features enabled.
- Social migration `20261008120000` intentionally deferred. No Git commit/push.

## Preservation and checks

Production preflight found 1 Split group and no expenses, shares, settlements or receipt objects. Post-expansion checks prove unchanged row counts, totals, anomalies, original grants, policies, active triggers, legacy join function and bucket settings. Existing realtime columns remain published; only new Split columns/tables were added. After Stage B, all nine Split tables and receipt-object metadata match the fresh pre-cutover backup exactly. Financial counts/totals and anomalies remain unchanged; receipts are private, audit/group validation triggers active, direct expense/share writes restricted.

Validation: 26 PostgreSQL authorization checks, 14 staged production-backup restore and rollback checks, PostgreSQL 17.6 expansion/cutover/rollback/recutover rehearsal, and 19 browser checks using actual components/CSS with mocked services. Isolated committed-baseline-plus-Split frontend: 48 test files / 473 tests passed and production build passed. Vercel build passed with 2447 modules and 117 PWA entries. User confirmed production pages after signing in. An actual browser expense save/delete cycle, realtime delivery, storage uploads and external OCR downloads remain unverified. Production SQL checked the authenticated database role with synthetic subjects; it did not validate an OAuth exchange or browser-to-API expense request.

The Vercel upload manifest was reviewed: environment files and `.vercel` excluded; no private database backups or unrelated dirty Social/Attendance source changes uploaded. Scope is recorded in `.local/split-release/client-scope.json`. Build metadata is `7.3.0+local` because this reviewed release snapshot has no Git commit; app displays v7.3.

## Backups and evidence

Private ignored evidence is under `.local/split-release/`: consistent Split JSON backup, full project schema/data/roles logical exports, checksums, before/after catalogs, deployment responses and test logs. Split had zero receipt objects, so no receipt file bytes were required. Logical storage exports contain metadata, not object bytes. Restore needs a matching Supabase platform schema for managed auth/storage objects. The platform reports WAL backup support but no listed restorable backup and PITR disabled; do not assume automatic point-in-time recovery.

Full logical export SHA-256 values:

- schema: `a120631f2d70f8290bd171c303b902ac87854d3e296234c241c874dd7974a6e3`
- data: `b93ca856f0e4aac747d84019de005d945cfaa10befe0b8725948f007fecd2329`
- roles: `25873cec56a2cc6514e204f420231777f85c03da818caa7090cdcdfa89776ecd`

Database harness and staged results: `../../.repo-analysis/splitcircle/validation/`. Previous production deployment: `dpl_Ep2tZ1N3z47jSJ3UiRP28DQGfeo8`, `https://pgp-2-schedule-fqegri5iu-rakesh-hashh-devs-projects.vercel.app`; private JSON copy also saved before deployment.

## Activation gate and live smoke checks

Frontend metadata/assets/PWA and OAuth callback route were verified before promotion. The user confirmed signed-in pages and existing Split/timetable/attendance work; they did not perform an expense test. To validate production writes, an authenticated-role transaction tested legacy create/edit/share replacement and the new RPC create/edit/delete, exact shares, retry deduplication, stale-version rejection, invalid-share rejection, outsider isolation and settlements. All test records rolled back.

A fresh consistent nine-table backup was captured and hashed before cutover. The exact cutover was promoted to `20261010020000_split_circle_cutover.sql`. The application wrapper took bounded write locks, rejected any ledger changes since backup, applied the cutover, then ran another authenticated-role smoke test inside a savepoint. This verified blocked legacy writes/join links, atomic RPC writes, server audit, comments, private preferences, invitation revocation and settlements. Every test record was rolled back to the savepoint before migration history registration and commit. Any unexpected error would have aborted the whole cutover.

Post-commit checks prove version 1 / active, private receipt bucket, expected triggers/revoked direct-write grants, unchanged nine-table ledger and receipt metadata, and both Split migrations recorded with Social still absent. Private evidence: `smoke-expansion-response.json`, `pre-cutover-backup-manifest.json`, `cutover-apply-response.json`, `final-verification.txt`. Rehearsal containers were removed after their IDs and network isolation were checked.

Existing sessions must refresh to pick up the active capability. Owners must replace old UUID invitation links with secure tokens. Continue observing live browser saves, realtime, receipt upload and OCR; do not treat SQL checks as end-to-end browser verification. No test notifications or invitation messages were sent.

## Rollback

Before Stage B, keep the additive schema and promote the saved previous Vercel deployment if the new client regresses. `sql/deactivate.sql` leaves data intact and refuses deactivation if advanced data would be hidden.

After Stage B, first run `sql/rollback-cutover.sql` if restoring former permissions/receipt/invitation behavior is required. It retains all new schema, financial records, comments and history, and keeps feature version 1 / compatibility so v7.3 remains usable. It restores the old, less restrictive security rules and is an incident fallback, not the normal operating mode. If advanced records exist, retain v7.3 rather than hiding those fields through an older client. Do not drop tables, overwrite live data or repair/delete migration history to roll back.

## Migration queue

A normal `supabase db push` now warns about the older deferred Social migration missing remotely. This is expected because Split expansion was deliberately applied alone. Do not apply all pending migrations automatically or repair Social as applied. On a separately authorized Social release, inspect `--include-all --dry-run` and validate that migration before applying it. Both Split migrations are now present locally and registered remotely. Do not edit an already-applied migration to deploy future changes; add a new migration.
