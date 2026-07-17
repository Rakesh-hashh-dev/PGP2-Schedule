# TermFlow — Notification System Architecture

Status: **proposed** · Written 2026-07-15 · Owner: Rakesh

This doc analyses the current notification system, records its bugs, and specifies
a phased redesign toward a single unified event store. It is the source of truth
for the notification rework — update it as phases land.

---

## 1. Current system (as-built)

The system is **three unrelated notification planes** built at different times and
never unified.

### Plane A — Web Push (out-of-app, OS level)

| Piece | Role |
|---|---|
| `push_subscriptions` (endpoint PK) | device subscriptions (user_id, p256dh, auth) |
| `push_prefs` (user PK) | `class_reminders`, `lead_minutes`, `daily_summary`, `summary_time`, `cancellation_alerts` |
| `reminder_log` (date+code+section+user PK) | dedup ledger, pruned after 7 days |
| `schedule_cache` (id PK) | live-feed fallback copy |
| **`class-reminders`** edge fn (cron `*/5 1-17 * * *`) | class reminders **+** morning summary **+** cancellation alerts; reserve-then-release dedup, `waitUntil` background work |
| **`dispatch-scheduled-pushes`** edge fn (cron `* * * * *`) | fires admin one-off pushes stored in `system_config.flags.scheduledPushes` |
| **`send-push`** edge fn (manual + daily-digest cron) | broadcast to **all** subscribers; `mode:"digest"` default copy |
| `src/lib/push.js` + `public/push-sw.js` | client subscribe/toggle + SW render/click |

### Plane B — In-app "Announcements" (`src/components/NotificationsPage.jsx`)

Schedule-change feed (`allChanges` / `myChanges`), **client-derived by diffing the
schedule on load**. Read / dismiss / mute / snooze state is localStorage-first with
best-effort last-write-wins merge into a `notif_prefs` cloud row
(`getNotifPrefs`/`setNotifPrefs` in `src/lib/profile.js`).

### Plane C — Friend pings (`src/lib/friends.js` + `FriendsPanel.jsx`)

The `friend_pings` table is an **overloaded event bus**: friend requests, accepts,
removals, group invites, **and group-chat messages** all share it. The event *type*
and metadata are packed into the `from_name` column as a **stringified JSON blob**.
A Supabase Realtime subscription drives an in-app bell; nothing reaches push.

> The same real-world event is often computed **twice, independently**. A cancellation
> produces a server push (`class-reminders`, today+tomorrow window) **and** a separate
> client-side `CancellationAlert` banner (`scheduleDisruptions(...,2)`). They can diverge.

---

## 2. Bugs & design defects

### High severity

1. **Scheduled-push timezone bug** — `dispatch-scheduled-pushes/index.ts` builds
   `` `${p.date}T${p.time}:00.000Z` `` — stamping an **IST wall-clock time with a `Z`
   (UTC) suffix** and comparing to real UTC `now`. A push set for "14:00" fires at
   14:00 **UTC = 19:30 IST** (~5.5h late), *unless* the admin UI pre-shifts the stored
   value. Inconsistent with `class-reminders`, which correctly does `UTC+5:30`.
   **Action:** confirm what the admin writer stores, then make one shared IST helper.

2. **`system_config.flags` read-modify-write race** — `dispatch-scheduled-pushes` runs
   every minute and rewrites the **entire** `flags` JSONB to drop fired pushes.
   `classOverrides` (cancellations) live in the *same* blob. An admin cancelling a class
   in the same minute can clobber, or be clobbered by, the dispatcher. Scheduled pushes
   must not share a global JSON document.

3. **`friend_pings` type-in-JSON** — no `type` column, so you can't index, filter, or
   RLS by type; parsing `from_name` is fragile; chat messages and friend requests share
   one retention/query path. Biggest structural smell.

### Medium severity

