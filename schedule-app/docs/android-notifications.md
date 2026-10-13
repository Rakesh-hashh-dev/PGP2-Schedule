# Android push presentation

TermFlow uses standard web notifications. A single title/body is rendered collapsed or expanded by Android/Chrome; custom CSS, separate state-specific titles and exact colours are not supported in the system tray. The mockup and Admin broadcast preview are illustrative.

## Branding and actions

- `icon-notification.png` exports the current `termflow-icon.svg`; `badge-notification.png` is its simplified monochrome compass. Run `node scripts/generate-notification-icons.mjs` after a logo change.
- The worker always supplies those assets, including for old payloads with clock/bell icon overrides.
- Dispatch uses `_shared/pushPresentation.ts` for contextual actions and optional `data.image`. Actions are limited to two or the browser's lower limit. Tapping still works when buttons or images are unsupported.
- Class reminders open a focused timetable row via `view=fullSchedule&date=…&code=…&start=…`. The secondary action opens Today.
- Cancellations and schedule changes open Announcements, so hidden timetable rows have a useful fallback. The secondary action opens Today.
- Daily summaries and explicit `send-push` requests with `mode: "digest"` offer Today and This week. Automatic digests put the first class on the first body line and subsequent slots below, followed by existing exam/deadline extras. Holiday/no-class copy stays intact.
- Broadcasts preserve a supplied destination, otherwise open Announcements. Dismiss only closes the tray notification; it does not mark the in-app item read.
- Event poster URLs must use HTTPS or an absolute local path. Immediate, targeted, scheduled and template broadcasts carry the optional image through the existing JSON metadata; no migration is needed.

## Preview and release

Open `/mockups/android-push-preview.html` on the Vite dev server for switchable scenarios. Admin Tools → Broadcasts also shows both states while composing a push. Preview actions never send anything.

Release the web app (including `public/push-sw.js` and both new PNGs) and the Supabase functions `dispatch`, `send-push`, `dispatch-scheduled-pushes`, and `class-reminders`. New clients can display legacy server payloads; old clients can still open new payloads, but contextual actions require the new worker. Existing delivery preferences, quiet hours, deduplication tags and retry/TTL logic are retained. No deployment or notification send is performed by the implementation checks.

Final device acceptance: use a targeted test on an installed Android PWA; inspect collapsed/expanded states, logo/badge and image with permission enabled. Check each action and body tap with the app closed and already open, and verify one notification per event. Also check a no-class digest and a digest with several classes. Desktop previews and worker unit tests do not establish actual Android rendering.
