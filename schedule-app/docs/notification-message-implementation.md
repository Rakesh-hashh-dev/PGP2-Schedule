# Notification message changes — 8 November 2026

Implemented locally from `mockups/notification-messages-review.html`.

- Shared message builders supply absolute class/meetup times, clear cancellation context, exam/deadline-first summaries, factual clear-day wording, cautious availability nudges, and contextual social/Board messages.
- New social messages share wording across push, inbox, bell, and live toast. Existing stored history is preserved.
- Admin publication notices retain verified date/time/section and changes before any custom note. Their preview uses the same SQL copy as insertion, with before-values from the previously effective timetable.
- Recipient previews offer PC / Windows, Android, and iPhone with compact/expanded cards and simulated taps. Images remain supplementary; iPhone previews use body-tap navigation without assuming buttons.
- Local tests explicitly describe display testing. Admin success states describe queued users rather than claiming devices displayed a message.
- The legacy `send-push` generic digest mode is a successful no-op. Personal opt-in summaries remain owned by `class-reminders`.
- Provider TTL is capped by event expiry. Old availability nudges are discarded; fresh nudges are deleted only after inbox insertion succeeds.

## Validation

Focused Vitest suites cover message generation, real Edge Function entrypoints with isolated storage/provider doubles, deep links, browser action limits, worker clicks, preference suppression, expiry, quiet hours, and duplicate cron runs.

`node scripts/verify-notification-messages.mjs` runs the publication migration prerequisites and both existing publication tests and new message-copy tests using in-memory PostgreSQL. It does not connect to Supabase. The optional PGlite dependency is installed only under ignored `.local/notification-sql-runtime` and is not a product dependency.

Production compilation uses `npx vite build --outDir .local/notification-message-build`, bypassing the snapshot-mutating prebuild hook. Native Windows/Android/iPhone rendering and real delivery have not been verified by these checks.

## Release requirements

No migration, function, or web deployment was performed. Apply `20261108120000_notification_message_copy.sql` after the existing admin publication migrations, deploy `class-reminders`, `schedule-diff`, `send-push`, and `dispatch`, and release the web app. The shared helper files are imported by these functions and must be included in function packaging. Existing admin feature work in the checkout remains a prerequisite of this release; this change does not deploy or discard it.

After release, use a targeted admin test to check PC and mobile delivery with the app open and closed. Inspect actual clipping, body taps, and available actions on each device. Verify a daily summary with an exam/deadline, a cancellation, and an admin publication note. Do not infer device display from a queued row or provider acceptance.
