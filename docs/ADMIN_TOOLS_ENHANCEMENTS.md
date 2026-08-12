# Admin Tools Enhancement Roadmap

This roadmap proposes the next improvements for TermFlow's admin tools. The
current dashboard already provides schedule editing, conflict warnings, bulk
updates, communication controls, audit logs, and operational analytics. These
recommendations focus on safer changes, clearer impact, and faster operations.

## Priority recommendations

### 1. Draft, review, and publish workflow

Keep schedule changes as drafts until an admin explicitly publishes them.

- Show a side-by-side change summary before publishing.
- Optionally require a second admin to approve high-impact changes.
- Record the reviewer, publisher, and publication time in the audit log.
- Allow an admin to discard or restore a draft safely.

### 2. Student-impact preview

Before publishing a cancellation, room move, or time change, show its effect.

- List the affected sections, students, sessions, and notification recipients.
- Flag students with clashes or back-to-back sessions caused by the change.
- Estimate the number of push and in-app notifications that will be sent.
- Require an acknowledgement for high-impact changes.

### 3. Schedule version history and rollback

Make it possible to recover from any schedule deployment quickly.

- Save named snapshots for each published schedule version.
- Compare a version with the current schedule by date, class, room, and time.
- Restore a full day, week, or selected set of overrides in one action.
- Keep a permanent audit trail for restores and rollbacks.

## Workflow and scheduling improvements

### 4. Reusable schedule templates

Allow administrators to create reusable templates for recurring operations.

Examples include makeup classes, exam-week timetables, holidays, and special
events. A template should support a preview and be applicable to selected dates
or sections.

### 5. Conflict-resolution assistant

Extend existing conflict warnings into actionable recommendations.

- Suggest available rooms for an overlapping session.
- Suggest free time slots within the selected date range.
- Identify the alternative with the fewest affected students.
- Let the admin apply a selected suggestion as a draft change.

### 6. Unified communication centre

Bring announcements, push notifications, and in-app notices into one guided
workflow.

- Choose the target audience from affected students, sections, or all users.
- Preview the message for each delivery channel.
- Schedule delivery and track delivery, failures, and resend attempts.
- Link each communication to the schedule change that prompted it.

### 7. Emergency operations mode

Provide a focused flow for sudden closures or major disruptions.

- Cancel a date or range of sessions.
- Select affected sections automatically.
- Prepare a prefilled, editable notification.
- Publish the change and message together.
- Record the incident and allow a single-step reversal if needed.

## Governance and safety improvements

### 8. Granular admin roles

Replace a broad admin role with scoped permissions.

- **Scheduler:** manage schedule drafts and publish changes.
- **Communications:** create and send announcements and notifications.
- **Moderator:** manage feedback and moderation actions.
- **Analyst:** view analytics and export reports without editing data.
- **Super Admin:** manage roles, production settings, and rollback access.

### 9. Rich audit-log explorer

Make the audit history useful during reviews and incidents.

- Filter by date, administrator, action type, and affected schedule record.
- Show before-and-after values for every change.
- Link actions to their associated deployment or communication.
- Export filtered records as CSV.

### 10. Admin task queue

Surface unfinished or risky operational work in one place.

- Pending feedback and moderation actions.
- Unresolved schedule conflicts.
- Drafts awaiting review or publication.
- Scheduled announcements awaiting approval.
- Failed notification batches and stale automated jobs.

## Analytics improvements

### 11. Proactive analytics alerts

Allow admins to define thresholds and receive alerts when the system needs
attention.

- Falling daily or weekly active users.
- Low notification delivery rates.
- Unusual absence rates for a class or section.
- Repeated room or timing conflicts.
- Failed or stale cron jobs.

### 12. Student-impact analytics

Add schedule-specific indicators alongside the existing product analytics.

- Workload heatmap by section and day.
- Back-to-back session and long-gap counts.
- Free-window distribution for meeting or makeup-class planning.
- Room-use and room-conflict trends.
- Class cancellation and rescheduling rates.

## Recommended delivery order

1. Draft, review, and publish workflow.
2. Student-impact preview.
3. Schedule version history and rollback.
4. Reusable schedule templates and conflict-resolution assistant.
5. Unified communication centre and emergency operations mode.
6. Role governance, audit explorer, task queue, and analytics alerts.

The first three items are the highest-value foundation: they reduce accidental
changes, make consequences visible before publication, and provide reliable
recovery when something goes wrong.

## Risk register

Risks are grounded in the current architecture: a Supabase backend with
RLS-heavy tables, the cron-scheduled `class-reminders` edge function,
migrations applied directly to prod (not via `db push`), hardwired
term/section assumptions, and an admin dashboard and App.jsx extraction that
are both mid-refactor.

