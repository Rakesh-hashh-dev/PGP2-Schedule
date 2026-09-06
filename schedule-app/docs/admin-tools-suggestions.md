# Admin Tools — Suggested Additions

This note proposes practical additions to TermFlow's Admin Tools. The goal is
to make day-to-day operations faster and safer, rather than add controls that
are rarely used.

## Recommended first

### 1. Student Support Queue

Give admins one place to find students who may need help.

Possible signals:

- Incomplete onboarding or no courses selected
- Attendance sync errors or missing attendance data
- No recent activity for a configurable period
- Pending feedback or reported issue
- Profile and timetable data that needs attention

Each row should be directly clickable and open the existing user inspector,
with a visible **Inspect** action. Keep the initial version read-only except
for the existing, audited admin actions.

### 2. Schedule Change Simulator

Before an admin publishes a cancellation, room change, or class override,
show a preview of:

- Affected date, course, section, room, and time
- Number of potentially affected students
- Any clashes created by the proposed change
- The notification audience if a related broadcast will be sent
- A clear before-and-after summary

The simulator should be a preflight step: it explains the impact before the
existing override is saved, but does not silently change schedule data.

## Strong next additions

### Broadcast Audience Builder

Add reusable audience filters for broadcasts:

- Section or selected course
- Students affected by a particular schedule change
- Inactive users
- Attendance-risk groups
- New or incomplete-onboarding users

Always display the recipient count and a compact recipient sample before the
existing send action. Sending remains an explicit, audited operation.

### Data Quality Monitor

Surface timetable and system data issues in a single read-only health list:

- Duplicate classes or conflicting entries
- Missing room, faculty, section, start, or end data
- Invalid time ranges
- Stale schedule snapshot or source-feed failure
- Overrides for dates that have passed

Each alert should link to the relevant existing editor or diagnostic view.

### Feedback Inbox

Turn student feedback into a manageable queue with status, owner, severity,
labels, and a link to the relevant user or feature area. Useful filters:
**New**, **Investigating**, **Planned**, **Resolved**, and **Duplicate**.

### Adoption Dashboard

Add a privacy-conscious, cohort-level view of how TermFlow is being used:

- Daily and weekly active users
- Onboarding completion
- Feature adoption (attendance, friends, notifications, calendar export)
- Notification delivery and open rate, where available
- Retention trends

Use aggregate counts and trends; avoid presenting unnecessary individual-level
activity as analytics.

## Insights — Suggested additions

Insights should answer three questions quickly: **Is TermFlow healthy? Are
students getting value? Does anything need attention now?**

### Attention Now

Add a top-level, severity-ranked list that turns passive metrics into an action
queue. Examples:

- Schedule feed or snapshot is stale
- A scheduled reminder or cron job has missed its expected run window
- A notification delivery failure is above its normal range
- A sudden drop in daily active users or attendance marks needs investigation
- A course or section has an unusual concentration of attendance-risk students

Every item should explain why it was flagged, show the observed value and
threshold, and link to its relevant Admin Tools view.

### Live Operations Strip

Show the most time-sensitive operational facts in one compact strip:

- Feed freshness and snapshot age
- Last successful reminder run
- Current app version / deployment age
- Active admins and students in the app right now
- Open support or feedback count

Use clear healthy, watch, and action-needed states. Do not present a service as
healthy merely because a request returned HTTP success; validate the expected
payload where applicable.

### Engagement Trend, Not Just Totals

Add 7-day and 28-day trends for:

- Active students
- New and returning users
- Attendance marks made
- Schedule views and calendar exports
- Notification opens, where available

Show the percentage change against the preceding equivalent period and a small
trend line. A single total without a comparison rarely helps an admin decide
whether action is needed.

### Cohort and Section Comparison

Let an admin compare aggregate engagement across sections and selected-course
groups. Useful signals include active users, onboarding completion, attendance
marking, and notification reach. Highlight meaningful outliers, but avoid
ranking individuals or exposing more personal activity data than is needed.

### Attendance Risk Early Warning

Create a cohort-level view for courses where many students are nearing an
attendance threshold. Include:

- Course and section
- Number and share of students at risk
- Direction of change over the last week
- Upcoming class count and the next session date

Link to the existing Users filtering and attendance context rather than adding
an unaudited bulk-action flow.

### Schedule Impact Summary

For the next 7 days, highlight timetable load and disruption:

- Classes, cancellations, reschedules, and room changes
- Students or sections affected by overrides
- Busiest days and potential clashes
- Announcements or reminders scheduled to go out

This gives admins a forward-looking operational picture, complementing the
historical activity feed.

### Insight History and Thresholds

Allow admins to see when an alert first appeared, whether it is improving, and
which threshold caused it. Keep thresholds versioned and explainable, so a
"red" state never feels arbitrary. Threshold changes should be admin-only,
audited, and require an explicit save.

### Change Timeline

Create a readable chronological view of schedule/configuration changes,
broadcasts, and related admin actions. Every item should say what changed, who
made the change, when it happened, and link back to the affected object.

### Admin Handoff Notes

For multiple admins, add a short internal shift-note area:

- What is being investigated
- Current owner
- Next action
- Optional expiry date

This is especially useful for schedule incidents and support follow-up.

## Safety and implementation rules

- Reuse existing audit logging for every state-changing action.
- Keep sensitive or destructive actions behind clear confirmation steps.
- Build cohort-wide metrics through appropriate admin-authorized queries, not
  client-side counting under row-level security.
- Prefer direct row clicks plus a visible text action such as **Inspect**;
  do not rely on icon-only row affordances.
- Keep a clear boundary between read-only diagnostics and actions that publish,
  notify, or change schedule data.

## Suggested delivery order

1. Student Support Queue
2. Insights: Attention Now and Live Operations Strip
3. Schedule Change Simulator
4. Insights: Engagement Trends and Schedule Impact Summary
5. Broadcast Audience Builder and Data Quality Monitor
6. Feedback Inbox, Change Timeline, and Admin Handoff Notes
7. Cohort Comparison and Attendance Risk Early Warning
