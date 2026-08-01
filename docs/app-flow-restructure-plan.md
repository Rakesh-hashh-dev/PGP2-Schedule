# App Flow Restructure Plan — 5-Hub IA (both platforms)

> Status: **Proposed** — written 2026-07-28, no code yet. Awaiting decision on scope.
> This is an *information-architecture* plan (what lives where, how many destinations).
> For the *visual* sidebar restyle see [`sidebar-revamp-plan.md`](./sidebar-revamp-plan.md) — orthogonal, can layer on top.

---

## 1. Problem statement

The app has grown to **~14 top-level `view` destinations**, surfaced through **four parallel
navigation surfaces that expose different subsets**:

| Surface | Where | Notes |
|---------|-------|-------|
| Desktop sidebar | `App.jsx` ~L2174–2289 | Primary links + collapsible "Tools" group + Admin |
| Desktop top-tab strip | `App.jsx` ~L2619–2662 | A *different* subset from the sidebar |
| Mobile bottom dock (`bnav`) | liquid-glass lens dock | Primary only |
| Mobile top tabs + `⋯` overflow | `App.jsx` ~L2471–2582 | Own Tools / Prefs / About sub-sections |

Current `view` values:
`today`, `tomorrow`, `week`, `attendance`, `exams`, `assignments`, `notifications`
(labeled "Announcements"), `friends` (labeled "Social" / "Compare"), `board`, `fullSchedule`
(labeled "Timetable"), `split`, `leave`, `wrapped`, `admin` (+ `glance` peek, non-sticky).

### Two concrete symptoms

1. **Cross-device drift.** Sidebar and top-tabs are two hand-maintained JSX lists with
   overlapping-but-unequal contents. "Where is X" differs by device, and the lists drift as
   features are added.
2. **One concept, three sticky tabs.** `today` / `tomorrow` / `week` are all "your schedule."
   The code already bounces between them constantly (`setView("tomorrow")`, `setView("today")`
   in banners and summaries), which is the tell that they want to be *pivots within one view*,
   not separate destinations.

---

## 2. Target IA — 5 hubs

Collapse ~14 destinations into **5 stable hubs, identical on mobile and desktop.**

| Hub | Icon | Contains (sub-nav) | Absorbs current views |
|-----|------|--------------------|-----------------------|
| **Schedule** | Clock | Today (default) · Tomorrow · Week · Full timetable — as an in-view **date pivot**, not tabs | `today`, `tomorrow`, `week`, `fullSchedule` |
| **Academics** | GraduationCap | Segmented control: Attendance · Exams · Assignments | `attendance`, `exams`, `assignments` |
| **Social** | Users | Friends/Compare · Campus Board · Meetups | `friends`, `board` |
| **Inbox** | Bell | Unified announcements + all notification types (already one store) | `notifications` (+ bell dropdown) |
| **More** | MoreHorizontal | Split · Leave · Wrapped · Mess · Preferences · Admin | `split`, `leave`, `wrapped`, admin, prefs |

Result: **5-item bottom dock (mobile) and 5-group sidebar (desktop) render from ONE config** →
zero cross-device drift.

### Sub-navigation pattern per hub

- **Schedule** — segmented date pivot at top (`Today | Tomorrow | Week | Full`). Default = Today.
  Non-sticky pivots (matching how `glance` is already treated) — relaunch always reopens Today.
- **Academics** — a single segmented control (Attendance | Exams | Assignments). Gated by
  `enableAttendance` / `enableExams` flags exactly as today; hide segments that are off.
- **Social** — segmented (Friends | Board | Meetups), preserving the existing Beta badge on
  first open (`markBadgeSeen("social")`).
- **Inbox** — merges the bell dropdown and the `notifications` page into one home. Pick the
  full page as canonical; the bell icon opens it (or a lightweight peek that links into it).
- **More** — a simple list (iOS-Settings style), the natural home for the current overflow menu.

---

## 3. Single source of truth for nav

