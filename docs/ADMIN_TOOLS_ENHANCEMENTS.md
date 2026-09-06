# Admin Tools Enhancement Roadmap

This roadmap proposes the next improvements for TermFlow's admin tools. The
current dashboard already provides schedule editing, conflict warnings, bulk
updates, communication controls, audit logs, and operational analytics. These
recommendations focus on safer changes, clearer impact, and faster operations.

> **Revised after a codebase review.** An earlier draft of this roadmap assumed
> a normalised schema (separate tables for overrides, cancellations and room
> changes) and a single deployed edge function. Neither is true. The plan below
> — and the risk register at the end — has been rewritten against what the app
> actually does. The "Architecture constraints" section is the reason several
> items changed shape or moved in the delivery order; read it before planning
> any of this work.

## Architecture constraints (read first)

Five facts drive every decision in this document.

1. **There is one config row, not a schema.** All admin state lives in a single
   JSONB column: `system_config.flags` where `id = 'global'`. Class overrides
   are `flags.classOverrides[date][key]`; cancellations are just
   `type: "cancelled"` entries inside that same map. There are no separate
   override / cancellation / room-change tables. Multi-table atomicity is
   therefore a non-issue — every write is already atomic.

2. **That row is world-readable.** The RLS lockdown migration
   (`20260801120000_admin_rls_lockdown.sql`) gates *writes* to admins but
   explicitly keeps public read: "Public read stays (the whole app reads config
   on every load)". RLS is row-level, and this is one row every student reads.
   **Nothing placed in `flags` can be hidden from students, and everything
   placed there is downloaded by every user on app start.**

3. **Concurrency is whole-row last-write-wins.** `saveConfig()` guards with
   `.eq("updated_at", loadedUpdatedAt)` across the entire row, so two admins
   editing unrelated areas still collide. The only offered resolution is **Force
   Deploy**, which overwrites the other admin's work wholesale. There is no
   field-level merge.

4. **Rollback and scheduled deploys already exist.** `flags.configHistory`
   keeps 15 prior snapshots behind a "Restore Version" dropdown, and the
   `apply-scheduled-config` cron applies queued snapshots from
   `flags.scheduledConfigDeploys` at a due time.

5. **The app does not own the schedule.** The base timetable comes from a Google
   Apps Script feed (`FEED_URL`) with its own CHANGES log; the app only layers
   overrides on top. The `schedule-diff` function runs on a `*/10` cron and
   turns upstream feed changes into student notifications automatically. There
   are ten edge functions and at least four cron jobs (`health-monitor`,
   `apply-scheduled-config`, `dispatch-scheduled-pushes`, `schedule-diff`), not
   one.

## Phase 0 — prerequisite: get admin data out of the global config row

> **Status: implemented** (migration
> `20260906120000_admin_roles_and_draft_store.sql`, `src/lib/adminStore.js`).
> Applied to production 2026-09-06 — see "Production rollout" below.

**This is not optional, and nothing in "Priority recommendations" is safe to
build before it.** Three separate features below are blocked on it.

Move admin-only structures out of `system_config.flags` into their own tables
with admin-gated `select` policies:

- `schedule_drafts` — unpublished changes (blocks item 1).
- `schedule_versions` — named snapshots (blocks item 3).
- `schedule_templates` — reusable operations (blocks item 4).

Keep the change additive and backward-compatible: the published override map
stays where it is (`flags.classOverrides`) so the student app, `class-reminders`
and `schedule-diff` keep reading exactly what they read today, with no
synchronised redeploy.

Doing this first buys three things at once:

- Drafts become genuinely invisible to students (constraint 2).
- Admin-only data stops inflating the payload every student downloads on cold
  start (constraint 2).
- Per-feature rows can be written independently, so two admins working on
  different things stop colliding (constraint 3).

Also in Phase 0, **extend `stripHistoryKeys`** to strip every new container key
introduced. That helper exists because history nested inside history and grew
the config row exponentially — the code comment calls it "the main cause of slow
deploys". Every new key added to `flags` must be added to that strip list.

## Production rollout — applied 2026-09-06

Applied via `supabase db push`, which had exactly one pending migration. Two
findings from reviewing production's actual schema first, one of which
contradicted an assumption drawn from the repo:

