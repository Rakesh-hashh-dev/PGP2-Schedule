# Social Page Expansion — Analysis & Design Report

**Project:** PGP2 Schedule (TermFlow) · `schedule-app/`
**Date:** 2026-07-19 · **Status:** ALL phases (A + B + C + E) IMPLEMENTED locally 2026-07-19 (uncommitted; D = polls, covered by new-features-jul19-plan §A)

**Phase E implementation note:** LeavePlanner turned out to be a stateless calculator (the from/to range was never persisted), so sharing is an explicit action on the applied range: a "Share with friends" row under the date picker publishes `_away: { from, to }` to the profile blob (localStorage-first, `pgp2.my-away`), with a persistent "Stop sharing" pill. Friend cards show an amber "Away till …" chip *instead of* free/busy while the window is current, and the matchmaker skips users who are away right now. No new tables; `fetchFriendPresence` fetches status + away in the same query the status line already made.

**Deploy checklist for Phases B + C (not yet run):**
1. Run `supabase/migrations/20260719140000_meetups.sql` (tables + RLS + realtime).
2. Run `supabase/migrations/20260719150000_scheduled_nudges.sql` (self-service nudge rows).
3. Redeploy `class-reminders` edge fn (adds §5d meetup-reminder sweep + §5e free-nudge drain).
4. No dispatch change needed — both sweeps insert rows at fire time, and dispatch's every-minute cron pushes them immediately.

*Ordering note (resolved 2026-07-19):* polls (…120000), meetups (…140000) and board (…20120000) all recreate `notif_social_insert`; each now carries the full union of client-insertable types, so the three migrations are safe in any order.

---

## 1. Current Social Surface (what already exists)

Before adding anything, an inventory — several "obvious" additions turn out to be half-built already.

| Capability | Where | State |
|---|---|---|
| Friends (add via share code / QR, remove, refresh) | `FriendsPanel.jsx`, `lib/friends.js` | Shipped. localStorage-first, synced to `profiles` JSONB via `pushFriendsToCloud` |
| Groups (create, drag-and-drop membership, share with members) | same | Shipped |
| Free/busy status per friend (computed from their shared timetable) | `FriendsPanel.jsx` (friend cards) | Shipped |
| 1:1 + **group** free-slot computation | `findFreeSlots`, `findGroupFreeSlots` in `lib/friends.js`, rendered in `CompareView.jsx` | Shipped — group overlap already works |
| Pings ("thinking of you" nudge + friend requests) | `friend_pings` (legacy) → unified `notifications` store via `sendSocialNotification` | Shipped; Phase 3 read-path swap in progress |
| Group chat (persistent) | `group_messages` table, chat UI in FriendsPanel | Shipped |
| Suggested buddies (matchmaker, opt-out via `_hide_from_matchmaker`) | `FriendsPanel.jsx` | Shipped |
| Mess cohort ratings + favourites | Jul-15 feature batch | Built locally; `mess_ratings` migration **not yet deployed** |
| Push infrastructure | `class-reminders` (cron) + `send-push` edge functions | Live |

**Implication:** the highest-leverage additions are ones that give existing mechanics a *destination* — a found free slot currently dead-ends at "you're both free 2–3pm"; a ping dead-ends at a toast. The plan below is mostly about closing those loops, not new subsystems.

---

## 2. Feature Set & Phasing

Ordered so each phase ships independently and earlier phases feed later ones.

### Phase A — Status line & presence (small)

A short, self-set, auto-expiring status shown on your friend card next to the computed free/busy dot.

- **UX:** on the Social page header, a "Set status" chip → small popover: emoji picker (6 presets: ☕ chai, 📚 library, 🏸 sports, 🍽 mess, 😴 resting, ✍️ custom) + optional text (40 chars) + duration (30 min / 1 h / 2 h / until midnight). Friend cards render it under the name: `📚 in library till 6`. One-tap "Clear".
- **Quick status — "Heading to mess":** a dedicated one-tap action that sets a 30-min 🍽 status *and* surfaces on friends' `MessCard` ("Ravi is heading to mess"). This is the mess-sync hook with near-zero new infrastructure.
- **Data:** new key in the `profiles` JSONB blob: `_status: { emoji, text, expires_at }`. No new table, no RLS work; friends already read each other's profiles, and the existing `profiles` Realtime subscription delivers updates live. Clients treat a past `expires_at` as no status (no server cleanup needed).
- **Privacy:** visible to friends only (already true of profile reads); no opt-in needed because it is self-authored and off by default.

### Phase B — Meetup plans (the core addition)

Turn a free slot into a plan: time + place, friends RSVP one-tap, reminder push.

- **Entry points:**
  1. `CompareView` free-slot block gets a **"Make a plan"** button (1:1 and group modes — `findGroupFreeSlots` output already carries date/start/end).
  2. Group card on the Social page: "Plan something" → picks from today/tomorrow's common free slots (reusing the same function).
  3. Blank-slate: a "＋ New plan" button with manual time entry.
