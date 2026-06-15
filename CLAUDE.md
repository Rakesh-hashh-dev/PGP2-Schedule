# CLAUDE.md — Live College Schedule App

This file is the build brief for Claude Code. Read it fully before scaffolding.
Goal: build a deployable web app that shows my IIM Sambalpur term timetable, reads
from a college Google Sheet, and is structured so change-alerts + a daily digest
can be added later.

## What I'm building (and why)

I open this app to answer one question fast: **what class is happening now, and what's next?**
That question is the hero of the UI — not a stats dashboard. Around it: today's
timeline with a live "now" line, a week agenda, and (later) push notifications when the
sheet changes.

A working reference implementation already exists in `src/ScheduleApp.jsx` (single file,
self-contained styling). Your job is to turn it into a clean, multi-file, deployable
Vite project and then wire live data. **Treat `src/ScheduleApp.jsx` as the source of
truth for look and behaviour** — match it; don't redesign it.

## Tech stack

- Vite + React 19 (my usual stack)
- `lucide-react` for icons
- `papaparse` for parsing the published-sheet CSV (live mode)
- Styling: the reference uses one self-contained CSS block (injected via a `<style>`
  tag). Port that CSS verbatim into `src/styles.css` to preserve the design exactly.
  Tailwind is optional and **not** required — do not rewrite the styles in Tailwind
  unless I ask, because it risks visual drift.
- Deploy target: Vercel (static SPA)

## Commands

```bash
npm create vite@latest schedule-app -- --template react
cd schedule-app
npm install lucide-react papaparse
npm run dev        # local
npm run build      # production build → dist/
```

## Target project structure

```
schedule-app/
  CLAUDE.md                 # this file
  index.html
  package.json
  vite.config.js
  public/
    manifest.webmanifest    # PWA (add in the PWA milestone)
  src/
    main.jsx
    App.jsx                 # top-level: state, section toggle, course filter, view switch
    components/
      Hero.jsx              # now / up-next / all-clear card
      Timeline.jsx          # today's sessions + live "now" line
      WeekAgenda.jsx        # day-by-day agenda with week navigation
      CoursePicker.jsx      # "My courses" multi-select chips
    data/
      schedule.js           # parsed SNAPSHOT of the sheet (provided) — seed + fallback
    lib/
      sheet.js              # live fetch + parse → returns the same shape as schedule.js
    styles.css              # ported from ScheduleApp.jsx
```

Split the reference component along the boundaries above; keep prop/state logic identical.

## Data

### Shape (every class record)

```js
{
  date: "2026-06-15",   // YYYY-MM-DD
  day: "Monday",
  section: "A" | "B" | "Single",
  slot: 0,               // 0..7 column index
  start: "14:30",        // 24h
  end: "16:00",
  type: "class" | "break" | "holiday" | "exam",
  code: "SAPM",          // "" for non-class
  session: "1",          // session number, may be ""
  name: "Security Analysis and Portfolio Management",
  faculty: "Prof. Saumya Guha Deb",
  room: "A01"
}
```

`src/data/schedule.js` (provided) exports `TERM`, `LEGEND`, and `CLASSES` (635 records,
term 15 Jun → 29 Aug 2026). Use it as the initial render + offline fallback. The live
feed (below) must produce the **exact same shape**.

### Source sheet layout (for the live parser)

One timetable tab:
- Columns: `Date | Day | Section | <8 time-slot columns>`
- The 8 slots map to fixed times (24h): `08:00–09:30, 10:00–11:30, 12:00–13:30,
  13:30–14:30 (lunch), 14:30–16:00, 16:30–18:00, 18:30–20:00, 20:30–22:00`.
- Each date occupies **3 rows**: Section A, Section B, Single Section. `Date` and `Day`
  appear only on the first row of each block — **forward-fill** them down.
- A cell holds a course code + session (`"SAPM-1"`), or a special token
  (`Term Registration`, `Lunch Break`, `END Term`, `SPM MID Term Exam`,
  `INTERNATIONAL YOGA DAY`, `Independence Day`, `Milad-un-Nabi…`, `BM 6 &7 Guest Session`),
  or is empty (free).
- `type` rules: contains "LUNCH" → break; YOGA/INDEPENDENCE/MILAD/HOLIDAY → holiday;
  EXAM/END TERM/REGISTRATION → exam; otherwise → class.

Two legend tables below the timetable map codes to details:
- Table 1: `S.no | Course Name | Course Code | Credits | Faculty | Section | CR Name | Email | Phone`
- Table 2: same, with a `Classroom` column (rooms like A01, A02).
Build `code → { name, credits, faculty[bySection], room[bySection] }`. Faculty is often
listed once on the section-A row; fall back A → Single → first available.

