# New features — deploy / test checklist (2026-07-15)

Six features added (client) plus two backend pieces. **Nothing deployed yet — test locally first.**

## Client-only (work as soon as the build ships — no backend)
- **Courses** view — per-course cards (faculty, room, credits, progress, attendance). Sidebar + overflow menu.
- **Insights** view — weekly recap (contact hours by day, area split, attendance %, busiest day).
- **Deadline strip** — "Next 7 days" exams + assignments rail on the Today view.
- **Mess favourites** — star dishes in the full-menu modal; highlighted everywhere + "favs today" pill. Local per device.
- **Cancellation banner** — in-app alert on Today/Tomorrow for your cancelled classes (reads existing admin overrides). Works with no backend change.
- **PWA deep links** — `?view=today|week|attendance|assignments|courses|insights|…` now switches view on load; home-screen shortcuts expanded (Today / Week / Attendance / Assignments).

## Backend pieces — apply when ready (both optional; features degrade gracefully without them)

### 1. Cancellation push notifications
- **Files:** `schedule-app/supabase/functions/class-reminders/index.ts` (extended),
  `schedule-app/src/lib/push.js` + `src/components/NotificationsPage.jsx` (new toggle).
- Adds a step that pushes a notification when an admin marks one of a user's
  enrolled classes cancelled (today still-upcoming + all of tomorrow). Deduped
  via `reminder_log` like existing reminders, so it fires once.
- Has its **own on/off switch** in Announcements → reminder settings ("Cancellation
  alerts"), stored in `push_prefs.cancellation_alerts` (default on) — independent
  of per-class reminders.
- **Migration (required for the toggle):** `supabase/migrations/20260715130000_cancellation_alerts_pref.sql`
  — adds the `cancellation_alerts` column. Run it *before* deploying the function.
- **Deploy:** run the migration, then `supabase functions deploy class-reminders`
  (same cron/secrets as today — no new secrets).
- **Test:** in Admin → cancel an upcoming class you're enrolled in, wait for the 5-min cron (or invoke the function with the `x-push-key` header). The in-app banner shows immediately regardless.

### 2. Cohort mess ratings ("what's good today")
- **Migration:** `schedule-app/supabase/migrations/20260715120000_mess_ratings.sql`
  — creates `mess_ratings` table + `get_mess_meal_stats(day)` RPC (Clerk-sub RLS).
- **Client:** `src/lib/messRatings.js` + thumbs up/down UI in the mess card / full menu.
  Until the migration is applied the RPC 404s and the rating controls stay hidden
  (favourites still work) — so this is safe to ship before running the migration.
- **Apply:** run the migration SQL in Supabase (SQL Editor or `supabase db push`).
- **Test:** open the mess card while signed in → rate today's meal → the "% liked · N" aggregate updates.

## Not committed / not pushed
Per workflow, no git commit/push and no Supabase deploy has been done.
