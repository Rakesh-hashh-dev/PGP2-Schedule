# Ordered implementation

Status: all blocks and integration fixes implemented locally. Full988-test suite, changed-file lint, PostgreSQL behavior assertions and isolated production build passed. See JOURNAL.md and docs/social-enhancements-20261111.md. Browser visual verification and production release remain outside the obtained evidence.

No concurrent writers. Block A: steps 1-2. Block B: step 3. Block C: steps 4-5 and chat/navigation accessibility. Block D: steps 6-7. Block E: step 8 and remaining accessibility. Root integrates and verifies. Each block returns changed paths, validation, remaining dependencies; record progress in JOURNAL.md.

Baseline unrelated changes: src/components/AdminDashboard.jsx, AdminHistoryExplorer.jsx, AdminNotificationDiagnostics.jsx; src/lib/adminSearchView.js/test; src/styles/admin-notification-diagnostics.css and admin-record-search.css. Do not alter.

Do not run npm prebuild snapshot generation. Use focused Vitest, changed-file ESLint and direct Vite build. No commits or deployment.
