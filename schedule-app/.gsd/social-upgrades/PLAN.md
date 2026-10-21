# Social upgrades
Implement all six accepted additions using existing Social contracts. Preserve attendance edits. No new dependency, commit, push or production deployment.

1. Planning (`socialPlanning.js`, `meetups.js`, `Meetups.jsx`, migration): templates, duration/end time, class-clash warnings, atomic bounded weekly repeats. Verify interval boundaries, recurring local dates, persistence failures and rendering.
2. Groups and responses (`socialActivity.js`, `SocialActivity.jsx`, `GroupPins.jsx`, migration): pending RSVPs, open unvoted group polls, unread messages with working destinations; safe shared pinned notes/links/messages and membership checks. Verify read cursors, stale results, permissions and failed writes.
3. Overview/preferences (`SocialOverviewExtras.jsx`, `BuddyPreferences.jsx`, `socialWorkspace.js`, `status.js`, `FriendsPanel.jsx`, styles): common timetable gaps, optional dismissible cards, user-scoped subject/interest/purpose preferences, explained buddy matches and explicit availability. Verify unknown/away/expired status handling and mobile containment.

Done means all six paths work together, existing compare/chat/invites remain usable, and meaningful tests, lint, build, SQL validation and browser checks are recorded in `.gsd/JOURNAL.md`. Remote migration and signed-in production validation are separate from local evidence.

Status: local implementation complete. All six paths, 473 tests, targeted lint, production build, SQL assertions and browser checks passed. Evidence recorded in .gsd/JOURNAL.md. Production migration remains unapplied.
