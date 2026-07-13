# Mess Menu Module — Analysis & Design Report

**Project:** PGP2 Schedule (TermFlow) · `schedule-app/`
**Date:** 2026-07-13 · **Status:** PLANNING — awaiting approval, no code changes made

---

## 1. Architecture Analysis (Phase 1)

### 1.1 Current application architecture

| Layer | What's actually there |
|---|---|
| Frontend | Vite 8 + React 19, **plain JSX (no TypeScript)**, PWA via `vite-plugin-pwa`, deployed on Vercel |
| Auth | Clerk (`@clerk/clerk-react`, headless variant). Admin = hardcoded `ADMIN_EMAILS` allowlist in `App.jsx` |
| Backend | Supabase: Postgres + Realtime + Edge Functions (`class-reminders`, `send-push`, `get-metrics`, `migrate-user`, `sync-map`). **No custom REST server.** |
| Schedule data | *Not* in the DB — a Google Apps Script feed (`src/lib/sheet.js`) reads the institute's timetable Sheet, with a bundled static snapshot (`src/data/schedule.js`, regenerated at build by `scripts/generate-snapshot.mjs`) and a localStorage cache as fallbacks |
| Observability | Sentry (lazy, errors-only), Vercel Analytics |

### 1.2 Routing structure
There is **no router**. Navigation is a single `view` string state in `App.jsx` (`"today" | "tomorrow" | "week" | "attendance" | "exams" | "assignments" | "notifications" | "friends" | "fullSchedule" | "admin"`), persisted to `localStorage["pgp2.last-view"]`. Each view is a lazy-loaded panel component rendered by a ternary chain in `App.jsx` (~line 2245–2367). A new "page" = new lazy component + a `view` value + nav entries.

### 1.3 Existing navigation
- **Desktop sidebar** (`sb-nav`): grouped links — *Schedule* (Today, Tomorrow), *Track* (Attendance, Exams, Assignments), *Campus* (Announcements, Social), plus Quick Links, a live "Now/Next" card, and an *Admin* group. Collapsible, two visual styles (classic/aurora).
- **Mobile**: liquid-glass bottom dock (`bnav`, sliding lens indicator, scroll-recede) and/or a top tab strip — user-selectable (`pgp2.mobile-nav`).
- **Command palette** (⌘K): `CommandPalette.jsx` for students, `AdminCommandPalette.jsx` for admins.

### 1.4 Dashboard layout ("Today" view)
`Hero` (current/next class, live countdown, attendance quick-mark) → `SemSummary` stat chips → today's change alert → `Timeline` (class rail). Right `aside` holds `WeekAgenda`. Mobile shows the same column single-width. Skeletons use `.premium-skeleton`; empty state uses `.cva-card.soft`.

### 1.5 Admin module
`AdminDashboard.jsx` (2,141 lines) — one page of stacked `admin-card` sections: DB health, Live Schedule Editor, Cancellation Board, Class Editor, Bulk CSV Importer, Analytics, A/B testing, Scheduled Announcements, Quick Links, Push Notifications (broadcast + schedule), What's New, User Directory + impersonation, Feedback triage, Feature Flags, Time Machine, Sync Logs, Audit Logs, Danger Zone. All admin actions log via `logAdminAudit` → `admin_audit_logs`. Most admin config persists into a single row: `system_config` (id `"global"`, `flags` JSONB).

### 1.6 Database structure (Supabase tables in use)
`profiles` (user JSON blob: courses + `_assignments`, `_name`, `_email`, read-state keys), `attendance`, `friend_pings`, `share_codes`, `push_subscriptions`, `push_prefs`, `system_config`, `feedback`, `admin_audit_logs`, `reminder_log`, `schedule_cache`, `_migration_map`. Pattern: heavy JSONB, localStorage-first with cloud sync, Realtime subscriptions on `profiles` and `friend_pings`.

