# Social enhancements - 11 November 2026

All eight approved enhancements are implemented locally. Open **Social** in the main navigation, then use its **Overview**, **Friends**, and **Groups** sections.

| Enhancement | Where to see it | Changes |
| --- | --- | --- |
| Action-first Overview | Social > Overview | Connection requests and Needs your response precede confirmed plans and shared-time suggestions. Study preferences use a compact setup/edit control. |
| Better shared-time suggestions | Overview > Plan together > Shared free time | Compact person/circle, duration and days filters; expandable preferred hours; date-grouped slots over seven days; named participants and a prominent Plan this time action. Date, time, duration, participant IDs/names and group context carry into the composer. Your accepted plans/private blocks are excluded. |
| Alternative-time voting | A plan > Find a time; also pending invitations | Participants suggest one or several times and vote. Organisers confirm the leader or explicitly resolve a tie. Works for direct and group plans; changed times require fresh RSVPs. |
| Group workspace | Groups > open a group | Chat, Plans, Polls, Pins and Members sections. Cards show recent messages/unread activity and sort by activity. Existing member, privacy, invite and approval controls remain in Members. New group plans carry the group's invitees. |
| More usable chat | Groups > group > Chat | Timestamps/day separators/unread divider, loaded-history search, Load older messages, persistent reply references, account/group drafts, history-preserving live updates and reconnect reconciliation. Edit/delete/report/pin/poll actions remain available. |
| Availability trust | Overview > Plan together > Private busy time; Friends > Your friends; plan editor | Collapsed private-busy controls share one availability snapshot with suggestions, show counts and clear loading/error/empty states, and preserve unsaved input during removals/failures. Friend cards show Free now (timetable estimate), In class/In exam till, or Schedule unknown, with source/freshness details. Away and explicit status priorities remain intact. |
| Plan lifecycle | Overview > Upcoming confirmed plans > View all plans; or group > Plans | Going/declined/awaiting breakdown, Calendar export, organiser edit/cancel for this or future occurrences, frozen review versions, pairwise occurrence overlap warnings, stale-RSVP protection and updated reminder deduplication. |
| Actionable buddy discovery | Friends > Study-buddy preferences / Suggested Study Buddies | Shared-course/purpose filters, consent-aware reasons and shared-time windows. Connect to study sends a connection request; after acceptance, Overview/Friends > Plan after connecting > Plan study session opens an invitation for explicit review. Follow-ups survive form cancellation and expire after seven days or dismissal. |

## Cross-cutting changes

- Touch/keyboard-visible chat actions and labelled input; pressed filter states.
- Keyboard favourite sorting using the existing reorder handle.
- Account-scoped restored Social section, opened group, drafts and discovery state.
- Honest failed-write states, guarded asynchronous responses and complete paginated plan/busy queries.
- Participant-only scheduling data, same-group visible reply validation, atomic recurring mutations and narrow consent updates that preserve other profile fields.

## Validation

- Full Vitest suite: **1,000 tests passed across 109 files** after the planning UI and friend-status fixes.
- ESLint: **38 changed Social JavaScript/JSX files passed**.
- Actual prerequisite/new migrations and rollback assertions passed in disposable **PostgreSQL 17**: time proposals/votes, outsider denial, private blocks, atomic recurrence, stale RSVPs, consent preservation and chat reply/access rules.
- Production Vite/PWA build passed via `node scripts/verify-social-build.mjs`; isolated output: `F:/Web Dev/Antigravity/tmp/pgp2-social-build-20261111`.
- Diff check and strict UTF-8 check passed. Unrelated Admin changes match the saved baseline hashes.
- Browser access was checked again on12 November and remained unavailable; desktop/tablet/phone visual verification is outstanding. Production schema/permissions and11 anonymous REST probes were separately verified; signed-in interactions and realtime delivery were not verified.

## Release prerequisites

The three database migrations below were applied and verified on 11 November 2026; see `docs/social-database-release-20261111.md`. No Git commit, push or frontend/function deployment was performed.

The database-only expand phase is complete for these three migrations; unrelated historical migration gaps were preserved:

1. `supabase/migrations/20261111130000_social_plan_proposals.sql`
2. `supabase/migrations/20261111140000_social_group_chat.sql`
3. `supabase/migrations/20261111150000_social_availability_lifecycle.sql`

The lifecycle migration adds the RPCs and triggers while retaining the hosted frontend's existing plan UPDATE and RSVP INSERT/UPDATE privileges and current RLS. It grants no replacement legacy access. This permits the database-first rollout while the old frontend remains live.

**Pending after the separate frontend release:** release and verify the RPC-based edit, cancellation and RSVP flows, then explicitly apply `supabase/operations/social-lifecycle-rpc-cutover.sql`. That transactional operation checks both lifecycle RPCs and their authenticated execution access before revoking the three legacy direct-write privileges. It is outside migrations and must not run during the database-only stage. Existing older open clients must refresh onto the RPC frontend before cutover.

The updated `supabase/functions/class-reminders/index.ts` also needs a separately authorized deployment for revised reminder deduplication; it is not part of the database-only stage.

Database checks can be rerun with `pwsh -NoProfile -File scripts/verify-social-database.ps1`; this starts and removes a disposable local container without production credentials, host mounts or published ports. It tests legacy frontend compatibility after the expand migration, applies the operation only inside that disposable database, then runs the hardened RPC/RLS assertions.
