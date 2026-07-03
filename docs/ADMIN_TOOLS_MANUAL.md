# TermFlow Admin Tools Manual

Covers every control in the Admin Dashboard (`src/components/AdminDashboard.jsx`), what it actually does under the hood, and what it touches in the student-facing app (`src/App.jsx`). Written from the current code as of 2026-07-02.

---

## 1. Getting in

- Admin access is a hardcoded email allowlist — `ADMIN_EMAILS` in [App.jsx:77](schedule-app/src/App.jsx#L77):
  ```
  mba25rakeshb@iimsambalpur.ac.in
  test@iimsambalpur.ac.in
  ```
- If your signed-in email matches, `isAdmin` is `true` and the "Admin" nav item appears — no separate password or role table.
- **To add another admin**: add their email to this array and redeploy. There's no UI for this — it's a code change.
- Everything you configure in the dashboard is stored in one Supabase row: `system_config` table, `id = "global"`. There is no per-admin config — all admins share and overwrite the same settings.

---

## 2. The save model — read this first

This is the single most important mechanic in the whole dashboard:

- Every toggle, override, and text field in the dashboard edits **local React state only** (`flags`, `announcement`, etc.) — nothing reaches other users until you act.
- Nothing goes live until you click **"Deploy Config to Cloud"** at the bottom of the page (`saveConfig()`). That's the only button that writes to Supabase.
- Once saved, the student app picks it up passively — there's no push. A signed-in user's browser re-reads `system_config` on its own poll/refresh cycle. There is no "notify everyone now" mechanic *except* the Danger Zone's **Force Sync** button, which just calls `saveConfig()` again and shows a confirmation alert — it does not actually force anyone's browser to refresh early. Treat "Force Sync" as a relabeled Save, not a push notification.
- **Practical rule: make all your changes across every section first, then click Deploy Config to Cloud once at the end.** If you navigate away or refresh the admin page before deploying, your edits are lost (they're plain `useState`, not persisted as you type).

---

## 3. Top hero bar

| Control | What it does |
|---|---|
| Refresh icon (next to title) | Re-fetches Total Users, Active Today, DB Storage, feedback list, and audit logs from Supabase. Does not touch `system_config` — read-only refresh of dashboard stats. |
| Search icon | Opens the **Admin Command Palette** (also `Cmd/Ctrl+Shift+K`) — see §11. |
| Total Users | Count of rows in `profiles` table (i.e. everyone who's completed onboarding at least once). |
| Active Today | **Not real data.** Hardcoded as `Math.floor(totalUsers * 0.85)` — a placeholder, not a live metric. Don't rely on it. |
| DB Storage Used | Calls a Supabase RPC `get_db_size`. Shows "Error" if that RPC doesn't exist in your Supabase project. |

---

## 4. Live Schedule Editor

A visual, date-scoped view of the timetable with click-to-edit.

- Pick a date → see every class scheduled that day (from the bundled snapshot, not the live feed — see §12).
- **Click any class card** → opens the **Edit Class modal**:
  - Change section (All / A / B)
  - **Cancel Class** — marks it cancelled for everyone
  - Edit start time, end time, room — **Save Changes**
  - **Remove Override** — deletes any admin override for that class/date, restoring the original schedule
- Cards with an **"OVERRIDDEN"** badge already have an active override.
- **Conflict Warning banner**: automatically detects and lists two kinds of problems as you edit — the same room double-booked at overlapping times, or the same section expected in two classes at once. This runs live in the editor before you save anything; use it to catch mistakes.
- Every change here writes into `flags.classOverrides`, keyed by `date → "CODE"` or `date → "CODE_SECTION"`. This is the **same override store** used by the two sections below — they're three different UIs over one data structure.

**Where it takes effect**: [App.jsx:676–711](schedule-app/src/App.jsx#L676) merges `classOverrides` into every user's schedule on load — cancelling hides the class, editing room/time patches it in place, and if the override references a class/section that doesn't already exist for that date, a brand-new class card is synthesized and inserted. This is real-time (once deployed) for **everyone**, not just your account.

---

## 5. Class Cancellation Board

A simpler, single-purpose front door to the same override store: pick a date, type a class code, click **Cancel Class**. No section targeting, no room/time changes — just a hard cancel. Equivalent to opening the Live Schedule Editor and hitting Cancel on that class.

---

## 6. Class Editor (room/time changes)

The full-control form version: Date, Class Code, Section (All/A/B), Start Time, End Time, New Classroom, **Save Change**. Any subset of Room/Start/End can be filled — you don't need all three. If an override already exists for that exact date+code+section, a **Remove Override** button appears next to Save.

**Section-scoping matters**: leaving Section on "All" overrides the class for every section that day. Choosing "A" or "B" only overrides that section, leaving the other untouched — useful when only one section's room changed.

---

## 7. Active Class Overrides (list)

Shows every override currently sitting in `flags.classOverrides` across all dates, so you can audit what's live without re-checking each date in the editor. Each row: date, code (+ section if scoped), and either "(Cancelled)" or the specific room/time change.
- **Edit** — loads that override back into the Class Editor form above for editing.
- **Trash icon** — deletes just that override.
- This section only appears once at least one override exists.

⚠️ Note: none of the override tools above write to Supabase by themselves — like everything else, they only take effect after you click **Deploy Config to Cloud**.

---

## 8. Scheduled Announcements — ⚠️ not currently wired to students

UI: message textarea, start/end date, and a target selector (Global / Section A / Section B / Social Users / any specific subject code). **Add Scheduled Announcement** appends it to a list (`flags.scheduledAnnouncements`), shown below with a delete button.

**Verified in code**: `flags.scheduledAnnouncements` is saved to Supabase, but **nothing in `App.jsx` (or anywhere else in `src`) ever reads it.** Students never see anything created here — no banner, no notification. This tool currently only stores data; it has no visible effect.

There *is* a working single global announcement mechanism (`sysConfig.announcement`, rendered as a banner, with support for string or `{message, target}` targeting) — but the current dashboard UI has no control bound to set it. The textarea/target picker in this section builds `scheduledAnnouncements` entries, not the single `announcement` value the app actually reads. **If you need a live banner today, this UI can't produce one** — flag this to whoever maintains the code if you need it fixed.

---

## 9. Dynamic Quick Links — ⚠️ not currently wired to students

Same situation as above: Title + URL + start/end date, **Add Quick Link**, list with delete. Saves to `flags.quickLinks` in Supabase. **Nothing in the student app reads `quickLinks`.** No sidebar links appear from this — it's a dormant feature.

---

## 10. Update Prompt Text

Configures the copy shown in the "New version available" modal that appears when a deployed update is detected client-side (via the service worker).

- **Title**, **Description**, **Highlights** (one per line, rendered as a bullet list with a ✦ marker)
- **This one is fully wired.** [App.jsx:1055](schedule-app/src/App.jsx#L1055) reads `sysConfig.flags.updatePrompt` and falls back to sensible defaults ("TermFlow just got better" / generic bullets) if you haven't set anything.
- Takes effect the next time a user's browser detects a new service-worker version — not immediately for users already on the latest version.

---

## 11. User Directory

- Search box filters by name or user ID (Clerk sub).
- **Backup Config to JSON** — downloads a `config_backup.json` snapshot of the current `announcement` + `flags` state (whatever's in your browser right now, not necessarily what's saved in the cloud — grab this *after* making changes but it works even before Deploy).
- Per user row:
  - **Click the name/ID** → opens the **User X-Ray modal**: shows name, user ID, all enrolled subjects, and a **Reset Setup** button. Reset Setup nulls their `courses` in Supabase — they'll be forced through onboarding again next login. This is immediate (writes directly to Supabase, not gated by Deploy Config).
  - **Mask icon (Impersonate User)** — loads that student's enrolled courses and attendance record into *your own current session* so you can see the app exactly as they would. Real client-side state swap (not a Supabase write). A "Impersonating: [name]" banner appears in the app shell while active; there's a way to stop impersonation (`stopImpersonation`) that restores your original state.
  - **Ban icon** — toggles that user's ID into/out of `flags.bannedUsers`. Banned users are shown an "Account Suspended" lockout screen ([App.jsx:991](schedule-app/src/App.jsx#L991)) instead of the app — **but only after you Deploy Config to Cloud.**

---

## 12. Feedback & Bug Reports

Read-only feed of the `feedback` Supabase table (whatever mechanism students use to submit feedback elsewhere in the app), newest first, capped at 20. **Mark Resolved** flips that row's `status` to `"resolved"` directly in Supabase — immediate, no Deploy needed.

---

## 13. Feature Flags

- **Auto-generated checkbox list**: every top-level key in the `flags` object is rendered as a toggle automatically, *except* the ones with dedicated UI elsewhere (`maintenanceMode`, `bannedUsers`, `classOverrides`, `abTests`, `scheduledAnnouncements`, `quickLinks`, `heroBackdrop`). Currently this means you'll see: **enableFriends, enableExams, enableAttendance**.
  - Wired and enforced in [App.jsx:1018–1020](schedule-app/src/App.jsx#L1018): each defaults to `true` unless explicitly set `false`. Turning one off hides that entire tab/section from every non-admin student (Friends tab, Exams view, Attendance panel) app-wide.
  - `abTests` exists as a flag key (so it won't show as a stray checkbox) but nothing in the app currently reads or writes into it — it's a reserved slot for a future A/B testing mechanism, not functional yet.

- **Hero Backdrop Strategy** dropdown: `None` / `Swap Alt Days (Default)` / `Static (V2 Image)` / `Static (V3 Image)`. Controls the decorative background behind the "current class" hero card on the home screen for **all users**. A live, scaled-down **Preview** renders directly below the dropdown using a frozen mock class ("Strategic Management") so you can see the effect without needing a real upcoming class.

---

## 14. All Announcements (admin view)

Read-only list of every entry in the schedule-change feed (`CHANGES`), including entries flagged `admin_only: true` (data-quality issues like a class listed with a blank room — hidden from regular students but visible here so you can spot and fix bad sheet data). Shows the newest 3 by default; **View More** opens a modal with the full list. This is informational only — nothing here is editable.

---

## 15. Time Machine

Overrides "now" for your own session only — lets you preview how the Timeline, Agenda, and other date-relative UI will look at any date/time without waiting for it to actually happen. Enter a datetime, or **Reset to Real Time** to clear it. This is local to your browser session (passed down as `timeOverride` prop) — it does **not** affect other users or get saved to Supabase. Great for testing "what does the Sunday countdown look like at 11:58pm" without staying up.

---

## 16. Live Sync Logs

Real-time (well, recent-history) log of the Google Apps Script feed sync — timestamped `[SUCCESS]`/`[ERROR]` entries with the message. Shows the last 5 by default; **View All Logs** expands to the last 500px scroll area. This is the same feed described in your memory notes as the live timetable source (`google_apps_script.js` → Apps Script deployment → `sheet.js`) — if attendance/schedule data looks stale, check here first for fetch errors before assuming a sheet-parsing bug.

---

## 17. Admin Audit Logs

Automatic trail of every consequential admin action, read from the `admin_audit_logs` Supabase table. Actions currently logged: `save_config`, `force_refresh`, `snapshot_rebuild`, `cancel_class`, `edit_class_override`, `edit_class`, `clear_override`, `ban_user`/`unban_user`, `reset_user_setup`, `export_config`. Each entry shows who (admin ID), what (action name + a JSON details blob), and when. Icon/color coded: blue for save/refresh, amber for cancel/override/edit, red for ban/delete.

Use this to answer "who cancelled BM on the 15th" or "when did maintenance mode last get toggled" — though note maintenance-mode toggles themselves aren't separately logged (only `save_config` is, which bundles all flag changes into one entry).

---

## 18. Bundled Snapshot

Shows the health of the fallback timetable baked into the app at build time (added 2026-07-02 — see [pgp2_schedule.md](../../../../.claude/projects/f--Web-Dev-Antigravity/memory/pgp2_schedule.md) memory for background).

- **Green "Automation passed"**: shows when it was generated, class/course counts, and term date range.
- **Red "Automation failed"**: shows the error and how old the snapshot being served actually is.
- **Rebuild button**: triggers a Vercel redeploy via a Deploy Hook, which re-runs `scripts/generate-snapshot.mjs` to refresh the snapshot from the live sheet. **Requires `VITE_DEPLOY_HOOK_URL` to be set in Vercel env vars** — if it isn't, clicking Rebuild shows setup instructions instead of doing anything. Takes effect in ~2 minutes (a full redeploy), not instantly.
- This only affects the **fallback** shown before the live feed loads (or when it's down) — it has no effect on the live-feed data students see once that loads successfully.

---

## 19. Danger Zone

| Control | What it does |
|---|---|
| **Maintenance Mode** | Locks out every non-admin user with a static "Under Maintenance" screen ([App.jsx:1003](schedule-app/src/App.jsx#L1003)), the instant you Deploy Config to Cloud (well — the instant each user's browser re-checks config). Admins are exempt and keep full access. Use for planned downtime, not emergencies (there's no instant push — see §2). |
| **Force Global Refresh** ("Force Sync") | As covered in §2, this is functionally identical to Deploy Config to Cloud plus a confirmation dialog and an alert reassuring you it was "sent." It does not force anyone's browser to reload early. |

---

## 20. Deploy footer

**"Deploy Config to Cloud"** — the one button that actually commits everything (`announcement`, all `flags` including overrides/bans/toggles/hero strategy/update-prompt text) to the shared `system_config` Supabase row, and logs a `save_config` audit entry. Shows a success/failure message inline. **This is the button you must remember to click after every session of changes** — nothing above it is live until this fires.

---

## 21. Known gaps — read before relying on these

1. **Scheduled Announcements and Dynamic Quick Links are non-functional today.** Both save data to Supabase, but no code in the student-facing app reads `flags.scheduledAnnouncements` or `flags.quickLinks`. Building these tools yourself won't produce a visible banner or sidebar link — this needs a code fix (wiring `App.jsx` to read + render + date-filter these arrays) before they'll do anything.
2. **"Active Today" stat is fake** — a `count * 0.85` placeholder, not derived from any session/activity tracking.
3. **`abTests` flag has no implementation** — it's reserved so it doesn't clutter the auto-generated flag-checkbox list, but there's no A/B testing logic anywhere in the app yet.
4. **No confirmation on most destructive actions except Maintenance Mode's implicit risk and Force Sync's confirm dialog** — e.g. toggling a feature flag off, deleting an override, or removing a quick link/announcement happens immediately with no "are you sure." Double-check before clicking Trash icons.
5. **All admins share one config row** — there's no per-admin draft state. If two admins have the dashboard open simultaneously and both click Deploy, the second save silently overwrites the first admin's unsaved changes (last write wins, no conflict detection).

---

## Quick reference: what needs "Deploy Config to Cloud" vs. what's immediate

**Needs Deploy Config to Cloud:**
Class overrides (all 3 editors), Scheduled Announcements, Quick Links, Update Prompt Text, Feature Flags, Hero Backdrop Strategy, Maintenance Mode, banning/unbanning a user.

**Immediate (writes directly, no Deploy needed):**
Reset Setup (User X-Ray modal), Mark Resolved (Feedback), Backup Config to JSON (local file download only), Bundled Snapshot Rebuild (separate Vercel deploy hook, unrelated to `system_config`).

**Local to your session only (never saved anywhere):**
Time Machine, Impersonate User.