### 1.7 Design system
- Tokens in `src/styles.css` `:root` — warm ivory light theme + `html[data-theme="dark"]` dark theme (system/light/dark picker). Accents: `--violet`, `--live` (green), `--amber`, `--blue`, `--danger`, each with `-dim` tint.
- Fonts: Bricolage Grotesque (display), Inter (body), JetBrains Mono.
- Icons: `lucide-react` only.
- Motion: CSS keyframes + `--ease-out-strong` cubic-beziers (framer-motion was deliberately removed for perf).
- Per-feature stylesheets in `src/styles/` (`admin.css`, `exams.css`, `friends.css`, …) imported by the owning component.

### 1.8 Component library
No external UI kit. House patterns: `cva-card` (soft cards), stat chips, `ses` subject pills (`subjectColors.js`), `nav-badge`/`beta-badge`, `fs-modal-*` (overlay modals), `premium-skeleton`, `TermFlowLoader`, toasts via local state + timeout. `ui.jsx` has small shared primitives.

### 1.9 State management
No Redux/Zustand/React Query. `App.jsx` owns global state via `useState` + prop drilling; per-panel state lives in the panel. Persistence: localStorage first, Supabase sync in background, Realtime for push-style updates. Polling: schedule feed every 10 min, pings every 30 s, re-sync on tab-visibility.

### 1.10 Existing API architecture
Two flavors: (a) direct `supabase.from(...)` client calls guarded by RLS, (b) Deno Edge Functions for privileged work (push send, metrics with `x-admin-key`). Plus the external Google Apps Script feed for schedule JSON. There is **no** Express/Next API layer.

### 1.11 Existing upload functionality
**None.** No Supabase Storage usage anywhere in the codebase. The Bulk CSV Importer in admin is a *textarea paste*, not a file upload. The Mess Menu upload pipeline (file → storage → parse → preview → activate) is entirely new infrastructure — but it fits the existing Edge Function + Supabase pattern cleanly.

### 1.12 Where the Mess Menu fits — recommendation

**Combination**, mirroring how every successful feature in this app already ships:

1. **Separate navigation item** — "Mess Menu" under the sidebar *Campus* group (with Announcements/Social), a bottom-dock icon (`UtensilsCrossed`), and a command-palette entry. Reason: it's a destination students will open on its own several times a day; burying it inside another page adds taps.
2. **Dashboard widget** — a compact "Today's Meals" card on the Today view, below `SemSummary`, current-meal-aware. Reason: the Today view is the app's home screen; the single most common question ("what's for lunch?") should be answered with **zero taps** after opening the app.
3. **Feature-flagged** — `flags.enableMess` in `system_config`, exactly like `enableExams`/`enableAttendance`, so it can soft-launch and be killed remotely.
4. **Admin card** — a "Mess Menu" section inside `AdminDashboard`, consistent with every other admin tool (no separate admin route exists in this app).

Not chosen: a "Dining section" super-page (over-engineering for one mess), or widget-only (no way to see tomorrow/other days).

---

## 2. UX Plan (Phase 2)

### 2.1 Dashboard widget — `MessWidget`

Sits on the Today view, below `SemSummary`. Time-aware: it leads with the meal that matters *right now*.

```
┌──────────────────────────────────────────────┐
│ 🍽  MESS · LUNCH  ● Serving now · ends 2:30  │   ← header row: meal chip + live dot
│                                               │      (reuses sb-now-chip/pulse pattern)
│  Rice · Dal Tadka · Paneer Butter Masala ·    │   ← items as one comfortable line,
│  Salad · Curd                                 │      wraps to max 2 lines, then "+3 more"
│                                               │
│  Next: Snacks 5:00 PM — Samosa, Tea      →   │   ← next-meal teaser + chevron
└──────────────────────────────────────────────┘
```

- Whole card is a button → opens the Mess Menu page scrolled to the current meal.
- States: **Serving now** (green `--live` pulse dot), **Up next in 40m** (amber), **Kitchen closed — next: Breakfast 7:30 AM** (muted), **Special dinner tonight ✦** (violet badge), **No active menu** → widget hides entirely (never show an empty shell on the dashboard).
- Animation: entrance uses the existing CSS fade/slide keyframe stack; the "Serving now" dot reuses the existing `.pulse`; meal transitions cross-fade items (opacity+4px translate, 250ms `--ease-out-strong`). No new animation library.

### 2.2 Full Menu screen — `MessMenuPage`