A student **roster** (roll no, email, name, section) sits at the bottom of the sheet.
**Never render or store the roster.** It is only used to know my section.

### My context

- I am **Section A** (roll `2025MBA278`).
- Default the section toggle to A; always merge in `Single Section` entries.
- The grid overlays A + B + all electives, so A + Single shows clashes. The **My courses**
  filter resolves this: I pick the courses I'm enrolled in and the rest are hidden.
  Default = all selected. Non-class entries (breaks/holidays/exams) ignore the filter.

### Live feed — pick one (keep `schedule.js` as fallback either way)

**Option A — Publish to web (no backend).** In the sheet: File → Share → Publish to web →
CSV → the timetable tab. Put the resulting URL in `lib/sheet.js`, fetch it, parse with
papaparse, and apply the parsing rules above to emit `CLASSES`. Simplest; makes that view
public.

**Option B — Apps Script (keeps the sheet private).** A bound Apps Script `doGet` reads
the sheet (runs as me), returns `{ TERM, LEGEND, CLASSES }` as JSON; the app fetches that
URL. This is also the script that will later diff snapshots and send change-alerts, so it
doubles as the notifications engine.

`lib/sheet.js` should export `async function fetchSchedule()` returning `{TERM, LEGEND,
CLASSES}`, try the live source, and fall back to `data/schedule.js` on any error.

## Feature spec (match the reference)

- **Header:** αβ logo, "Term Timetable / IIM Sambalpur · 15 Jun – 29 Aug", a Section A/B
  segmented toggle, and a sync button.
- **Live bar:** "Live · synced Xm ago" with a pulsing dot; "My courses · n/21" button that
  opens the picker.
- **Hero:** if a class is in session → show it with a progress bar + "N min left" + an
  "up next" line; else show the next upcoming class/exam; else "All clear". Times in
  monospace. Considers only `type` class|exam for now/next.
- **Today tab:** today's sessions as a timeline with a green "now" line at the real current
  time; breaks/holidays/exams shown but de-emphasized and badged.
- **Week tab:** day-by-day agenda (Mon–Sun) for the current week with ‹ prev / next ›
  navigation and a "This week" reset; today highlighted. (Agenda, not a grid — better on
  mobile.)
- **My courses picker:** chips for all 21 courses with All / None; filters class entries.

## Design system (tokens — already encoded in the reference CSS)

- Colours: ink `#15182B`, bone `#F3F1EA`, card `#FFFFFF`, hairline `#E4E0D5`,
  text `#1A1C2A`, muted `#6A6E7E`, live-green `#1FA971`, amber `#C9882B`, violet `#6D5BD0`.
- Type: display **Bricolage Grotesque**, body **Inter**, mono **JetBrains Mono**
  (Google Fonts). Time/room/session numerals are always monospace — the "departure board"
  signature.
- Quality floor: responsive to mobile, visible keyboard focus, `prefers-reduced-motion`
  respected. Single bold element (the live now-state); keep everything else quiet.

## Roadmap (build in this order)

1. **Scaffold** the Vite project and port the reference into the structure above; runs on
   the `schedule.js` snapshot.
2. **Live feed** via `lib/sheet.js` (Option A or B) with snapshot fallback.
3. **PWA**: add `manifest.webmanifest` + a service worker so it installs to the iPhone
   home screen (iOS 16.4+ supports installed-PWA web push, needed for step 5).
4. **Change-alerts engine** (Apps Script): on a timer, snapshot the sheet, diff against the
   last snapshot, and record human-readable changes ("Tue 14:30 SAPM moved to A02").
5. **Push**: daily digest + change alerts to my iPhone. Start with Pushover/ntfy
   (fastest), or Web Push to the installed PWA.

## Constraints

- Keep all student personal data (the roster) out of the app entirely.
- No secrets in the client. Published-CSV / Apps-Script URLs are fine to ship; never embed
  API keys or OAuth tokens in frontend code.
- Don't use `localStorage` patterns that break SSR/build; this is a static SPA, in-memory
  state is fine (persist the course selection later if wanted).

---

### Kickoff prompt (paste into Claude Code after dropping these files in a folder)

> Read CLAUDE.md. Scaffold the Vite + React project exactly as described, porting
> `src/ScheduleApp.jsx` into the component structure and `src/styles.css` without changing
> the design. Wire it to render from `src/data/schedule.js` first and run `npm run dev`.
> Then implement `lib/sheet.js` using Option A (published CSV) with the snapshot as
> fallback. Stop after the app runs locally so I can review before we add PWA + push.