4. **Two overlapping morning digests** — `send-push mode:"digest"` (daily cron, hits
   **all** subscribers ignoring prefs) *and* the per-user `daily_summary` inside
   `class-reminders`. A user can receive both; the generic one ignores `daily_summary=off`.

5. **Push ↔ in-app disconnected** — no shared store. A push dismissed from the lock
   screen leaves **no in-app trace**; inbox and push are derived by different code with
   different windows → divergence.

6. **No server source of truth for announcements** — changes recomputed per-device, so
   unread counts / feed can differ across devices; read/dismiss/mute is whole-set-blob
   last-write-wins → multi-device drift.

7. **Three auth models** — `x-push-key` (class-reminders, send-push) vs.
   `x-admin-key`-or-service-bearer (dispatch). Secret sprawl.

8. **No push coverage for social events** — friend requests / group invites never push;
   if the app is closed, the user only finds out on next open.

### Low severity / scaling

9. Fan-out loops **all** subscribers in one edge invocation with no paging (fine at
   ~100–300 users; wall/CPU-limit risk as it grows — class-reminders already hit the
   pg_net 5s issue, mitigated with `waitUntil`).
10. Dead subs pruned only lazily on send failure; reinstalled PWAs leave dead endpoints.
11. `summary_time` < 06:30 IST silently never fires (cron window `1-17`).

---

## 3. Target architecture

Core move: **separate "an event happened" from "deliver it on channel X."** One
canonical event store, producers that only *insert*, one dispatcher that owns all push.

```
 PRODUCERS (insert only)                EVENT STORE            DELIVERY
 ┌────────────────────────┐
 │ class-reminders (cron)  │──┐
 │ schedule-diff (cron)    │  │        ┌──────────────┐      ┌────────────────┐
 │ admin broadcast/sched.  │  ├──────► │ notifications │────►│ dispatch (cron)│──► Web Push
 │ friend/group actions    │  │        │  (per user)  │      │  push channel  │     (VAPID)
 │ (client, RLS-scoped)    │──┘        └──────┬───────┘      └────────────────┘
 └────────────────────────┘                  │  Supabase Realtime (in-app inbox + bell)
                                              ▼
                                    unified in-app inbox
```

### Layer 1 — `notifications` (single source of truth)

One row per **(user, event)**.

```sql
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  type              text not null,          -- class_reminder | class_cancelled |
                                            -- daily_summary | schedule_change |
                                            -- admin_broadcast | friend_request |
                                            -- friend_accepted | group_invite | group_chat
  title             text not null,
  body              text,
  url               text,
  icon              text,
  data              jsonb,                  -- type-specific metadata (code, section, fromCode…)
  dedup_key         text not null,          -- replaces reminder_log
  scheduled_for     timestamptz,            -- null = immediate; set for scheduled/admin
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  delivered_push_at timestamptz,
  unique (user_id, dedup_key)
);
alter table notifications enable row level security;
create policy notif_own_select on notifications for select using (auth.jwt()->>'sub' = user_id);
create policy notif_own_update on notifications for update using (auth.jwt()->>'sub' = user_id);
-- inserts are service-role (producers) except social events (scoped policy, see Phase 3)
create index on notifications (user_id, created_at desc);
create index on notifications (delivered_push_at) where delivered_push_at is null;
```

Replaces **`reminder_log`** (dedup → `dedup_key`), **`friend_pings`** (type becomes a
real column), and gives announcements a **server-side inbox with cross-device read
state**. Realtime subscription per `user_id` drives the bell.

### Layer 2 — `notification_prefs` (consolidated)

Extend `push_prefs` into a per-type **channel matrix** + quiet hours.