### 1. Draft, review, and publish workflow

- Requires a schema fork: every schedule-affecting table (overrides,
  cancellations, room changes) needs a `status: draft/published` dimension or
  a shadow `schedule_drafts` table. Retrofitting this onto existing
  override-keying logic risks reintroducing the exam/empty-code key-collision
  class of bug fixed previously.
- Any code path that currently reads overrides directly (student app,
  `class-reminders` fn, analytics) must be updated to filter to
  published-only — missing one leaks drafts to students before publish.
- Second-admin approval introduces a role/permission dimension before
  granular roles (#8) exist, likely requiring rework once #8 lands.

### 2. Student-impact preview

- Needs a dry-run/simulate mode for logic that currently mutates data live —
  conflict/clash detection and notification-recipient computation must become
  pure functions callable without side effects. Given the app's history of
  monolith logic entangled with DB writes, this may be a bigger lift than it
  appears.
- Notification-count estimates can drift from actual delivery (push
  failures, stale tokens), so a pre-publish estimate that doesn't match
  reality erodes admin trust.

### 3. Schedule version history and rollback

- Snapshotting a full published schedule is ambiguous once overrides, room
  relocations, and cancellations live in separate tables — rollback must
  restore all of them atomically or risks partial-restore corruption.
- Restoring a past version can re-trigger notification sends unless rollback
  is explicitly marked silent, risking spamming students with stale
  notifications.
- Interacts with the cron-driven `class-reminders` fn: a mid-day rollback
  could desync reminders already fired from the now-reverted schedule.

### 4. Reusable schedule templates

- Templates encode section/date assumptions; given the hardwired A/B section
  structure and term-specific hacks (`SINGLE_SECTION_B`, `CODE_ALIASES`)
  already documented as fragile across term rollovers, templates built for
  this term will silently break or misapply next term unless template
  application re-validates against current section data.

### 5. Conflict-resolution assistant

- "Suggest available rooms/slots" requires a live availability index
  recomputed across all pending drafts, not just published state. Otherwise
  it can suggest a room already taken by another unpublished draft, producing
  a double-booking the admin only discovers after publishing.

### 6. Unified communication centre

- Consolidates announcements, push, and in-app notices on top of a
  notification event store that is still only at "Phase 0" of its own
  redesign (known bugs: ~5.5h TZ bug, flags race, double digest). Building a
  new unified layer now means either blocking on that redesign or building
  logic against the current buggy system that will need rework.

### 7. Emergency operations mode

- Highest blast-radius item: mass-cancel plus mass-notify in one action,
  designed to be used quickly under pressure — exactly the condition where a
  wrong date range or section selection causes maximum damage (wrong week
  cancelled, wrong cohort notified). Needs a hard confirmation/preview step;
  "single-step reversal" cannot unsend notifications already delivered.

### 8. Granular admin roles

- Retrofitting RLS role checks onto tables currently gated only on "is
  admin" carries real risk of silently under- or over-scoping access, given
  an RLS-clipping bug has already occurred in this codebase (admin stats).
  Every existing admin RPC/edge function needs re-auditing, not just new
  ones built after this lands.

### 9. Rich audit-log explorer

- Lower functional risk, but before/after value capture must be added at
  every write site as items 1-7 are built, not retrofitted afterward.
  Sequencing it last (per the delivery order) means early features ship
  without full audit coverage until this catches up.

### 10. Admin task queue

- Mainly an aggregation risk: scanning drafts/conflicts/failed-jobs across
  many tables could get expensive at scale. It also inherits any state
  inconsistency from items 1-7 — a stale or wrong `status` field elsewhere
  shows up here as a stale or wrong queue entry.

### 11 & 12. Proactive analytics alerts and student-impact analytics

- Threshold alerts on notification delivery rate depend on the notification
  pipeline being reliable first (see #6); alerting on top of a known-buggy
  delivery system will produce false positives until that system is fixed.

### Cross-cutting risks

- **Migration ordering.** Migrations are applied directly to prod, not via
  `db push`, because the latter is unsafe on this project. Draft/status
  columns touch high-traffic tables (overrides), so schema changes must stay
  additive and backward-compatible until each rollout completes.
- **Edge function coupling.** `class-reminders` is the one function already
  deployed and cron-scheduled; any change to override/publish semantics must
  keep it reading the correct (published) state without requiring a
  synchronized redeploy.
- **Scope creep vs. in-flight refactor.** The App.jsx monolith extraction is
  still mid-flight. Layering draft/publish state on top of partially
  extracted logic increases the chance of extracting it incorrectly.