Mobile-first single column; desktop gets a 7-day grid option.

```
┌────────────────────────────────────────────────┐
│  Mess Menu                       [Week ▾] [⤓]  │  ← sticky header
│  ┌────────────────────────────────────────┐    │
│  │ Mon  Tue  WED  Thu  Fri  Sat  Sun      │    │  ← DayTabs (scrollable pills,
│  └────────────────────────────────────────┘    │     today ringed, swipe L/R on body)
│   Today · Wed, 15 Jul          [Today][Tmrw]   │  ← shortcuts (hidden when on today)
│                                                 │
│  ── PAST ──────────────────────────────────    │
│  ☀ Breakfast · 7:30–9:30            (dimmed)   │
│     Idli · Sambar · Chutney · Tea               │
│                                                 │
│  ── NOW ● ─────────────────────────────────    │
│  🍛 Lunch · 12:30–2:30      ● Serving · 47m    │  ← current meal: violet ring,
│     Rice · Dal Tadka · Paneer · Salad · Curd    │     progress hairline, auto-scrolled
│                                                 │     into view on open
│  ── UPCOMING ──────────────────────────────    │
│  ☕ Snacks · 5:00–6:00           in 2h 30m     │
│     Samosa · Tea · Coffee                       │
│                                                 │
│  🌙 Dinner · 7:30–9:30        ✦ Special        │  ← special meals: amber card wash
│     Veg Biryani · Raita · Gulab Jamun           │     + ✦ badge (Announcements pattern)
└────────────────────────────────────────────────┘
```

Decisions:
- **Day selector**: pill tabs (Mon–Sun) — the menu is weekly-cyclic within a version, so a 7-day selector is the natural model; no calendar picker needed (a date only matters when a version boundary or holiday override falls inside the week — those render as an inline banner: "New menu starts Mon, 21 Jul").
- **Today / Tomorrow shortcuts**: one tap each; page always opens on Today with the current meal centered — the two most common intents cost 0 and 1 taps.
- **Swipe** between days on mobile (same pointer-tracking approach as the bottom dock; CSS scroll-snap on a horizontal day-pane strip — no library).
- **Meal states**: past = dimmed (55% opacity), current = ring + live dot + "ends in Xm", upcoming = normal + "in Xh Ym". Uses existing timeline conventions so students already know the language.
- **Sticky**: header + day tabs stick; meal-section labels are plain (page is short; sticky meal headers are noise).
- **Search**: *omitted* in v1 — searching a 4-meal day is slower than reading it. A "find item across the week" search can ship later if favourites data shows demand.
- **Empty state**: friendly `cva-card` — "No menu published yet. The mess menu appears here as soon as the admin uploads the new sheet."
- **Loading**: 3 `premium-skeleton` meal cards.
- **Desktop (≥900px)**: same column centered at ~720px, with a "Full week" toggle rendering a 7×4 grid (days × meals) for people who plan.
- **Accessibility**: day tabs are `role="tablist"`, meal cards are landmarks with `aria-current` on the live meal, all color states have text equivalents ("Serving now"), dark mode via existing tokens, respects `prefers-reduced-motion`.

### 2.3 Mobile UX specifics
- Bottom-dock icon → page opens at today+current meal: the "what's for lunch" journey is **1 tap**.
- Tap targets ≥44px; day pills horizontally scrollable with snap.
- Offline: last synced menu served from localStorage cache (same pattern as the schedule feed cache) with an "offline · cached" chip.
- PWA: menu JSON is small (<10KB); cache it in the profile-sync fetch so it's fresh whenever the app opens.

---

## 3. Admin Experience (Phase 3)

New **Mess Menu** `admin-card` in `AdminDashboard` (plus an AdminCommandPalette action "Upload mess menu").

```
┌─ 🍽 Mess Menu ─────────────────────────────────────────────┐
│                                                             │
│  ACTIVE MENU                                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ v7 · "Jul 14 – Aug 10" · effective 14 Jul              │ │
│  │ Uploaded by Rakesh · 12 Jul, 9:41 PM · Excel · AI-assist│ │
│  │ 28 meals · 214 items      [Preview] [Download source]  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [⬆ Upload new menu sheet]        (xlsx · csv · pdf · image)│
│                                                             │
│  VERSION HISTORY                                            │
│  v6 · 16 Jun–13 Jul · archived   [Preview] [Rollback] [🗑]  │
│  v5 · 19 May–15 Jun · archived   [Preview] [Rollback] [🗑]  │
└─────────────────────────────────────────────────────────────┘
```

