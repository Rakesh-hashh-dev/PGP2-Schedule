# TermFlow / PGP2 — overall change inventory

Compiled 8 November 2026 from local Git history, the current working tree, project implementation/release notes, and historical session records. This covers major functional changes across sessions, rather than only the latest work. It is not a line-by-line account of every historical commit.

**Status boundary:** the latest local commit is `09ec147` (2 November), with package version 7.8.0. Many later additions remain uncommitted. A change in history is not proof of its current production deployment; hosted state has not been rechecked for this inventory. Historical test counts are not a single current whole-project test run.

## Earlier work present in committed history

1. **Timetable and schedule data:** Today, Tomorrow, Week, full-schedule and schedule-detail views; Google Sheet/Apps Script feed and bundled/cache fallback; section allocation and enrollment correction; term differentiation; overrides for room/time/class/exam; same-day session-specific override keys; cancellation visibility; fixes for stale prior-term overrides, section merging, feed dates and caching.
2. **Today workspace:** live class timeline, next-class details, preparation sheet, quick workflows, configurable dashboard widgets, removable/restorable Today Command, timetable-aware greetings, tomorrow/free-day scenes, pull-to-refresh and attendance skip hints.
3. **Planning and academics:** student and leave planners; attendance tracking and forecasts; assignment management and deadlines; exam matching and redesigned exam views; term/archive support; course hub with essentials, topics, after-class notes, revision/self-check tools and persisted learning details; continuous workload curve with hover/touch/keyboard detail.
4. **Mess Menu:** live and offline menu sources; Today meal card and weekly modal/bottom sheet; meal timings, rotation/parity fixes, breakfast extras, notices/disclaimer, ratings, source diagnostics, and presentation refinements.
5. **Navigation and responsive UI:** desktop sidebar, semantic Lucide navigation, V2 phone navigation and More hub, tablet navigation including large/fractional breakpoints, compact notification/alert dialogs, full-schedule modal improvements, browser-back and popup closing, light/dark/system themes and accessibility improvements.
6. **Notifications:** unified inbox store and read state; class reminders, morning summaries, cancellation/schedule-change events, manual and scheduled pushes; dispatcher and cron health/diagnostics; deep links, contextual actions, branding, expiry, preference and quiet-hour handling; compact bell and alert settings; social notification integration.
7. **Social workspace:** friends and requests, schedule comparison, groups and sharing/invites, group chat, polls, meetups/reminders, availability/status tools and free-time nudges; loading/read/save recovery fixes and revised group cards.
8. **Campus Board:** lost/found, for-sale and wanted posts, images, owner actions, renewal/expiry, realtime refresh, contact/share actions, reporting/moderation, gallery and threaded comments. The Diwali celebration category is a later local addition below.
9. **Split expenses:** groups, ledger, expense and settlement workflows, simplified/pairwise balances, receipt uploads, invites/join links, comments/itemization/import/export support, offline queueing and realtime; refined search, filters, overview and phone layouts.
10. **Companion system:** adoption, naming, persistence/sync, roster expansion to 32 companions, XP and level progression including level-cap/XP-inflation fixes, growth stages, timetable-aware moods, care interactions, hats/neckwear/coats and dressing room, species personalities/gaze/eyes/surface detailing, vector Luna and revised named companions, animation coordination/transitions, buddy greetings, habitats/decorations/lighting, memories/selected moments, daily routines, weekly insights/roadmaps/milestones, and motion/visibility guards.
11. **Admin Tools foundation:** schedule editing/command centre, roles and database-enforced permissions, analytics/presence, student tools, audit/configuration history, scheduled configuration, broadcasts/feedback, feature switches, companion controls and diagnostics. The 2 November app-controls change adds weekly/dated mess patches, timings, rotation, menu notices/feedback/source checks, configurable navigation, dashboard defaults, private drafts/versioning and resilient history loading.
12. **Platform and operations:** React/Vite PWA, offline/service-worker/cache/update behavior, installation UX, Clerk auth/migration recovery, Supabase/RLS/RPC/Edge Functions, Sentry monitoring, performance/loading work, custom-domain redirect, dependency upgrades, focused automated tests, migrations and release/recovery documentation.

## Additional local work across the more recent sessions

### A. Admin Tools enhancement programme — 13 phases

All phases are recorded as implemented locally in `admin-tools-enhancement-progress.md`; deployment is pending.

