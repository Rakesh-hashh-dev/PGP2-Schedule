# Admin Panel Roadmap

Plan only, written 2026-10-03 from a read-only review by an Opus planning agent. No code has changed. Citations are the agent's and have not all been independently re-checked.

Paths are relative to `schedule-app/` unless noted.

## Corrections to earlier assumptions
- There are **8 tabs**, not 5: overview, broadcast, schedule, users, insights, moderation, database, system (`ADMIN_TABS`, `src/components/AdminDashboard.jsx:340`).
- Migrations and edge functions live in `schedule-app/supabase/`, not the repo-root `supabase/` (which holds only `.temp`).
- `docs/notification-architecture.md` does not exist, although `migrations/20260717120000_social_notifications.sql:10` references it.
- Most of `docs/admin-tools-suggestions.md` is already built (`src/components/AdminWorkflowPanels.jsx`, `src/lib/adminWorkflow.js`): support queue, data quality monitor, schedule-change preview, audience builder, feedback triage, adoption trends, attendance risk, change timeline, incident center, handoff notes. None are re-proposed here.

## What each tab does today
- **Overview**: attention metrics, priority task queue, quick-launch tiles, scheduled-activity agenda, recent audit entries, Incident Center, Handoff Notes.
- **Broadcast**: in-app banner (staged, targetable), web push (now or scheduled, quiet hours), social flash (realtime), Mission Control with `PushDeliveryDiagnostics`, App Content Hub, Feedback Flash scheduler, announcements list.
- **Schedule**: Command Centre (week ribbon, drag-to-swap, quick cancel/room/edit, undo), Data Quality Monitor, impact view, holiday range cancel, room relocation, conflicts, class editor, copy overrides, bulk CSV import, Active Overrides hub. Everything is staged into `flags.classOverrides` and goes live via Review & Deploy (drift guard plus impact preview).
- **Users**: cohort overview, support queue, onboarding funnel, directory (filters, bulk select, staged ban, CSV), inactive users, share-code hygiene, feedback triage, user inspector (role, courses, notes, pet tools, view-as, direct push, clear status, reset onboarding).
- **Insights**: weekly presence, DAU/WAU/MAU, feature adoption, adoption trends, attendance risk, change timeline, cron health, self-test, admin leaderboard, Sentry link, API probes, sync logs.
- **Moderation**: only live-status clearing and the admin audit trail.
- **Database**: read-only explorer, 8 hardcoded tables, `select * limit 50`, under the admin's own JWT.
- **System**: ops console, maintenance window, admin roles, config backup/restore, scheduled deploys, config history/rollback, feature flags, companion settings, A/B tests, Time Machine, drift, health-alert recipients, Danger Zone.
- **Cross-cutting**: realtime admin presence, command palette, read-only monitor role.

## Verified gaps

### A. Security and privacy (highest priority)
1. **"Private" admin notes are world-readable.** Stored in `flags.adminNotes` (`AdminDashboard.jsx:6313-6326`); `system_config` has public SELECT (`migrations/20260906120000_admin_roles_and_draft_store.sql:140-143`) and every client loads it (`src/App.jsx:829`). Same for `flags.feedbackTags` (5008), `flags.alertRecipients` (5802-5822), `flags.bannedUsers`. `src/lib/adminStore.js:6-12` already documents that `flags` is world-readable.
2. **Three admin RPCs lack an `is_admin()` gate** and are granted to all authenticated users: `get_admin_stats()` (returns `push_user_ids`, `migrations/20260717150000_get_admin_stats.sql:39-43,66`), `get_push_broadcast_stats()` and `get_cron_health()` (`20260731120000_admin_insights_rpcs.sql:40,83`).
3. **Bans are client-only** (`src/App.jsx:2193`) and staged until deploy (`AdminDashboard.jsx:4620-4625`). A banned user's JWT still writes to `board_posts`, `polls`, `group_messages`, `meetups` and social `notifications`.
4. **Board admin check is weaker**: `is_termflow_admin()` matches a hardcoded email list against self-stamped `profiles.email` (`20260720120000_board.sql:17-28`), ignoring `public.admins`.
5. **Legacy group chat is open to every signed-in user**: `study_group_can_access` returns true when a group has no invite row (`20260923120000_study_group_invites.sql:143`).
6. **health-monitor reads recipients from `flags.adminRoles`** (`supabase/functions/health-monitor/index.ts:43`), but roles moved to `public.admins` (`AdminDashboard.jsx:214-222`).

