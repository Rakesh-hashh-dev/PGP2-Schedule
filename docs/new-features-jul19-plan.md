# New Features Plan — 19 Jul 2026

Four features approved for planning from the feature-suggestion round:

| # | Feature | Surface |
|---|---------|---------|
| A | Polls (Groups + Announcements) | Social view, Announcements, push |
| B | PWA Glance improvements | Shortcuts, badge, new lightweight glance route |
| C | TermFlow Wrapped (semester recap) | New end-of-term view, shareable card |
| D | Campus Board (Lost & Found / marketplace) | New view, entry via **Tools** dropdown (mobile) + sidebar (desktop) |

Status: **plan only — no code yet.** Per workflow: implement locally, run dev server on
http://localhost:5701, user verifies in browser; no commit/push unless explicitly asked.

---

## A. Polls in Groups & Announcements

### Goal
Quick, low-friction polls ("move the CR meeting?", "dinner at 8?") inside group chat, plus
admin-authored cohort-wide polls surfaced on the Announcements page. Makes Social a
destination and gives admins a lightweight pulse-check tool.

### Data model (new migration `polls.sql`)
```sql
polls (
  id uuid pk default gen_random_uuid(),
  scope text check (scope in ('group','cohort')),
  group_id text null,            -- local group id (groups live client-side, shared via profiles jsonb)
  created_by text not null,      -- clerk user id
  created_by_name text,
  question text not null check (char_length(question) <= 200),
  options jsonb not null,        -- ["Yes","No",...] 2–6 options
  multi boolean default false,
  closes_at timestamptz null,    -- null = open until creator closes
  closed boolean default false,
  created_at timestamptz default now()
)
poll_votes (
  poll_id uuid references polls(id) on delete cascade,
  user_id text not null,
  choice smallint[] not null,    -- indices into options
  voted_at timestamptz default now(),
  primary key (poll_id, user_id)  -- one row per user; upsert to change vote
)
```
RLS: authenticated read all (cohort app, single batch); insert own vote (`user_id = auth jwt sub`,
same pattern as `mess_ratings` migration `20260715120000`); update/delete poll only by
`created_by` or admin. Cohort-scope insert restricted to admins (check via the same admin
mechanism `get_admin_stats` uses).

### Frontend
- `src/lib/polls.js` — createPoll / vote / closePoll / fetchPolls(scope, ids) / subscribePoll
  (Supabase realtime channel on `poll_votes`, same pattern as group chat in `friends.js`).
- **Groups**: render poll cards inline in the group chat stream in `FriendsPanel.jsx`.
  Simplest wiring: when a poll is created, also send a `group_messages` row with
  `text = "__poll:<uuid>"`; the chat renderer detects the marker and renders a `PollCard`
  instead of a text bubble. No change to message fetching.
- **Announcements**: cohort polls render as a distinct card type at the top of
  `NotificationsPage.jsx` (above the wash cards) while open; collapse into the feed once closed.
- `PollCard.jsx` — options as tap-to-vote rows, live result bars after voting (or after close,
  creator's choice), "n voted" count, close/delete affordance for the creator.
- Poll composer: "+ Poll" button in the group chat input row; for admins, a "New poll" action
  in the Admin dashboard's announcements/tools area.

### Notifications
- Group poll created → `sendSocialNotification(memberId, "poll", {...})` per member (existing
  fn in `friends.js`) so it lands in the unified `notifications` feed; optional push via the
  existing `send-push` edge function, respecting `push_prefs`.
- Cohort poll → one broadcast row in `notifications` + scheduled/instant push through the
  existing dispatch path. **Align event `type` naming with docs/notification-architecture.md**
  so this doesn't add a fifth ad-hoc channel (the doc's core complaint).

### Effort: ~2–3 sessions. Riskiest bit: group membership is client-side/shared-JSONB, so
poll → member resolution reuses whatever `shareGroupWithMembers` already records.

---

## B. PWA Glance improvements

### Goal
Make the installed app useful in the 3 seconds before it fully boots, building on the
existing `docs/pwa-glance-mockup.png`, badge-on-push work, and deep links.

### Scope (in)
1. **Glance route** — new deep-link view `?view=glance` (add to `DEEP_LINK_VIEWS` in
   `App.jsx`): a single dense card with next/current class (name, room, countdown), today's
   remaining classes count, next deadline from `upcomingDeadlines()` (`lib/insights.js`),
   and today's mess meal (`data/messMenu.js`). Renders entirely from cached/local data —
   no Supabase wait — so it paints instantly offline (service worker already caches the shell).
2. **Manifest shortcut** — replace the least-used of the 5 shortcuts (Android surfaces max 4,
   per the comment in `vite.config.js`) with "Glance" → `/?view=glance`. Needs a
   `shortcut-glance.png` via `scripts/generate-shortcut-icons.mjs`.
3. **Smarter app badge** — unify badge count: unread announcements + unread social +
   active cancellation alerts, set via `navigator.setAppBadge` both from the page (on state
   change) and from `push-sw.js` on push receipt (extend the existing badge-on-push code).
4. **Notification enrichment** — morning class-reminder push body gains a one-line day
   summary ("4 classes · first at 9:00 · CFA quiz due") — computed in the `class-reminders`
   edge function from data it already loads.

### Scope (out — noted, not planned)
Windows/Edge PWA Widgets API and Android widgets: too niche/unstable for this cohort;
revisit only if users ask.