1. Private, revision-checked student notes, legacy backfill/archive and public-config cleanup.
2. Explicit capabilities, permission presets, last-Superadmin protection and server-side auditing.
3. Atomic Schedule/Communications/System publication, version history and private scheduled jobs.
4. Scoped review/publish/history/restore and independent controls workflows.
5. Private autosave/recovery, three-way merges and navigation guards.
6. Reports for Board posts/comments, polls and group messages, with moderation decisions.
7. Moderator queue and role-based workflows.
8. Notification diagnostics with bounded evidence and paused-dispatch status.
9. Affected-student previews, atomic inbox fanout and duplicate-alert suppression.
10. Operational search, stable pagination, bounded exports and publication-history investigation.
11. Student support summaries combining notification/private-note investigation.
12. Commands, keyboard navigation, pinned shortcuts and safe saved filters.
13. Local/schema-rehearsal verification and release/recovery instructions.

### B. Saved class-note reminders

- Timed reminders on Today for saved notes relevant to an upcoming class.
- Prefer exact-session notes; otherwise use the latest applicable previous session.
- Entry/soon states, duplicate/opened suppression, account/day-scoped history.
- Persistent access to notes through the preparation sheet, including focus on the notes section.
- Course-note refresh event integration.

### C. Additional companion and data changes

- Further uncommitted eye, face, surface, ground/finish/charm and roster-art refinements remain in the checkout alongside their tests and artwork tooling.
- Schedule snapshot/data changes also remain user-owned uncommitted work. They are not all attributable to the latest tasks.

### D. Notification message overhaul

- Shared message builders for inbox/push/social toasts/bell.
- Absolute class/meetup start times, explicit cancellation dates/session context, actual room/time changes, and admin notes appended after essential details.
- Exam/deadline-first morning summaries and factual clear-day/holiday wording.
- Consistent social membership language and contextual Campus Board previews.
- PC/Android/iPhone admin recipient previews and simulated tap actions.
- Accurate local display-test and queued-versus-delivered wording.
- Generic duplicate digest retired; provider TTL capped by event expiry; stale nudges discarded and fresh ones preserved on inbox failure.
- SQL/JavaScript message parity and actual Edge Function entrypoint tests.

### E. Diwali experience

- Optional festive Today corner, warm accents, vector diya and rangoli motif.
- Persistent per-account/event/device diya, mode, scarf and fireworks choices.
- Temporary festive scarf across greeting/cameo/companion page without changing saved wardrobe or progression.
- Replayable greeting and locally generated downloadable PNG card with the student's companion.
- Celebrations Board category with photos/comments, existing reports/moderation and database constraints excluding marketplace price/contact fields.
- One preference-aware festive event per subscribed account, with quiet hours, expiry, deduplication and dispatch-time campaign checks.
- Verified 2026 date/IST window and staged admin date/campaign/greeting controls.
- “With warm wishes, Rakesh” sign-off on the banner.
- Optional background fireworks: no sound, reduced-motion/hidden-tab handling, bounded particles/resolution, lighter phone settings and no frame loop between bursts.

### F. Private drafts and shortcut UI refinement

- Clear per-area loading, read-only, clean, pending, saved, recovery and error states.
- Current saved-payload matching takes priority over older successful-save timestamps and ignores irrelevant JSON object-key ordering.
- Inline recovery/discard confirmations, contextual retry/reload, private-versus-published explanations and accessible status announcements.
- Grouped/searchable shortcut cards, explicit count/limit, permission-filtered choices, prominent pinned tools and useful empty state.
- Clear-shortcuts preserves filters; full workspace reset is separated and confirmed.
- Responsive workspace columns/container layouts and visible keyboard focus styles.

## Reverted, superseded or unverified work

- The October companion anatomy redesign was reverted; do not treat the abandoned version as the final artwork.
- The earlier sidebar profile-popup redesign was reverted; it is not a current completed enhancement.
- Historical release/rollback commits exist, including the September return to the `29c1c11` snapshot. Features from reverted commits should not be assumed current merely because their commit messages exist.
- Mockups, local builds, SQL fixtures and source-based reviews do not prove current hosted rollout or device rendering. New Admin Tools, notification, Diwali and workspace-UI work still needs an appropriate reviewed release.
- Actual signed-in/browser/device verification remains outstanding where stated in the feature-specific documents.

## Supporting project documents

- `admin-tools-enhancement-progress.md`, `admin-tools-enhancement-verification.md`, `admin-tools-enhancement-release.md`
- `admin-controls-implementation-plan.md`, `admin-controls-verification.md`
- `notification-message-implementation.md`
- `diwali-implementation.md`
- `admin-workspace-ui-review.md`
- `companion-detailing-plan.md`, `companion-artwork-review.md`