Replace the two hand-maintained JSX lists with **one array**, consumed by every surface.

```js
// nav.js — one definition, every surface renders from this
export const HUBS = [
  { key: "schedule",  label: "Schedule",  icon: Clock,          views: ["today","tomorrow","week","fullSchedule"] },
  { key: "academics", label: "Academics", icon: GraduationCap,  views: ["attendance","exams","assignments"] },
  { key: "social",    label: "Social",    icon: Users,          views: ["friends","board"] },
  { key: "inbox",     label: "Inbox",     icon: Bell,           views: ["notifications"] },
  { key: "more",      label: "More",      icon: MoreHorizontal, views: ["split","leave","wrapped","admin"] },
];
```

- Sidebar maps `HUBS` → `.sb-link` buttons.
- Bottom dock maps `HUBS` → `.bnav-btn` buttons (5 fixed slots — perfect for the lens indicator).
- Active hub = the hub whose `views` includes the current `view`.
- `IS_LITE` filters `HUBS[].views` through `LITE_VIEWS` (already the pattern) — a hub with no
  surviving views drops out automatically.

This alone kills symptom #1 even before any visual change.

---

## 4. Migration & compatibility

- **Keep `view` as the internal state key.** Hubs are a *presentation grouping over `view`* — no
  need to rename the 14 states or touch each view component. Deep links (`?view=split`),
  `VIEW_KEY` persistence, and the retired-view redirects (`courses→exams`, `insights→today`,
  `glance→today`) all keep working untouched.
- **Add a `hubForView(view)` helper** so the active-hub highlight is derived, not stored.
- **Deep links unchanged** — `?view=…&g=…&join=…` capture logic ([App.jsx](../schedule-app/src/App.jsx) ~L633–686)
  stays; it just lands inside a hub now.
- **Persistence:** store the last `view` as today (already done). Optionally also remember the
  last sub-view per hub so returning to Academics reopens the last-used segment.

---

## 5. Phasing (both platforms in lockstep)

| Phase | Deliverable | Risk | User-visible? |
|-------|-------------|------|---------------|
| **0** | Extract `HUBS`/`hubForView` config; render *existing* sidebar + dock from it (same items, same layout) | Low — pure refactor | No |
| **1** | Merge Today/Tomorrow/Week/Timetable into **Schedule** hub w/ date pivot | Medium — touches the biggest view | Yes (fewer tabs) |
| **2** | Collapse Attendance/Exams/Assignments into **Academics** segmented control | Low–Med | Yes |
| **3** | **Social** hub (Friends + Board + Meetups) and **Inbox** consolidation (page = bell home) | Med | Yes |
| **4** | **More** hub absorbs Split/Leave/Wrapped/Mess/Prefs/Admin; retire overflow `⋯` menu | Low | Yes |
| **5** | Remove dead top-tab strip / old sidebar JSX; polish lens dock for 5 fixed slots | Low | Minor |

Phase 0 is the highest-value / lowest-risk step and unblocks everything else. Ship it alone if
nothing else lands.

---

## 6. Open questions

1. **Inbox canonical home** — full page vs. keep the bell dropdown as the primary and make the
   page secondary? (Currently two doors to overlapping data.)
2. **Week in Schedule** — keep Week as a pivot, or promote the existing `WeekAgenda`/`WeekGlance`
   as the Schedule default on desktop (where there's room) while mobile defaults to Today?
3. **Admin placement** — inside **More**, or keep it a separate gated rail as today
   (`showAdminUI`)? Recommendation: More, with the shield toggle preserved.
4. **Lite edition** — confirm the 5-hub set degrades cleanly when `LITE_VIEWS` strips Social/
   Board/Split/etc. (Compare-only Social hub, no Board.)

---

## 7. Non-goals

- No renaming of `view` state values (compat).
- No backend / Supabase changes — this is presentation-layer only.
- Not coupled to the parked visual sidebar restyle; can ship before or after it.