**Row security on `system_config` was already enabled, and a public read policy
already existed.** Neither appears in any repo migration — both were created
through the dashboard. The repo alone therefore suggests the 2026-08-01
lockdown's write policies were inert and that enabling row security would take
the app offline for lack of a SELECT policy. Production said otherwise on both
counts. **Read the live schema before trusting the migration history here: this
project's production schema has drifted ahead of its migrations.**

The write gate was consequently real all along — but it called binary
`is_admin()`, so monitors did hold full write access. That was the actual gap,
and it is what this migration closes by moving the policies to
`can_write_config()`.

**The `admins` SELECT policy recursed.** The lockdown migration wrote
`using (auth.jwt()->>'sub' in (select user_id from public.admins))` — a policy
on `admins` that queries `admins`. Any client-role access raised "infinite
recursion detected in policy for relation admins", so the roster was
unreadable from the app. Now repointed at `is_admin()`, which is SECURITY
DEFINER and does not re-enter RLS.

Verified after applying: an anonymous request still reads the config row (HTTP
200); `flags.adminRoles` is gone while `classOverrides` is untouched; and
`schedule_drafts` / `schedule_versions` / `schedule_templates` / `admins` all
refuse unauthenticated reads. A non-admin authenticated user sees zero draft
rows rather than an error.

**Lockout guard.** The migration aborts if it would leave zero superadmins,
since everything runs in one transaction. It did not fire, so production has at
least one. `is_admin()` also stays open while `admins` is empty; that hatch
closes itself once the roster has a row, which it does.

## Priority recommendations

### 1. Draft, review, and publish workflow

Keep schedule changes as drafts until an admin explicitly publishes them.

- Show a side-by-side change summary before publishing.
- Record the reviewer, publisher, and publication time in the audit log.
- Allow an admin to discard or restore a draft safely.

**Requires Phase 0.** Drafts stored in `flags` would be readable by every
student (constraint 2).

**Deferred:** second-admin approval. It multiplies concurrent editing on a store
whose conflict resolution is a clobber button (constraint 3), and it needs a
role dimension that item 8 has not yet built properly. Revisit after both.

### 2. Student-impact preview

Before publishing a cancellation, room move, or time change, show its effect.

- List the affected sections, students, sessions, and notification recipients.
- Flag students with clashes or back-to-back sessions caused by the change.
- Estimate the number of push and in-app notifications that will be sent.
- Require an acknowledgement for high-impact changes.

Present notification counts as "will attempt N sends", not a delivery promise —
actual delivery diverges through stale tokens and push failures.

### 3. Extend the existing version history — do not rebuild it

Rollback already exists (constraint 4). Building a parallel mechanism would give
the app two competing "restore" paths and two competing "apply later" paths.
Scope this to closing the real gaps in what is already there:

- Snapshots are whole-config only — add selective restore of a day, a week, or
  a chosen set of overrides.
- History is capped at 15 unlabelled entries — add names and a content summary
  so an admin can tell versions apart.
- Mark restores **silent** by default so a rollback cannot re-fire notifications
  for stale changes.
- Reconcile with `flags.scheduledConfigDeploys` rather than adding a second
  scheduled-publish queue.

## Workflow and scheduling improvements

### 4. Reusable schedule templates

Allow administrators to create reusable templates for recurring operations:
makeup classes, exam-week timetables, holidays, and special events. A template
should support a preview and be applicable to selected dates or sections.

**Requires Phase 0** (templates are admin-only data). Template application must
re-validate against current section data at apply time — see the risk register.

### 5. Conflict-resolution assistant

Extend existing conflict warnings into actionable recommendations.

- Suggest available rooms for an overlapping session.
- Suggest free time slots within the selected date range.
- Identify the alternative with the fewest affected students.
- Let the admin apply a selected suggestion as a draft change.

Availability must be computed across published state **and** all open drafts,
or it will suggest a room already claimed by an unpublished draft.

### 6. Unified communication centre

Bring announcements, push notifications, and in-app notices into one guided
workflow.

- Choose the target audience from affected students, sections, or all users.
- Preview the message for each delivery channel.
- Schedule delivery and track delivery, failures, and resend attempts.
- Link each communication to the schedule change that prompted it.

**Blocked on the notification redesign.** The event store this would sit on is
still at Phase 0 of its own redesign with known open bugs (~5.5h TZ bug, flags
race, double digest) — see `docs/notification-architecture.md`. Build this after
that redesign lands, not on top of it.

