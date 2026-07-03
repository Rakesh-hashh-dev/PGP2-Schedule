# TermFlow — PGP2 Schedule

A timetable, attendance, and social planner for the PGP2 (MBA) batch at IIM Sambalpur. Installable as a PWA, it shows today's classes at a glance, tracks attendance per course, and lets classmates share schedules, form groups, and get push notifications when the timetable changes.

## Features

- **Today & week views** — timeline of today's classes plus a full week agenda, with subject filtering and a full-schedule page for the whole term.
- **Attendance tracking** — mark classes as attended/skipped (with an end-of-class prompt), see per-course skip stats, and sync marks to the cloud across devices.
- **Friends & groups** — share your schedule via a share code, compare timetables side by side, organize friends into groups (with undo delete), and ping friends. Updates arrive live via Supabase realtime.
- **Notifications** — in-app notifications page with per-item read tracking, plus Web Push for schedule changes (delivered by a Supabase Edge Function).
- **Assignments & exams** — panels for tracking deadlines and exam schedules.
- **Recent changes** — diff of what changed in the timetable since you last looked.
- **Admin dashboard** — restricted to admin emails; includes a command palette and audit logging (see [ADMIN_TOOLS_MANUAL.md](../ADMIN_TOOLS_MANUAL.md)).
- **PWA** — offline-capable via Workbox caching, home-screen install, app shortcuts (Today / Attendance), and an in-app update prompt when a new version is deployed.
- **Extras** — weather widget (Open-Meteo), command palette, feedback widget, semester summary.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite, lucide-react icons, dnd-kit |
| Auth | Clerk (Google sign-in, restricted to `@iimsambalpur.ac.in`) |
| Backend | Supabase (Postgres + RLS via RPCs, realtime, Edge Functions) |
| Schedule source | Google Sheets via Apps Script feed (`google_apps_script.js` in the parent folder) |
| Push | Web Push (VAPID) — `public/push-sw.js` + `supabase/functions/send-push` |
| Hosting | Vercel (with Analytics + Speed Insights) |

## Getting started

```bash
npm install
npm run dev
```

Create a `.env.local` with:

```
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_VAPID_PUBLIC_KEY=...
```

Push notification setup (VAPID keys, edge function deploy) is documented in [PUSH_SETUP.md](../PUSH_SETUP.md).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (PWA enabled in dev) |
| `npm run build` | Regenerate the schedule snapshot, then production build |
| `npm run snapshot` | Fetch the latest schedule into `src/data/` for offline-first boot |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## How data flows

1. The timetable lives in a Google Sheet, exposed as JSON by an Apps Script web app.
2. At build time, `scripts/generate-snapshot.mjs` bakes a snapshot into `src/data/` so the app renders instantly offline; at runtime the app re-fetches the live feed and diffs it (SHA-256) to detect changes.
3. User state (attendance, profile, friends, groups, pings, read state) syncs to Supabase; all writes go through RPCs so RLS stays locked down.
4. Each production build writes `dist/meta.json` with a build version; the app polls it and prompts users to refresh when a new deploy lands.

## Project layout

```
src/
  App.jsx            # Main app shell, view routing, sync orchestration
  ClerkApp.jsx       # Clerk provider wrapper
  components/        # Timeline, WeekAgenda, AttendancePanel, FriendsPanel, ...
  lib/               # supabase, attendance, friends, profile, push, sheet clients
  data/              # Baked schedule snapshot + course/area metadata
supabase/functions/  # send-push edge function
scripts/             # generate-snapshot.mjs (prebuild)
public/push-sw.js    # Web Push service-worker handlers
```