```sql
-- one row per user; `prefs` holds a per-type { push, inapp, ... } matrix
alter table push_prefs add column if not exists quiet_start text;  -- "22:00" IST
alter table push_prefs add column if not exists quiet_end   text;  -- "07:00" IST
alter table push_prefs add column if not exists prefs jsonb default '{}'::jsonb;
-- prefs example:
-- { "class_reminder":  {"push": true, "inapp": true, "lead": 30},
--   "class_cancelled": {"push": true, "inapp": true},
--   "daily_summary":   {"push": true, "time": "07:20"},
--   "schedule_change": {"push": false, "inapp": true},
--   "friend_request":  {"push": true, "inapp": true} }
```
Also folds in the announcement mute/dismiss prefs currently in `notif_prefs`.

### Layer 3 — single `dispatch` edge fn (cron `*/2–5`)

The **only** code that talks to web-push:
- selects `notifications` where `delivered_push_at is null` and
  (`scheduled_for` null or ≤ now), owner's prefs+channel allow push, not in quiet hours;
- sends web push, sets `delivered_push_at`, prunes 404/410 subs;
- **one** auth model, one dedup, one place to add batching/paging later.

Producers (`class-reminders` compute, admin, friend actions, schedule diff) **only
INSERT** — no direct sends. This removes: the `flags` race (scheduled pushes are rows),
the timezone bug (one tz helper), the double-digest (one `daily_summary` producer), and
the push↔in-app divergence (same row powers both channels).

---

## 4. Phased migration plan

Small cohort — phase it so everything keeps working. Forward-only; no backfill needed.

### Phase 0 — quick fixes  ✅ code done 2026-07-15 (deploy pending)
- ✅ **TZ fix** — `dispatch-scheduled-pushes` now compares against *now in IST*
  (`Date.now() + 5:30`) instead of real UTC. Ends the ~5.5h-late firing.
- ✅ **Race fix** — dispatcher no longer rewrites the whole `system_config.flags`
  blob. New RPC `dequeue_scheduled_pushes(remaining jsonb)`
  (`migrations/20260715140000_scheduled_pushes_atomic.sql`) atomically `jsonb_set`s
  only the `scheduledPushes` key, so a concurrent `classOverrides` edit can't be
  clobbered. Chose this over a dedicated `scheduled_pushes` table because Phase 2
  migrates scheduled pushes into `notifications` (with `scheduled_for`) anyway — a
  new table now would be throwaway; the RPC is a cheap guard for the bad blast
  radius (a clobbered override silently un-cancels a class). RPC is locked to
  `service_role` (execute revoked from public). **Residual (by design):** the
  whole-array read-modify-write still has an *intra-key* race — an admin queuing a
  push in the same minute the dispatcher dequeues could see it dropped. Not worth
  fixing on the flags model; it disappears in Phase 2 when scheduled pushes become
  independent `notifications` rows.
- ⏳ **Retire digest cron** — unschedule the generic all-subscribers digest:
  `select cron.unschedule('termflow-daily-digest');` (keep per-user `daily_summary`
  in `class-reminders`; `send-push mode:"digest"` stays for manual admin broadcasts).
  Ops-only; run if that cron was ever created.

**Deploy steps for Phase 0:**
1. Apply the migration (creates the RPC): `npx supabase db push --project-ref <ref>`
   (or paste the SQL into the SQL Editor).
2. Redeploy the fn: `npx supabase functions deploy dispatch-scheduled-pushes --no-verify-jwt --project-ref <ref>`
3. Run the `cron.unschedule` above if the digest cron exists.
4. Verify: queue a scheduled push a couple minutes out (IST) in Admin Tools → confirm
   it fires on time, not 5.5h late.

### Phase 1 — event store  ✅ code done 2026-07-16 (deploy pending)
- ✅ **Table** — `migrations/20260716120000_notifications_table.sql`: `notifications`
  (one row per user+event, `dedup_key` unique per user, `read_at` +
  `delivered_push_at`), RLS (own select/update; no client insert yet), inbox +
  undelivered indexes, added to `supabase_realtime` publication.
