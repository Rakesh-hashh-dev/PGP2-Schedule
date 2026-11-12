# Social workflow enhancements

Status: FINALIZED

Implement all eight user-approved recommendations in order. Keep changes local: no commit, push, deployment, or production data writes. Preserve unrelated Admin edits, feature flags, permission boundaries, established themes and compare/navigation behavior.

1. Action-first Overview: pending invitations, friend requests and polls first; upcoming confirmed plans next; suggestions next. Compact preferences.
2. Shared-time suggestions: duration, preferred hours, weekday/weekend filters; several candidate slots per circle/day; explanatory labels.
3. Scheduling loop: persistent invitee alternative-time proposals, time polls and organiser conversion of winning slot to meetup. Use scoped RLS migration where necessary. Never device-only collaborative state.
4. Group workspace: Chat / Plans / Polls / Pins / Members; last-message previews, unread badges, recent-activity ordering. Preserve privacy/invites/approvals.
5. Chat: timestamps, day separators, unread divider, search, replies, user/group-scoped drafts, cursor pagination. Preserve edits/deletes/reports/polls/realtime/failure recovery.
6. Availability: freshness/source explanations; conflicts with accepted meetups and personal busy blocks. Keep unavailable/private data explicit.
7. Lifecycle: calendar export, attendee breakdown, this/future occurrence edits and cancellation with atomic writes and notifications.
8. Buddy discovery: visible reasons, course/purpose filters, shared-time windows, study invitation after connection. Retain consent and opt-in preferences.

Cross-cutting: touch/keyboard-visible actions, labelled chat input, pressed filter states, keyboard favourite reordering, per-user restored section/group. Verify behavior, lint, production build and migrations. Capture responsive UI if browser available; report any missing visual evidence honestly.