### Effort: ~1–2 sessions, no schema changes. Item 4 touches a deployed edge function —
deploy only after user verification.

---

## C. TermFlow Wrapped (semester recap)

### Goal
End-of-term shareable recap: classes attended, attendance %, most-skipped course, busiest
week, earliest class survived, favourite mess dish, deadlines beaten. Pure fun, zero new
data collection, strong word-of-mouth.

### Data sources (all existing)
- `attendance` table + `courseStats()` / `weeklyRecap()` in `lib/insights.js`
- Local schedule data (`data/schedule.js`) for totals, busiest week, earliest start
- `mess_ratings` for favourite dish (user's own top-rated)
- `assignments` panel data for deadlines met

### Design
- `src/lib/wrapped.js` — pure function `buildWrapped(classes, enrolled, attendance, ratings)`
  returning a stats object; testable without UI.
- `WrappedView.jsx` — story-style vertical cards (one stat per card, swipe/scroll), matching
  the dark-mode token system; entrance animations CSS-only (perf lesson from v3 audit).
- **Share card**: render the summary card to a canvas → PNG → Web Share API
  (`navigator.share` with file) with download fallback. No server involvement.
- **Gating**: hidden by default; enabled via a `system_config` key (`wrapped_term` = term id)
  so admin flips it on in the last week of term. When active, show an entry card on Today
  view + a Tools entry. Term boundaries come from the schedule data already in the app.

### Effort: ~2 sessions (1 for stats lib + view, 1 for share-card polish).

---

## D. Campus Board (Lost & Found + Marketplace)

### Goal
A simple moderated cohort board: lost/found items and buy/sell listings. Broadens the app
beyond schedules; moderation rides on existing admin tooling.

### Data model (new migration `board_posts.sql`)
```sql
board_posts (
  id uuid pk default gen_random_uuid(),
  user_id text not null,
  user_name text,
  kind text check (kind in ('lost','found','sell','ask')),
  title text not null check (char_length(title) <= 80),
  body text check (char_length(body) <= 500),
  price int null,                 -- rupees, sell/ask only
  image_path text null,           -- storage path
  contact text null,              -- optional phone/room; else in-app ping
  status text default 'open' check (status in ('open','resolved','removed')),
  reported_by jsonb default '[]',
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
)
```
- Storage: new public-read bucket `board-images`, insert path-scoped to own user id, client
  resizes to ≤1280px webp before upload (keeps the free tier happy).
- RLS: authenticated read where `status != 'removed'` and not expired; insert/update own;
  admin update any (moderation). Report action appends to `reported_by`; ≥3 reports
  auto-hides pending admin review.
- Cleanup: rely on `expires_at` filter in queries (no cron needed initially).

### Frontend
- New view `board`: filter chips (All / Lost / Found / For sale / Wanted), card grid with
  image thumb, kind badge, time-ago; FAB "+ Post" → composer modal (kind, title, photo,
  price, contact). "Mark resolved" on own posts. Contact seller via existing friend-ping
  (`sendSocialNotification`) or shown contact string.
- `src/lib/board.js` for queries; `BoardPage.jsx`, `BoardComposer.jsx`, `board.css`.
- Admin: new "Board" section in `AdminDashboard.jsx` — reported queue, remove post
  (logged via `adminAudit.js`).

### Entry points (per request)
- **Mobile**: new row in the existing **Tools** collapsible section of the ⋯ overflow menu
  (App.jsx ~line 2293, alongside Full timetable / Mess menu / Leave planner):
  `Package size={14} /> Campus Board`.
- **Desktop**: there is currently **no Tools dropdown on desktop** — desktop reaches those
  tools via sidebar/command palette. Mirror the mobile structure by adding a **"Tools"
  labelled group in the sidebar** (below "Campus"): Campus Board now, and while we're
  there, Full timetable / Mess menu / Leave planner gain sidebar homes too (today they're
  mobile-overflow-only, which is a desktop discoverability gap). Collapsed-sidebar tooltip
  behaviour reuses `showSbTip`.
- Both: add "Campus Board" to `CommandPalette.jsx` and to `DEEP_LINK_VIEWS`
  (`?view=board`) for PWA deep-linking.

### Effort: ~3 sessions (largest of the four; storage + moderation + new view).

---

## Suggested build order

1. **B (Glance)** — smallest, no schema, immediate daily-use payoff.
2. **A (Polls)** — rides existing realtime + notification plumbing; do after B so the
   notification `type` naming from the architecture doc is settled.
3. **D (Board)** — biggest lift; includes the Tools-dropdown/sidebar restructure.
4. **C (Wrapped)** — build last; it's calendar-gated to end of term anyway, and by then
   there's a full term of attendance/ratings data to make the stats good.

## Open questions (non-blocking, defaults chosen)

- Polls: anonymous votes vs named? **Default: named counts visible only as totals;
  creator sees names for group polls, nobody for cohort polls.**
- Board: allow price-less "sell" posts? **Default: yes, price optional.**
- Wrapped: mid-term "so far" preview? **Default: no — end-of-term only, keeps it special.**

## Deferred backlog (unchanged, still pending)

Dark mode verify+deploy, Jul-15 backend pieces (cancellation push fn, `mess_ratings`
migration deploy), mess-menu upload pipeline plan, notification redesign Phase 0.