### B. No admin control over user-facing features
7. Board has no admin UI; posts auto-hide at 3 reports with no review or restore (`board.sql:85-93`); `reported_by` stores no reason.
8. Cohort polls: only the author can update or delete (`20260719120000_polls.sql:57-63`).
9. Group messages: only the author can delete (`20260721000000_group_chat_rls.sql:3-4`); the client 30-day purge (`src/lib/friends.js:702`) can only delete the caller's own rows.
10. **Two toggles do nothing**: `flags.features.splits` and `flags.features.polls` (`AdminDashboard.jsx:5905,5916`) are never read; the app reads only `enable*` flags (`App.jsx:2223-2229`). Board, mess ratings, course hub and study groups have no kill switch.
11. No admin view of mess rating trends (only per-day `get_mess_meal_stats`).
12. Feature usage covers only 3 features (`migrations/20260927200000_feature_usage_days.sql:5`, `src/lib/featureUsage.js:6`).
13. Notification visibility covers only `admin_broadcast`; `class_reminder`, `daily_summary`, `class_cancelled`, `schedule_change`, `meetup_reminder`, `free_nudge`, `health_alert` have none.
14. Room and time overrides don't notify students directly; only cancellations do (`class-reminders/index.ts:276-305`).

### C. Admin tool quality
15. Database explorer shows partial data under RLS (`meetups`, `split_groups` show only the admin's rows); `groups` and `group_members` are not created by any migration; 50-row cap, client-side search only.
16. Schedule drafts, versions and templates tables exist (`20260906120000...sql:239-283`) with a client API (`src/lib/adminStore.js`) but no component imports it.
17. Audit trail is client-written with a caller-supplied `admin_id` and swallowed errors (`src/lib/adminAudit.js`); Copy Overrides (3073-3082), Bulk CSV Import (3089-3121) and Remove Override (3041-3053) are unlogged.
18. `clearUserStatus` and the inspector clear/reset write back a stale `target.courses` JSONB (1896-1902, 6636-6645), which can clobber newer student edits.
19. Dead code: the `get-metrics` fetch still runs but its card was removed (325-329, 778-807).
20. Board posts and images are never purged; `expires_at` only filters reads (`src/lib/board.js:20`).

## Proposed additions

| # | Addition | Effort | Backend | Depends on |
|---|----------|--------|---------|------------|
| 1 | **Admin data privacy hardening** | S-M | `admin_user_notes`, `admin_feedback_tags`, private recipients store (RLS read `is_admin()`, write `can_write_config()`); migrate data and strip keys from `flags` and `stripHistoryKeys`; gate the 3 RPCs (allow `service_role` for `get_cron_health`); health-monitor reads `public.admins`; `admin_clear_status(p_user_id)` RPC using `courses - '_status'` | none |
| 2 | **Server-enforced restrictions (ban/suspend/mute)** | M | `user_restrictions` (user, scope, reason, `expires_at`, `created_by`); `is_restricted(scope)` helper added to INSERT/UPDATE policies of `board_posts`, `polls`, `poll_votes`, `group_messages`, `meetups`, `notif_social_insert`; app reads own restriction via RPC | #1 |
| 3 | **Community moderation queue** | M-L | `is_admin()` replaces `is_termflow_admin()`; `content_reports` table; `report_poll`/`report_group_message` RPCs; admin policies on `polls` and `group_messages`; `admin_moderation_queue()` RPC. UI: keep/restore/remove/restrict author, all audited | #2 |
| 4 | **Close legacy group-chat exposure** | S-M | backfill `study_group_invites` from `profiles.groups` or fall back to a member check; server-side retention cron | none |
| 5 | **Notification pipeline observability** | M | `admin_notification_volume(p_days)`, `admin_user_notification_debug(p_user_id)`, index on `notifications(type, created_at)` | none |
| 6 | **"Notify affected students" at deploy** | S (client) / M (server) | client: checkbox in Review & Deploy reusing `previewStagedScheduleChanges` IDs via `send-push` `target_user_ids`; server: `class_changed` producer with dedup | #5 helpful |
| 7 | **Wire up schedule drafts and versions** | M | none new; optional atomic `publish_draft` RPC; keep `flags.classOverrides` as single published truth | none |
| 8 | **Server-side audit integrity** | S-M | trigger on `system_config` UPDATE writing a key-level diff and `auth.jwt()->>'sub'`; `admin_id` from JWT; log the 3 unlogged actions | none |
| 9 | **Working feature kill switches** | S | flags only; merge `FEATURE_FLAGS` (81-89) and `flags.features.*`; add board, mess ratings, pet, course hub, study groups | none |
| 10 | **Social and feature adoption metrics** | S-M | widen `feature_usage_days` constraint and allowlist; `admin_social_stats(p_days)` RPC | none |
| 11 | **Mess feedback insights** | S | `admin_mess_rating_trend(p_days)` (aggregates, show n); CSV export | none |
| 12 | **Honest Database explorer** | M | `admin_browse(p_table, p_search, p_offset)` SECURITY DEFINER over a whitelist with redaction, server-side search and pagination; drop `groups`/`group_members`; audit each open | #1 |
| 13 | **Retention and storage hygiene** | M | pg_cron or edge function with dry-run; purge expired board posts and orphaned `board-images`, old messages and notifications; table size and bucket usage card; typed confirmation | #4 |
| 14 | **User inspector "360" panel** | M | `admin_user_overview(p_user_id)`, admin-gated and audited; counts and links, not message contents | #2, #5, #10 |

### Risks worth remembering
- #1: old config snapshots contain notes, so history needs scrubbing; check deploy order with health-monitor.
- #2: `notif_social_insert` is recreated in four migrations, so the new policy must carry the full type union.
- #3: admins reading group chat is a privacy concern, so show only reported messages with context; auto-hide at 3 reports can be abused for brigading, so the restore path matters.
- #4: could lock members out of old groups; do a dry-run count first.
- #5, #12, #14: sensitive surfaces; audit every lookup.
- #6: notification fatigue; dedup per override and respect quiet hours.
- #13: irreversible deletes; dry-run first.

## Phased order
- **Phase 1, hardening:** #1, #8, #9, plus the `clearUserStatus` fix and removal of the dead `get-metrics` code.
- **Phase 2, trust and safety:** #2, then #3 and #4.
- **Phase 3, operational reliability:** #5, #6, #7.
- **Phase 4, insight and hygiene:** #10, #11, #12, #13, #14.

**Build first:** #1 (live leaks, small, sets the gating pattern), #2 (bans are currently cosmetic), #3 (admins have zero control over the app's open user-generated content).

## Key files
- `src/components/AdminDashboard.jsx` (ban gate at `src/App.jsx:2193`, flag reads at `App.jsx:2223-2229`)
- `supabase/migrations/20260906120000_admin_roles_and_draft_store.sql` (`is_admin`, `can_write_config`, public `system_config` read, draft tables)
- `supabase/migrations/20260720120000_board.sql`, `20260719120000_polls.sql`, `20260923120000_study_group_invites.sql`, `20260717150000_get_admin_stats.sql`, `20260731120000_admin_insights_rpcs.sql`
- `src/lib/adminStore.js`, `src/lib/adminWorkflow.js`, `src/components/AdminWorkflowPanels.jsx`
- `supabase/functions/health-monitor/index.ts`, `supabase/functions/class-reminders/index.ts`