- **Creation modal (`fs-modal-*` pattern):** title (default "Catch-up"), place (free text + 5 preset chips: Mess, Library, Amul, Sports Complex, Hostel), date/time prefilled from the slot, invitees prefilled from the compare selection or group.
- **RSVP:** invitees get a `meetup_invite` notification (bell + push) with inline **Going / Can't** buttons. Creator sees live counts on the plan card.
- **Plan card:** a new "Plans" strip at the top of the Social page listing upcoming plans (yours + invited), each showing time, place, avatar stack of confirmed people, and your RSVP state. Past plans auto-hide.
- **Reminder:** 15 min before start, push to everyone marked Going — delivered by the existing `class-reminders` cron tick (it already wakes on schedule; add a `meetups due in the next window` query).
- **Data (new tables, both RLS: members only):**

  ```sql
  meetups      (id uuid pk, creator_id text, title text, place text,
                starts_at timestamptz, group_id text null, created_at)
  meetup_rsvps (meetup_id uuid fk, user_id text, response text
                check (response in ('going','declined')), primary key (meetup_id, user_id))
  ```

  Invitee list lives as a `member_ids text[]` column on `meetups` (matches the app's denormalized style; groups already store `memberIds` arrays). RLS: `auth.uid()`-less app uses Clerk ids, so mirror the existing pattern used by `group_messages` for member-scoped reads.
- **Notifications:** three new `notifications` types — `meetup_invite`, `meetup_rsvp` (to creator), `meetup_reminder`. All flow through `sendSocialNotification`, so the bell, badge, and push paths are already wired.

### Phase C — "Ping me when free" (small, high delight)

Subscribe to a friend; get one push when their current/next class ends.

- **UX:** on a friend card while they're in class, the Ping button gains a secondary action: "Notify me when free". Confirmation toast: "We'll nudge you around 2:30 when Priya's class ends."
- **Mechanics:** the subscriber's client *already knows* the friend's timetable (that's how free/busy is rendered), so it computes the exact end time locally and inserts one row into a new `scheduled_nudges` table `(id, user_id, about_user_id, fire_at, created_at)`. The `class-reminders` cron drains due rows → `send-push` to the subscriber ("Priya should be free now — ping her?") with a deep link to the Social page. One-shot; row deleted after send.
- **Why not client-side timers:** the subscriber's tab is usually closed by then; push must come from the server, and the cron loop already exists.
- **Privacy note:** this reveals nothing the subscriber can't already see (the timetable is shared by friendship). No new consent needed, but the copy should say "based on their timetable" not "based on their location/activity".

### Phase D — Group polls: **already planned elsewhere, not re-specced here**

Polls (group chat + admin cohort-wide) are fully designed and approved in `docs/new-features-jul19-plan.md` §A (`polls.sql` migration, `lib/polls.js`, `PollCard` rendered via a `__poll:<uuid>` marker in `group_messages`). This plan takes a dependency on that spec rather than duplicating it. One addition once both exist: a meetup card (Phase B) can offer "Poll the group first" to pick between candidate free slots — wire only after both features ship.

### Phase E — Campus-away sharing (small, opt-in)

`LeavePlanner` already knows the user's leave dates. Add an opt-in toggle ("Let friends see when I'm away") that writes `_away: { from, to }` into the profile blob; friend cards show a subtle "Away till Mon" chip instead of free/busy, and the matchmaker/meetup pickers skip away friends. Strictly opt-in (default off), mirroring the `_hide_from_matchmaker` pattern.

### Explicitly deferred (revisit only on demand)

- **Course study groups** auto-suggested from shared enrolment — overlaps WhatsApp; matchmaker already covers discovery.
- **Attendance streaks / leaderboards** — privacy-sensitive, needs its own consent design; low ask signal so far.
- **Expense splitting, marketplace, lost-and-found** — different product; out of scope.

---

## 3. Cross-cutting Decisions

1. **Feature flags:** one flag per phase in `system_config.flags` — `enableStatus`, `enableMeetups`, `enableFreeNudge`, `enablePolls`, `enableAwayShare` — same soft-launch/kill pattern as `enableExams`.
2. **Notifications-first:** every new event type goes through the unified `notifications` store (`sendSocialNotification`) — **no new writes to legacy `friend_pings`**. This keeps the Phase-3 read-path swap clean instead of widening the legacy plane. The pending notification-architecture migration is therefore a *soft* prerequisite: Phase A needs none of it; Phase B onward should land after the read-path swap to avoid double-mapping new types.
3. **Deployment prerequisite:** the Jul-15 batch (`mess_ratings` migration + cancellation push) should deploy before the Phase A mess-sync hook, since "friends favourited tonight's dinner" reads `mess_ratings`.
4. **Admin:** add a "Social" stat block to `AdminDashboard` (meetups created / RSVPs / polls / nudges, via the existing `get_admin_stats()` RPC so RLS doesn't clip counts) and include the new tables in DB-health checks.
5. **Design system:** no new dependencies. Plan cards = `cva-card` + avatar stack (gradient avatars exist); modals = `fs-modal-*`; poll bars = plain CSS in `friends.css`; icons from lucide (`CalendarPlus`, `Vote`, `BellRing`, `Plane`).
6. **Perf:** Phases A/E are JSONB fields on data already fetched — zero extra requests. Phase B adds one `meetups` fetch on Social-page mount + Realtime on RSVPs scoped to your plan ids. Nothing loads on the Today view except (optionally, later) a one-line "Next plan" chip.

---

## 4. Suggested Build Order & Sizing

| Phase | Feature | New tables | Edge-fn change | Est. size |
|---|---|---|---|---|
| A | Status + heading-to-mess | none | none | S |
| B | Meetup plans | 2 | reminder sweep | L |
| C | Free-nudge | 1 | nudge sweep | S–M |
| D | Group polls | — (covered by new-features-jul19-plan §A) | — | — |
| E | Away sharing | none | none | S |

A → B → C is the recommended arc (each makes the next more useful: statuses make the page feel alive → plans give it a job → nudges bring people back). D and E can slot in anywhere after.

---

## 5. Open Questions (for product owner)

1. Should meetup **places** be free text only, or do we want a curated campus-place list (enables future "who's at the library" views)?
2. Meetup invites: friends-of-creator only, or allow inviting a group where some members aren't your direct friends (group chat already permits this)?
3. Does the "Next plan" chip belong on the Today view hero area at launch, or hold until Phase B proves usage?