### 7. Emergency operations mode

Provide a focused flow for sudden closures or major disruptions.

- Cancel a date or range of sessions.
- Select affected sections automatically.
- Prepare a prefilled, editable notification.
- Publish the change and message together.
- Record the incident.

Hard requirements, given this is the highest blast-radius item in the roadmap:

- A mandatory preview naming the exact dates and sections, acknowledged before
  anything sends.
- **Force Deploy must be disabled inside this flow.** A clobber button in a
  panic flow is how one admin silently erases another's response.
- Describe reversal honestly as "restores the schedule" — delivered
  notifications cannot be unsent.

## Governance and safety improvements

### 8. Fix admin roles before extending them

> **Status: steps 1-2 implemented** (same migration; `src/lib/adminRoles.js`).
> The finer scopes below are still open.

A role system already exists and its enforcement is cosmetic:
`flags.adminRoles[admin_id] === "monitor"` gates saving with a client-side
`alert()`, while the database's `is_admin()` is binary. A "monitor" can bypass
that alert from devtools and write anything. The role map itself sits in the
public-read blob, so it is world-readable. `is_admin()` is also deliberately
**open while the `admins` table is empty** (a bootstrap escape hatch).

Order of work:

1. Move `adminRoles` out of the public blob into the `admins` table.
2. Make `is_admin()` role-aware and enforce the existing `monitor` restriction
   in Postgres, not in the browser.
3. Only then add the finer scopes below.

- **Scheduler:** manage schedule drafts and publish changes.
- **Communications:** create and send announcements and notifications.
- **Moderator:** manage feedback and moderation actions.
- **Analyst:** view analytics and export reports without editing data.
- **Super Admin:** manage roles, production settings, and rollback access.

Re-audit every existing admin RPC and edge function when this lands, not just
new ones — an RLS-clipping bug has already occurred here (admin stats).

### 9. Rich audit-log explorer

Make the audit history useful during reviews and incidents.

- Filter by date, administrator, action type, and affected schedule record.
- Show before-and-after values for every change.
- Link actions to their associated deployment or communication.
- Export filtered records as CSV.

**Capture before/after values as items 1-7 are built, not afterward.** The
explorer UI can ship last; the write-site instrumentation cannot.

### 10. Admin task queue

Surface unfinished or risky operational work in one place: pending moderation,
unresolved conflicts, drafts awaiting publication, scheduled announcements,
failed notification batches, and stale automated jobs.

## Analytics improvements

### 11. Proactive analytics alerts

Allow admins to define thresholds and receive alerts for falling active users,
low notification delivery rates, unusual absence rates, repeated conflicts, and
failed or stale cron jobs.

Delivery-rate alerting depends on item 6's redesign landing first, or it will
produce false positives against known pipeline bugs. Cron-health alerting is
independent and can ship earlier — there are four cron jobs to cover, not one.

### 12. Student-impact analytics

Add schedule-specific indicators alongside the existing product analytics:
workload heatmap by section and day, back-to-back and long-gap counts,
free-window distribution, room-use and conflict trends, and cancellation and
rescheduling rates.

## Recommended delivery order

1. **Phase 0** — move admin-only data out of the global config row; extend
   `stripHistoryKeys`. Unblocks items 1, 3 and 4 and fixes the concurrency and
   payload problems underneath all of them.
2. **Item 8, steps 1-2** — make the existing `monitor` role actually enforced
   and get the role map out of public read. This is a live authorisation gap,
   not a feature.
3. **Item 1** (drafts, single-admin) and **item 2** (impact preview).
4. **Item 3** (extend existing history) and **item 9**'s write-site capture.
5. **Item 4** (templates) and **item 5** (conflict assistant).
6. **Item 7** (emergency mode), once drafts and previews exist to build it on.
7. **Item 6** (communication centre), after the notification redesign.
8. **Items 8 (scopes), 10, 11, 12.**

The reordering rests on two findings: the store migration is a hard prerequisite
rather than an implementation detail, and the existing `monitor` role is
unenforced today, which makes it a security fix competing with — and beating —
new features for priority.

## Risk register

Risks below are grounded in the constraints at the top of this document.

### Cross-cutting risks