- ✅ **Client lib** — `src/lib/notifications.js`: `fetchNotifications`,
  `fetchUnreadCount`, `subscribeToNotifications` (INSERT+UPDATE realtime, mirrors
  the friend_pings pattern), `markNotificationRead`, `markAllNotificationsRead`.
- ⏭ **UI wiring deferred to Phase 2** on purpose: no producer writes to the table
  yet, so pointing the live bell/inbox at an empty table now would add risk with
  nothing to show. Phase 2 wires producers + inbox + badge together.

**Deploy + verify Phase 1:** apply the migration (`supabase db push` or SQL Editor),
then confirm realtime end-to-end by inserting a test row via SQL and watching a
`subscribeToNotifications` listener receive it:
`insert into notifications (user_id, type, title, body, dedup_key) values ('<clerk-id>','admin_broadcast','Test','hi','test-1');`

### Phase 2 — producers insert + single dispatcher

**Phase 2a ✅ code done 2026-07-16 (deploy pending) — server backbone**
- ✅ **`dispatch` fn** (`supabase/functions/dispatch/index.ts`) — the single push
  path. Every minute: selects undelivered, due (`scheduled_for` null-or-past),
  recent (<2h) `notifications`; pushes each to its owner's subs; stamps
  `delivered_push_at`; prunes 404/410 subs; 30-day row cleanup. Transient failures
  leave `delivered_push_at` null → next run retries (no reserve/release dance). A
  row that can't be pushed (no subs / past `data.expires_at`) survives as an in-app
  record — push and inbox can't diverge. On-device `tag = dedup_key` de-dups.
- ✅ **`class-reminders` is now a producer** — same proven due-detection / matching
  / summary / cancellation logic, but step 6–7 now **INSERT `notifications` rows**
  (dedup via `unique(user_id, dedup_key)`, `ignoreDuplicates`) instead of sending.
  No more web-push, VAPID, or `reminder_log` in this function. Carries
  `data.{urgency,ttl,expires_at}` for the dispatcher.
- ⏭ `reminder_log` table left in place but unused (drop later). `send-push` /
  `dispatch-scheduled-pushes` still handle admin broadcasts directly for now.

**Coordinated deploy (2a) — both together, or reminders queue but don't send:**
```
npx supabase functions deploy dispatch        --no-verify-jwt --project-ref <ref>
npx supabase functions deploy class-reminders  --no-verify-jwt --project-ref <ref>
select cron.schedule('termflow-dispatch','* * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-push-key','<PUSH_ADMIN_SECRET>'),
    body := '{}'::jsonb) $$);
```
Rollback = redeploy the previous `class-reminders`. Verify: set a class reminder,
watch `dispatch` logs (`delivered`/`sent`) + the notification row gaining
`delivered_push_at` + the push on device.

**Phase 2b — client inbox + badge  ✅ code done 2026-07-16 (build passes)**
- ✅ `App.jsx` wired to `notifications`: `alerts` state, initial `fetchNotifications`
  + `subscribeToNotifications` (INSERT/UPDATE realtime), `unreadAlertCount` folded
  into `hasUnread` + the tab-title / PWA app-badge total.
- ✅ Bell dropdown shows a new **Alerts** section (class reminders / cancellations /
  summaries / broadcasts) above Friends + Changes; click marks read
  (`markAlertRead` → `markNotificationRead`, optimistic); **Mark all read** also
  clears alerts (`markAllNotificationsRead`). `.rc-alert` dot style added.
- Non-breaking: empty table → no Alerts section, badge unchanged. Nothing shows
  until Phase 2a producers + dispatch are deployed.

**Phase 2b remaining — convert admin broadcasts to producers  ✅ code done 2026-07-17 (deploy pending)**

Goal: `dispatch` becomes the **sole** delivery path; broadcasts also land in the
in-app inbox with per-user read state.