**Upload flow (the every-3-4-weeks ritual — target < 2 minutes):**

1. **Pick file** — drag-drop / file picker (`.xlsx .csv .pdf .png .jpg`, ≤10 MB). Instant client-side type/size validation.
2. **Parse** — file → Supabase Storage → `parse-mess-menu` Edge Function → structured draft. Progress states: *Uploading → Reading sheet → Extracting meals → Ready to review*.
3. **Preview** — editable 7-day × 4-meal grid in an `fs-modal`. Per-cell confidence: parsed-clean (normal), AI-guessed (amber dot — "check this"), empty (red outline). Admin can click any cell to fix items inline, toggle "special", add notes. Set **effective date** (default: next Monday) and optional label.
4. **Validation** — blocking errors (no days detected, zero items, effective date collides with an existing active range) shown as a red error list; warnings (missing Sunday dinner, duplicate day) shown amber but publishable.
5. **Publish** — "Replace current menu" confirm dialog → new version becomes `active`, previous flips to `archived` (never deleted). Optional checkbox: "Notify students (push: *New mess menu is live 🍽*)". Action logged to `admin_audit_logs`.

**Rollback**: one click on an archived version → confirm → it becomes active again (the version rows are immutable; only `status`/date pointers change). **Delete**: soft delete (`deleted_at`), hidden from history, blocked for the active version. Parse failure never leaves partial state — drafts are separate rows until published.

---

## 4. Upload & Parsing Architecture (Phases 4 + 6)

### 4.1 Recommended pipeline

```
Admin browser
  └─ file → Supabase Storage (bucket: mess-menus, admin-only RLS)
  └─ POST /functions/v1/parse-mess-menu  { file_path, file_type }
        ├─ .xlsx → SheetJS (deterministic grid extraction)
        ├─ .csv  → header-mapped deterministic parser
        ├─ grid → normalizer (day/meal detection, item splitting, cleanup)
        ├─ confidence < threshold OR pdf/image → Claude API (structured output)
        └─ returns { draft_version, meals[], warnings[], errors[], per-cell confidence }
Admin previews/edits → POST /functions/v1/publish-mess-menu → version activated
```

### 4.2 The four format questions

- **Should Excel parsing be preferred?** **Yes.** If the institute publishes `.xlsx`, deterministic parsing (SheetJS in the Edge Function) is free, instant, testable, and exact. The parser: finds the day header row/column (fuzzy match Mon/Monday/MON), finds meal headers (Breakfast/Lunch/Snacks/Evening Tea/Dinner + synonyms), handles both orientations (days-as-columns and days-as-rows), splits cell text into items on `, / \n •`, trims, title-cases, dedupes.
- **Should OCR be used?** Not as a separate Tesseract step. For images/PDF-scans, a vision-capable LLM **is** the OCR *and* the table-structure extractor in one call — separate OCR → text → re-parse loses the table geometry and is strictly worse.
- **Should AI parsing be used?** **Yes, as the fallback tier and for PDF/images** — one Claude API call (`claude-sonnet-5`, Messages API with a strict JSON schema via tool-use/structured output) from the Edge Function, temperature 0. Justification: this runs ~13×/year, admin-initiated, always behind a human preview — cost is cents/year, and it makes *any* format the mess office invents "just work". Mark AI output `parser: "ai"` and surface low-confidence cells in the preview.
- **Malformed sheets?** Escalation ladder: deterministic parse → deterministic fails/low-confidence → AI parse of the raw grid → AI fails → validation error panel with specific messages ("Couldn't find day names — expected Monday–Sunday in a header row") + a "Fill manually" escape hatch (empty editable preview grid). The admin preview is the universal safety net; **nothing reaches students without human confirmation.**

### 4.3 Normalized output (contract between parser, preview, and DB)

