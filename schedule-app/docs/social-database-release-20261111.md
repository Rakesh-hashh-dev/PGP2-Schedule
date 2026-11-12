# Social database release - 11 November 2026

Applied to linked PGP2 project `fzhfbttlbfpnwhempyav` at the user's explicit request. The frontend and functions were not deployed; Git was not committed or pushed.

Applied in one guarded transaction:

- `20261111130000_social_plan_proposals`
- `20261111140000_social_group_chat`
- `20261111150000_social_availability_lifecycle`

Older unrelated migration gaps were left unchanged. Verified transaction SHA256: `00197b468ec4fb91fe613b2afbfd091d9aced15c4373bf02ebd6934b1d7d8352`.

The first attempt caught anonymous trigger-function execution inherited from hosted default grants and rolled back completely. Absence of new objects/history was verified. Explicit revokes and the local default-grant fixtures were corrected. The exact production transaction passed rehearsal in PostgreSQL17 under those defaults before the successful retry.

## Compatibility and remaining release step

Existing clients retain their pre-existing plan UPDATE and RSVP INSERT/UPDATE privileges during this database-first release. No extra legacy permissions were granted. New private tables, collaborative RPCs and trigger functions have explicit role restrictions and RLS.

After the matching frontend is separately released and verified, refresh old clients and apply `supabase/operations/social-lifecycle-rpc-cutover.sql` to require version-checked lifecycle/RSVP RPCs. This operation was **not** applied now. The updated `class-reminders` deployment is also separate.

## Verification

- Hosted assertions passed for new tables/RLS, six RPCs, three internal trigger functions, columns, triggers, grants, realtime publication and all three migration-history entries.
- Previous55 migration versions were preserved; exactly three versions were added.
- Row counts across seven existing affected tables were unchanged between captured preflight and verification; same-transaction count/history invariants also passed.
- Eleven anonymous REST checks resolved the new schema and denied access without returning user records or performing successful mutations.
- Exact release, legacy compatibility, later permission cutover and scheduling/chat/consent assertions passed in disposable PostgreSQL17.
- Project and user-wide Supabase CLI versions both verified as **3.1.0**. Project version is pinned; lockfile changes are limited to CLI/platform packages.

Ignored evidence and policy backups are under `.local/social-release-20261111/`; keep them local. No production test notifications, fixtures or profile changes were created.