- ✅ **`send-push` (immediate broadcast):** kept `x-push-key` auth, the digest-mode
  defaults, and the "title+body required" 400 (the admin health-check relies on the
  endpoint responding). Direct web-push loop replaced with a **fan-out insert**:
  fetch all `profiles.user_id`, one `notifications` row per user
  (`type:'admin_broadcast'`, one shared `dedup_key:'broadcast:'+crypto.randomUUID()`
  per call, `data:{urgency:'normal', ttl: 12*3600}`, title/body/url/icon), inserted
  `onConflict user_id,dedup_key ignoreDuplicates`. Returns `{queued: N}`. No more
  web-push/VAPID in this fn.
- ✅ **`dispatch-scheduled-pushes` (scheduled):** unchanged flags queue + Phase 0 TZ/RPC
  logic; only the **due action** changed — a due push now fan-out inserts rows
  (`dedup_key:'broadcast:'+push.id`, `scheduled_for` null since already due) instead
  of sending, then dequeues via the atomic RPC. `dispatch` delivers within a minute.
  web-push/VAPID removed from this fn too.
- **Fan-out targets ALL profiles**, not just subscribers — users without a push sub
  still get the in-app inbox entry; `dispatch` simply skips push for them.
- **Behavior changes to note:** immediate broadcast gains ≤1 min latency; every
  broadcast now creates a per-user inbox row (30-day retention) — this is the intended
  "broadcasts visible in-app" feature.
- **Admin UI unchanged.** After this, `reminder_log` can be dropped and the two
  functions' direct-send code is gone.