```json
{
  "days": [{
    "day": 1,
    "meals": [{
      "meal": "breakfast",
      "items": ["Idli", "Sambar", "Coconut Chutney", "Tea"],
      "is_special": false, "note": null, "confidence": 0.98
    }]
  }],
  "warnings": ["Sunday dinner cell was empty"],
  "errors": []
}
```

---

## 5. Database Design (Phase 5)

One migration: `supabase/migrations/2026xxxx_mess_menu.sql`.

```sql
create table mess_menu_versions (
  id             uuid primary key default gen_random_uuid(),
  label          text,                        -- "Jul 14 – Aug 10"
  effective_from date not null,
  effective_to   date,                        -- null = open-ended
  status         text not null default 'draft'
                 check (status in ('draft','active','archived')),
  source_path    text,                        -- storage path of original file
  source_type    text,                        -- xlsx | csv | pdf | image | manual
  parser         text,                        -- deterministic | ai | manual
  parse_meta     jsonb default '{}'::jsonb,   -- warnings, confidence, model used
  created_by     text not null,               -- clerk user id
  created_by_email text,
  uploaded_at    timestamptz not null default now(),
  activated_at   timestamptz,
  deleted_at     timestamptz                  -- soft delete
);
create unique index one_active_menu on mess_menu_versions (status)
  where status = 'active' and deleted_at is null;

create table mess_menu_meals (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references mess_menu_versions(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Monday
  meal        text not null check (meal in ('breakfast','lunch','snacks','dinner')),
  items       text[] not null default '{}',
  is_special  boolean not null default false,
  note        text,
  unique (version_id, day_of_week, meal)
);

-- Date-specific exceptions: holidays, festival specials, mess closed
create table mess_menu_overrides (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  meal       text check (meal in ('breakfast','lunch','snacks','dinner')), -- null = whole day
  kind       text not null check (kind in ('closed','special','replace')),
  items      text[],
  note       text,               -- "Holi special dinner", "Mess closed for Diwali"
  created_by text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (date, meal)
);
```

- **Versioning/rollback**: version rows are immutable after publish; activate/rollback/replace only flip `status` (+ close/open `effective_to`) inside one `activate_mess_menu(version_id)` RPC (`security definer`, transactional — the partial unique index makes a double-active state impossible).
- **Meal timings** live in `system_config.flags.messTimings` (`{breakfast: ["07:30","09:30"], …}`) — admin-editable without a migration, consistent with existing config style.
- **RLS**: `select` for authenticated users on all three tables (`deleted_at is null`, students only see `active` versions or overrides); all writes via Edge Functions using the service role after verifying the caller's Clerk email against the admin list (same trust model as `get-metrics`' admin key; JWT check preferred).
- **Storage**: private `mess-menus` bucket; originals kept for audit/re-parse/download.

## 6. API Design (Phase 8)

The app's "API" = Supabase client reads + Edge Functions for privileged writes. REST-shaped map:

**Student (direct Supabase reads, RLS-guarded)**
| Intent | Implementation |
|---|---|
| GET active menu (all 7 days) | `mess_menu_versions` where `status=active` + its `mess_menu_meals` (one joined query, cached in localStorage `pgp2.mess-menu`) |
| GET overrides for the visible window | `mess_menu_overrides` where `date between today-1 and today+7` |
| Realtime menu swap | existing Realtime channel pattern on `mess_menu_versions` (UPDATE where status→active) — students see the new menu without reload |

**Admin (Edge Functions, service-role)**
| Endpoint | Purpose |
|---|---|
| `POST /functions/v1/parse-mess-menu` | body `{path, type}` → parse (deterministic→AI ladder) → create `draft` version + meals → return draft + warnings/errors/confidence |
| `POST /functions/v1/publish-mess-menu` | `{version_id, effective_from, label, meals(edited), notify}` → upsert edited meals, call `activate_mess_menu`, optionally fan out via existing `send-push`, audit-log |
| `POST /functions/v1/publish-mess-menu` with `{action:"rollback", version_id}` | re-activate an archived version |
| Soft delete / overrides CRUD | direct Supabase writes from AdminDashboard with admin RLS (matches how `system_config` is managed today), all audit-logged |

