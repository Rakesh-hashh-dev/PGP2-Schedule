# TermFlow Feature Implementation Record

Date: 29 September 2026  
Project: PGP2 Schedule / TermFlow

## Implemented and active

| Feature | Page or surface | What was implemented |
|---|---|---|
| Search modal redesign | Global search modal, opened from the sidebar, top bar, or `Ctrl/Cmd + K` | Increased the laptop modal width to 780px, introduced a two-column laptop result layout, retained a compact single-column phone layout, improved the heading and search field, and preserved keyboard navigation and focus handling. |
| Universal search | Global search modal | Search now covers navigation pages, classes, friends, assignments, course resources, announcements, and schedule changes. Quick actions open calendar export, assignments, attendance, and study-circle planning. |
| Morning or Evening Brief | Bottom of the Today page | Displays the next class or end-of-day state, tomorrow's first class, remaining sessions, urgent assignments, and attendance still waiting to be marked. The heading changes between Morning Brief and Evening Brief based on the time. |
| Since Last Visit digest | Bottom of the Today page, beside the daily brief on wider screens | Summarizes new schedule changes, active campus announcements, and unread social activity since the previous meaningful visit. It collapses to a single-column layout on smaller screens. |
| Attendance Recovery Planner | Bottom of the Attendance page, after Course Overview | Lets students select a 60%, 70%, 75%, 80%, or 90% target. For each recorded course it shows consecutive classes required to recover, the earliest estimated recovery date, or how many further classes may currently be missed while remaining above the target. |
| Study circles | Social page → Plans → New plan | Extended the existing shared-plan workflow with Social Plan and Study Circle modes. Study circles can be linked to a course, include a topic or goal, use existing place/date/time controls, invite TermFlow friends, and continue through the existing cloud meetup and RSVP system. |
| Placement workspace foundation | Implementation retained but currently parked | Built a private, device-local opportunity tracker with company, role, pipeline stage, deadline, listing link, preparation notes, search, filters, editing, and summary metrics. The page, navigation, mobile entry, recent-tools entry, and search results are currently hidden for later reactivation. Existing local placement data is preserved. |

## Supporting integration changes

- Added responsive styles for the search modal, Today intelligence cards, attendance recovery cards, study-circle controls, and the parked placement workspace.
- Updated desktop navigation tests and mobile More-page integration while the placement page was active, then restored the visible navigation expectations when it was parked.
- A saved `placements` view now redirects to Today so users cannot reopen the parked page from an older local preference.
- Placement implementation files remain in the repository and can be re-enabled without rebuilding the feature.

## Validation completed

- 418 automated tests passed across 37 test files.
- ESLint completed with zero errors; the existing `App.jsx` hook warnings remain unchanged.
- `git diff --check` passed.
- Production Vite compilation passed after the main implementation.
- Live browser checks covered laptop and 390 × 844 phone layouts.
- The Today brief and return digest were verified after the timetable and Mess Menu.
- The Attendance Recovery Planner is the final section of the Attendance page.

## Release status

- Changes are local only.
- No commit, push, deployment, or database migration was performed.
- Placement data remains local to the browser/device.
- Study-circle invitations use the existing meetup backend; no new database migration was required.
