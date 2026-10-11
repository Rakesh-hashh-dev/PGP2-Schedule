# TermFlow Split v7.3

The local SplitCircle source was used to assess the product flows. TermFlow's implementation keeps React, Clerk identities, relational Supabase ledgers, realtime subscriptions, settlement reminders, and account-scoped offline entries. No SplitCircle framework or database replacement was introduced.

## Implemented

- Overview, groups, searchable expenses, monthly personal-share insights, category history, budget and spending spikes; separate currency balances and existing light/dark themes.
- Existing groups, payer identities, equal/exact/percentage/ratio splits, simplified and pairwise debts, settlements and notifications retained.
- Itemized participant assignments with proportional tax/tip/discount, optional group-default ratios, original currencies and saved manual exchange rates.
- Receipt photos with signed URLs, lazy English OCR, editable receipt text, extracted items and mandatory printed-total reconciliation.
- Expense dates/notes, discussion, server-written audit history, conflict versions and atomic expense/share writes with retry keys.
- Owner-issued seven-day, single-use, hashed and revocable invitation tokens; invitation survives the Google OAuth reload.
- Weekly/monthly schedules with anchored monthly dates; author reviews and posts each due occurrence. These are not unattended jobs and do not charge payments.
- Reviewed CSV imports, source-key deduplication across accounts, CSV exports and JSON ledger backup. Backup contains ledger data and preferences; receipt bytes, comments and audit history are explicitly excluded.
- Version metadata 7.3.0; app displays v7.3. Build identifiers retain the Git suffix used by the update checker.

## Validation

- Full Vitest: 52 files, 492 tests passed; includes 15 new Split domain tests and four login-handoff tests.
- PostgreSQL/PGlite: 26 migration/authorization checks passed, including legacy row preservation, atomic rollback, invalid shares, version conflicts, exact FX/item allocation, retry/import duplicates, recurrence anchors, invitation claims/revocation, history membership, private receipts, author-only edits, comments and private preferences.
- Actual components and CSS in isolated Chromium: 19 checks passed at 1440px, 900px and 390px; screenshots reviewed. Includes dark theme, filters, budget save, original debts, item allocations, draft preservation, comments, invite revocation, dialog focus, receipt-text reconciliation, FX save, CSV import, pre-migration fallback and read-error retry.
- Targeted ESLint passed. Production Vite/PWA build passed. Patch whitespace checked.
- Browser services were mocked and database validation used disposable PostgreSQL. User confirmed signed-in production pages after deployment. An actual browser expense save/delete cycle, live Supabase realtime/storage and image recognition through the external Tesseract worker/language downloads have not been verified. Receipt parsing and reconciliation were exercised; OCR errors retain manual entry.

Evidence: `.local/split-qa/` screenshots, browser results and build results. Database harness and result log: `../../.repo-analysis/splitcircle/validation/`.

## Staged production release

Stage A expansion (`20261010010000_split_circle.sql`) was applied to the linked PGP2 Supabase project on 2026-10-10 and registered in migration history inside the same transaction. Existing financial rows, old permissions, legacy join links and public receipt access were verified unchanged before cutover.

Stage B was promoted to `20261010020000_split_circle_cutover.sql`, applied and registered atomically after the user confirmed signed-in pages and production authenticated-role write checks passed. A second rollback-only smoke check ran inside the cutover transaction; failures would have rolled back the entire cutover. `split_features()` now returns version 1 / phase active. Validated RPC writes, audit triggers, private receipts and secure invitations are enabled; stale clients must refresh and owners must replace legacy invitation links. All nine Split tables and receipt-object metadata were verified unchanged after cutover.

v7.3 is live at https://pgp2.termflow.tech. The isolated frontend release contains committed baseline code plus the Split changes only. Unrelated dirty Social/Attendance work and the user's Vite port setting are preserved locally and excluded from deployment. No Git commit or push was performed.

See [ROLLOUT.md](ROLLOUT.md) for current live state, backup limitations, staged checks and rollback instructions. Original implementation checks above used the full local checkout; the isolated release separately passed 48 test files / 473 tests.