Validation lives inside `parse-mess-menu` (structure) and `publish-mess-menu` (dates, ≥1 non-empty meal, active-collision) — errors return `400` with a `errors[]` list the preview modal renders.

---

## 7. Student Features (Phase 7)

**v1 (ship with the module):**
- Today's menu widget (current-meal-aware) + full week page with Today/Tomorrow shortcuts
- **Current meal highlight + "ends in Xm"** and **next meal countdown** (reuses the Hero's minute-tick clock)
- **Special meal badge** (✦ amber wash) from `is_special`/overrides
- **Mess closed indicator** (override `kind=closed` → struck-through day with note)
- **Offline cache** (localStorage, PWA — same as schedule feed)
- **Push on new menu** (optional admin checkbox → existing `send-push`)
- Command-palette entries: "Mess menu", "What's for lunch?"

**v1.1 (fast follows):**
- **Special-dinner push** the afternoon of a special meal (extend `class-reminders` cron — it already runs on schedule and has `push_prefs`/`reminder_log` plumbing)
- **Favourite items** (`profiles.courses._favMeals` array, matching `_assignments` precedent) → "⭐ Chicken Biryani on Thursday!" surfacing in the widget + optional push
- **Download menu** (client-generated image/PDF of the week — shareable to WhatsApp, where menus circulate anyway)

**Later / only if used:** meal ratings, week-at-a-glance sharing card, meal reminder ("remind me at snacks"), festival menu gallery. Explicitly *not* building: calorie tracking, multi-mess support (single campus mess).

---

## 8. UI Components (Phase 9)

**Student** (new dir `src/components/mess/`, styles in `src/styles/mess.css`)
- `MessWidget` — dashboard card (current meal, next teaser, states)
- `MessMenuPage` — lazy view: header, DayTabs, swipe pane, meal list
- `DayTabs` — Mon–Sun pills, today ring, scroll-snap
- `MealCard` — icon, name, timing, items, state (past/now/upcoming), special wash
- `CurrentMealChip` — live dot + countdown (shared by widget & page)
- `MenuEmptyState`, `MessSkeleton` (3-card loader), `OverrideBanner` (closed/special/new-menu-starts)

**Admin** (inside AdminDashboard section)
- `MessAdminCard` — active version, upload button, history list
- `MenuUploadModal` — dropzone → progress → preview (state machine)
- `MenuPreviewGrid` — editable 7×4 grid, confidence dots, cell editor
- `ValidationErrorList`, `VersionHistoryRow` (status chip, Preview/Rollback/Delete), `EffectiveDatePicker`

**Shared/lib**
- `src/lib/mess.js` — fetch+cache, `getCurrentMeal(now, timings)`, `getNextMeal`, override resolution, day/date math
- Edge Functions: `supabase/functions/parse-mess-menu/`, `publish-mess-menu/`
- Icons (lucide, existing dep): `UtensilsCrossed`, `Coffee`, `Soup`, `Cookie`, `Moon`, `Sparkles`

## 9. Implementation Roadmap (Phase 10)

| Phase | Scope | Est. |
|---|---|---|
| **1. Database** | Migration (3 tables + RPC + RLS + storage bucket), seed one version manually for dev | 0.5 d |
| **2. Parser** | `parse-mess-menu` fn: xlsx/csv deterministic + Claude fallback for pdf/image; fixture tests with real institute sheets | 1–1.5 d |
| **3. Admin upload** | MessAdminCard + upload modal + preview grid + publish/rollback/delete + audit logs + palette action | 1.5 d |
| **4. Student UI** | `mess.js` lib + MessMenuPage + nav (sidebar/dock/palette) + flag `enableMess` | 1.5 d |
| **5. Dashboard widget** | MessWidget on Today view + current-meal logic + animations | 0.5 d |
| **6. Notifications** | Publish push + special-dinner reminder via `class-reminders` | 0.5 d |
| **7. Testing & polish** | Real-sheet parse tests, timezone checks, dark-mode/contrast audit, a11y pass, Lighthouse, soft-launch behind flag | 1 d |

Total ≈ 6–7 focused days. Each phase is independently shippable behind the flag.

## 10. Edge Cases (Phase 11)

| Case | Handling |
|---|---|
| No active menu | Widget hidden; page shows friendly empty state; nav item still visible |
| Duplicate upload (same file/dates) | Warn "identical to v7 — publish anyway?" (hash compare of parsed content) |
| Wrong/missing columns | Deterministic parser fails → AI attempt → specific validation errors → manual-fill escape hatch |
| Missing meals (e.g. Sunday snacks) | Warning, publishable; card renders "Not published" muted state |
| Holiday / mess closed | `mess_menu_overrides kind=closed`; widget/page show closed banner with note |
| Corrupted PDF / unreadable image | Parse fn returns typed error ("Couldn't read this file — try the Excel version"); nothing persisted beyond the draft |
| OCR/AI failure or garbage output | JSON-schema-validated response; fails validation → error panel; human preview is the final gate |
| Large file | Client-side 10 MB cap before upload; Edge Function timeout guard |
| Timezone | All "current meal"/day math in IST using the app's existing local-time convention (`ymd()` helpers); dates stored as `date`, not timestamps |
| Version boundary mid-week | Page resolves menu *by date* → version whose `effective_from/to` covers it; inline "New menu starts Mon" banner |
| Rollback failure / race | Single transactional RPC + partial unique index → double-active impossible; failed RPC leaves previous state intact |
| Invalid effective date (past / overlaps) | Publish validation error; overlap auto-closes previous version's `effective_to` after explicit confirm |
| Two admins editing simultaneously | Last-publish-wins + audit trail; drafts are per-admin rows |
| Offline student | Cached last menu + "cached" chip; stale-while-revalidate on reconnect |
| Menu changes mid-cycle (mess office corrections) | Re-upload → new version effective immediately; or edit a single day via overrides |

## 11. Codebase Integration Map (Phase 12)

**New files**
```
supabase/migrations/2026xxxx_mess_menu.sql
supabase/functions/parse-mess-menu/index.ts
supabase/functions/publish-mess-menu/index.ts
src/lib/mess.js
src/styles/mess.css
src/components/mess/MessMenuPage.jsx      (lazy view)
src/components/mess/MessWidget.jsx
src/components/mess/DayTabs.jsx
src/components/mess/MealCard.jsx
src/components/mess/admin/MessAdminCard.jsx
src/components/mess/admin/MenuUploadModal.jsx
src/components/mess/admin/MenuPreviewGrid.jsx
```

**Modified files**
| File | Change |
|---|---|
| `src/App.jsx` | `view === "mess"` branch (lazy `MessMenuPage`); sidebar link under *Campus*; bottom-dock button; `MessWidget` on Today view; `enableMess` flag read; mess menu fetch alongside the existing profile-sync `Promise.all` |
| `src/components/AdminDashboard.jsx` | Mount `<MessAdminCard/>` section; add `enableMess` to the Feature Flags card |
| `src/components/CommandPalette.jsx` / `AdminCommandPalette.jsx` | "Mess menu" nav action / "Upload mess menu" action |
| `src/components/Hero.jsx` | *(optional, v1.1)* tiny "🍽 Lunch now" chip when a meal is live |
| `supabase/functions/class-reminders/index.ts` | *(v1.1)* special-dinner reminder branch |

**Notes on constraints:** the codebase is JS/JSX — "fully typed" will be delivered as JSDoc typedefs in `src/lib/mess.js` + typed Deno Edge Functions (TS), matching existing conventions rather than introducing TypeScript into the React app. Parser needs `ANTHROPIC_API_KEY` as a Supabase function secret; deterministic path needs no secrets.

---

## 12. Open Questions (need your input before Phase 13)

1. **A sample of the actual mess menu sheet** (xlsx/pdf/photo) — the deterministic parser will be built and tested against the real format. This is the single highest-leverage input.
2. Meal names/timings: is it Breakfast / Lunch / Evening Snacks / Dinner, and what are the serving windows?
3. Veg/Non-veg distinction on the sheet — worth modeling as an item tag in v1?
4. OK to add `ANTHROPIC_API_KEY` as a Supabase Edge Function secret for the AI-parse fallback?

**Awaiting approval. No code has been modified.**