- **Concurrency is the dominant risk of this entire roadmap.** The flagship
  feature (item 1) is a multi-admin workflow, and the store cannot merge
  concurrent edits — it offers Force Deploy, which destroys the other admin's
  work (constraint 3). Every feature that increases the number of admins editing
  at once increases the rate of silent work loss until Phase 0 splits the row.
- **Public-read leakage.** Any admin-only structure left in `flags` is visible
  to every student who opens devtools. This has already been the source of one
  security finding in this project.
- **Cold-start payload.** The whole config row is fetched by every user on every
  load and already carries 15 history snapshots. Drafts, versions and templates
  each multiply admin-only bytes on the student startup path.
- **Exponential row growth.** `stripHistoryKeys` exists because a nested history
  grew the row exponentially and became the main cause of slow deploys. Every
  new container key must be added to it; missing one silently reintroduces the
  bug.
- **Migration ordering.** Migrations are applied directly to prod (`db push` is
  unsafe on this project), so schema changes must stay additive and
  backward-compatible until each rollout completes.
- **Edge-function coupling is wider than it looks.** Ten functions and at least
  four cron jobs read or write this state. Any change to override or publish
  semantics must keep all of them reading published state without a synchronised
  redeploy.
- **Upstream changes bypass every gate built here.** The base schedule is not
  the app's to version (constraint 5). `schedule-diff` announces feed changes to
  students on a `*/10` cron regardless of draft or publish status, so a draft
  workflow governs the override layer only. Do not describe it to admins as
  controlling "the schedule".
- **Scope creep vs. in-flight refactor.** The App.jsx monolith extraction is
  still mid-flight; layering new state on partially extracted logic increases
  the chance of extracting it incorrectly.

### Per-item risks

**1. Draft, review, publish.** Every path that reads overrides (student app,
`class-reminders`, `schedule-diff`, analytics) must filter to published-only;
missing one leaks drafts. Retrofitting a draft dimension onto override keying
risks reintroducing the exam/empty-code key-collision class of bug already fixed
in `lib/overrides.js`.

**2. Student-impact preview.** Needs a dry-run mode: conflict detection and
recipient computation must become pure functions callable without side effects.
Given how entangled this logic is with writes today, this is a bigger lift than
it appears. Notification estimates will drift from actual delivery.

**3. Version history.** The main risk is duplication — building a second
rollback path alongside `configHistory` and a second scheduled-publish queue
alongside `scheduledConfigDeploys`. A restore that is not explicitly silent can
re-fire notifications for reverted changes, and a mid-day rollback can desync
reminders `class-reminders` has already sent.

**4. Templates.** Section and date assumptions are hardwired (A/B sections,
`SINGLE_SECTION_B`, `CODE_ALIASES`), and already documented as fragile across
term rollovers. A template built this term will silently misapply next term
unless it re-validates against current section data at apply time.

**5. Conflict assistant.** Suggestions computed against published state alone
will recommend rooms already claimed by open drafts, producing double-bookings
discovered only after publishing.

**6. Communication centre.** Building on a notification store that is still at
Phase 0 of its own redesign means either blocking on that work or writing logic
against known bugs that will need rework.

**7. Emergency mode.** Mass-cancel plus mass-notify in one action, used under
time pressure — the exact condition in which a wrong date range or section
selection does maximum damage. Force Deploy being reachable here would let one
admin erase another's incident response. Delivered notifications cannot be
recalled.

**8. Admin roles.** The current `monitor` gate is client-side only and
bypassable — a live gap, not a future risk. Retrofitting scoped RLS onto tables
gated only on binary `is_admin()` risks silently under- or over-scoping access;
an RLS-clipping bug has already occurred here. The bootstrap hatch (`is_admin()`
open while `admins` is empty) must not be left open once roles carry real
authority.

**9. Audit explorer.** Low functional risk, but before/after capture must be
added at every write site as items 1-7 are built. Sequencing the capture work
last means early features ship without audit coverage.

**10. Task queue.** Aggregating drafts, conflicts and failed jobs across many
sources gets expensive at scale, and it inherits any state inconsistency from
items 1-7 — a wrong status elsewhere surfaces here as a wrong queue entry.

**11 & 12. Analytics.** Delivery-rate thresholds on a known-buggy pipeline
produce false positives until item 6 lands. Cron-health alerting must cover all
four scheduled jobs.