- **Prereq:** do this only after the `class-reminders → dispatch` chain is verified in
  prod (don't stack a third untested producer on an unproven backbone).

### Phase 3 — migrate `friend_pings`  ⚙️ producers + migration code done 2026-07-17; App.jsx read-path swap pending

**Code done:** migration `20260717120000_social_notifications.sql` (scoped
`notif_social_insert` policy pinning `data.from_id` to the caller; new
`group_messages` table + RLS + realtime); `src/lib/friends.js` producers
`sendSocialNotification(target, type, {fromId, fromCode, fromName, group?})`
(inserts `notifications` rows for `friend_request`/`friend_accepted`/`group_invite`,
`friend_removed` as `data.silent:true`) and `sendGroupChatMessage` /
`fetchGroupChatMessages` (against `group_messages`).

**Deliberately NOT swapped yet (needs in-browser verify):** App.jsx's two
`friend_pings` realtime handlers + `refreshPings` + `FriendsPanel` still read the
legacy `friend_pings` plane, and `sendFriendPing`/`sendGroupMessage` remain. The
final wiring step points those reads at `notifications`/`group_messages` and
retires `friend_pings` — staged separately so the live friends feature isn't
broken blind. Original design below.

`friend_pings` is overloaded: user-targeted **social notifications** (friend_request,
friend_accepted, group_invite), a **control signal** (friend_removed), and **group
chat** (`type:'group_chat'`). Split by concern:

- **Social notifications → `notifications` rows.** New types `friend_request`,
  `friend_accepted`, `group_invite`. Gains push coverage + inbox + read state for free.
  The client stamps `data.from_id`/`data.from_code`/`data.from_name`.
  - **Scoped client INSERT policy** (the sender writes a row targeting someone else):
    ```sql
    create policy notif_social_insert on notifications for insert
      with check (
        type in ('friend_request','friend_accepted','group_invite','friend_removed')
        and (data->>'from_id') = (auth.jwt()->>'sub')   -- can't spoof the sender
      );
    ```
    Target may be anyone (that's the nature of a friend request) but the sender is
    pinned to the caller — same trust model as today's `friend_pings`, minus the
    JSON-in-`from_name` fragility.
  - **App.jsx**: the realtime side-effects currently on `friend_pings` (auto-add on
    `friend_accepted`, group re-sync on `group_invite`) move to the `notifications`
    INSERT handler, keyed on `type`. `FriendsPanel` reads pending requests from
    `notifications` instead of `pings`.
- **`friend_removed` → silent notification.** Insert with `data.silent:true`; the bell
  filters out `silent` rows, but the realtime handler still processes the removal and
  marks it read. (Or fold removal into the friends cloud-sync and drop the signal.)
- **`group_chat` → its own table `group_messages`**, out of the notification path
  entirely (different volume, retention, and it targets a group not a user):
  ```sql
  create table group_messages (
    id uuid primary key default gen_random_uuid(),
    group_id text not null, from_id text not null, from_name text,
    text text not null, created_at timestamptz default now());
  -- RLS: members of the group may select/insert (needs the group-membership source).
  ```
  Lower priority — can stay in `friend_pings` until the group model exposes membership
  for RLS. **De-risk:** migrate the three social types + the removal signal first;
  split chat in a follow-up.
- Once social + chat are off `friend_pings`, drop the table.

### Phase 4 — server-side schedule diff  ⚙️ producer code done 2026-07-17 (added/moved); Announcements UI migration still stretch

**Code done:** migration `20260717130000_schedule_snapshots.sql`
(`schedule_snapshots` single-row store) + new producer
`supabase/functions/schedule-diff/index.ts` (cron `*/10`). Each run diffs the live
feed against the prior snapshot; for each **added** or **moved** (start/end/room
changed) class on a today-or-future date it inserts a `schedule_change`
notification for every enrolled student (`dedup_key:'change:<kind>:<date|code|section>:<sig>'`),
then stores the fresh snapshot. First run seeds only (no notifications).
**Removals/cancellations are intentionally NOT emitted** — they already flow through
`class-reminders` as `class_cancelled`; emitting `schedule_change:removed` too would
double-notify. Full `CancellationAlert`/Announcements-UI reconciliation is the
stretch below. Original design:

Today `CHANGES` (Announcements) and `CancellationAlert` are **client-derived** by
diffing the schedule on load, so two devices can disagree and read-state is a
localStorage blob.

- **New producer `schedule-diff`** (cron, or fold into `class-reminders`): each run
  diffs the live feed against the last-known snapshot (store prior payload in
  `schedule_cache` or a `schedule_snapshots` table). For each add / move / cancel that
  touches an enrolled user, insert a `notifications` row (`type:'schedule_change'`,
  `data:{kind:'added'|'moved'|'removed', code, section, date, …}`,
  `dedup_key:'change:'+hash`). This gives a **server source of truth** so devices agree
  and read-state syncs via `read_at`; cancellations already covered by
  `class_cancelled` need dedup so they don't double with `schedule_change`.
- **`CancellationAlert`** becomes a filtered view of `notifications`
  (`type in (class_cancelled, schedule_change where kind=removed)`), replacing the
  independent client computation.
- **Announcements page**: the rich browse UI (`NotificationsPage`) can keep its
  bundling/filtering but source rows from `notifications` (server-authoritative) rather
  than client-diffed `CHANGES`. **Largest phase** — can ship the server producer first
  (adds push + cross-device agreement for time-sensitive changes) and migrate the full
  Announcements UI later. Optional/stretch.

### Phase 5 — prefs matrix + quiet hours  ✅ backend code done 2026-07-17; prefs UI pending

**Code done:** migration `20260717140000_prefs_matrix.sql` adds
`push_prefs.prefs jsonb` (per-type `{push,inapp,lead?,time?}` matrix) +
`quiet_start`/`quiet_end`, with an idempotent one-time backfill from the legacy
booleans (left in place for back-compat). `dispatch/index.ts` now enforces it:
loads `push_prefs` for the affected users, skips push when `prefs[type].push ===
false` or the row is `data.silent` (stays in-app), and suppresses push during quiet
hours for non-urgent types only (`class_reminder`/`class_cancelled` exempt),
leaving `delivered_push_at` null so it retries after the window.
**Pending:** the per-type matrix + quiet-hours **UI** (still the legacy
`ReminderBar` booleans). Original design:

- **Schema** (already sketched): `push_prefs.prefs jsonb` = per-type
  `{ push, inapp }` (+ `lead`/`time` where relevant) and `quiet_start`/`quiet_end` (IST
  "HH:mm"). Migrate the existing boolean columns (`class_reminders`, `daily_summary`,
  `cancellation_alerts`, `lead_minutes`, `summary_time`) into `prefs` with a one-time
  backfill; keep readers back-compatible during transition.
- **Dispatcher enforcement:** before pushing a row, look up the owner's pref for
  `row.type`; skip push if `push=false` (row still shows in-app if `inapp=true`).
  **Quiet hours apply only to non-urgent types** (`admin_broadcast`,
  `schedule_change`, `daily_summary`) — never to `class_reminder` / `class_cancelled`
  (time-critical). During quiet hours, skip push and leave `delivered_push_at` null so
  it retries after the window (bounded by the 2h scan / `expires_at`).
- **UI:** a compact per-type channel matrix on the Announcements settings area
  (replacing the current single `ReminderBar`), plus a quiet-hours range.

---

## 5. Final target state (after all phases)

**Tables:** `notifications` (event store — the hub), `push_subscriptions`,
`push_prefs` (now the per-type matrix + quiet hours), `schedule_cache`
(+`schedule_snapshots`), `group_messages`.
**Retired:** `reminder_log`, `friend_pings`, `system_config.flags.scheduledPushes`
as a delivery queue.

**Functions:**
- Producers (INSERT only): `class-reminders`, `schedule-diff`, `send-push` /
  `dispatch-scheduled-pushes` (now fan-out inserters).
- Consumer (the only sender): **`dispatch`**.

**Flow:** every event → one `notifications` row per user → `dispatch` delivers push
(per prefs + quiet hours) and Realtime delivers the in-app inbox from the *same* row.
Push and inbox cannot diverge; read state is server-side and cross-device.

## 6. Deploy runbook (run in this order when pushing)

Frontend (`git push` → Vercel) is inert for notifications on its own; the behavior
lives in the Supabase migrations + functions below. **Order matters:**

1. **Migrations first** (`supabase db push` or SQL Editor): `20260715140000` (dequeue
   RPC — before redeploying `dispatch-scheduled-pushes`, or scheduled pushes duplicate),
   `20260716120000` (`notifications` table — before any producer/consumer runs), plus
   Phase 3/5 policy + column migrations when those ship.
2. **Deploy `dispatch` AND `class-reminders` together**, then add the `termflow-dispatch`
   cron. Deploying `class-reminders` alone = reminders queue but never send.
3. **Redeploy `dispatch-scheduled-pushes`** (Phase 0 TZ/RPC; Phase 2b fan-out).
4. **Retire crons:** `cron.unschedule('termflow-daily-digest')` (Phase 0).
5. **Frontend deploy** (client inbox) any time — safe independently.
6. **Verify** end-to-end before relying on it: real class reminder flows produce →
   dispatch → device + shows in the bell; scheduled push fires on time (IST).

**Rollback:** redeploy the previous edge function; the tables/RPC are additive and
harmless if unused.

## 7. Resolved decisions

- **TZ bug** — confirmed real; fixed in Phase 0 (compare vs now-in-IST).
- **group_chat** — kept OUT of `notifications`; moves to `group_messages` (Phase 3),
  migrated after the social types to de-risk.
- **Client-inserted social events** — scoped INSERT policy pins `data.from_id` to the
  caller (Phase 3), target unrestricted (matches current model).
- **Realtime cost** — one `postgres_changes` channel per signed-in user on
  `notifications`; cohort is a few hundred, well within Supabase Realtime limits. Same
  pattern already proven by the `friend_pings` subscription.
