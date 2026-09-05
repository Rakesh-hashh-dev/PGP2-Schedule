# Desktop sidebar revamp — plan

**Date:** 2026-09-05
**Scope agreed with the user:** nav structure & grouping + code refactor. Look-and-feel *evolves* the current design — keep the dark purple identity and overall shape, no new visual language. Footer/profile block (avatar, util strip, sync note, popover, Classic/Aurora picker) is **out of scope**.
**Not in scope, deliberately:** the 5-hub app-flow restructure (dropped, do not revive); the light/dark token pass (see "Deferred" below); mobile bottom nav and the `⋯` overflow sheet.

**Status: implemented 2026-09-05 — see §9 for what actually shipped and what was dropped.**

---

## 1. What's there now

| Piece | Where |
|---|---|
| Component | `src/components/DesktopSidebar.jsx` — 211 lines, pure presentation behind 30 props |
| Nav config | `TOOLS_VIEWS` + `TOOLS_VIEW_META`, `src/App.jsx:83-91` |
| State | `src/hooks/useSidebar.js` (`sbCollapsed`, `sbStyle`, `sbToolsOpen`, `showSbTip`/`hideSbTip`) |
| Recents | `recentToolViews`, `src/App.jsx:350-360`, persisted at `pgp2.recent-tools` |
| Render-props | `renderSbAvatarWrap` / `renderSbUtilStrip`, `src/App.jsx:2148-2229` |
| CSS | `src/styles.css` — main block ~9203-11xxx, aurora skin 16201-16435, plus 7 scattered rules (211, 410-460, 504, 1337, 4423, 5877) |

Current nav, top to bottom: Search · **Schedule** (Today, Tomorrow) · **Track** (Attendance, Exams, Assignments) · **Campus** (Announcements, Social, Campus Board) · **Recent** · **Tools ▾** (Full timetable, Add to Calendar, Mess menu, Split, Companion, Leave planner, Term Wrapped) · Quick Links · Admin. Up to **17 entries under 5 group labels**.

---

## 2. Findings that drive the plan

These came out of reading the component, the hook and the CSS. Each one is a concrete defect, not a taste call.

**F1 — The "Recent" group is dead code on desktop.**
`useSidebar.js:157` sets `sbToolsOpen` to `true`, but the comment directly above it says "collapsed by default", and `recentToolViews` exists (per its own comment at `App.jsx:346-349`) *only* to compensate for Tools being collapsed. Since `showSbTools = sbCollapsed || sbToolsOpen || viewIsTool` and `sbToolsOpen` is always initially true and is never persisted, the desktop Recent block at `DesktopSidebar.jsx:105-117` can only ever render after the user manually collapses Tools. In practice: never. The mobile `⋯` sheet uses `toolsSecOpen`, which *does* default to `false`, so Recent works there — the two have silently diverged.

**F2 — "Tools" is a junk drawer of three different kinds of thing.**
Five of its seven entries navigate (`setView`), two open modals (`Add to Calendar`, `Mess menu`) while wearing the identical `.sb-link` costume. A user cannot tell from the row whether it will change the page or throw a dialog. And Full timetable — arguably the single most-used page after Today — is buried in it.

**F3 — "Add to Calendar" is in the sidebar twice**, as a Tools row (`:127`) and as a util-strip button (`App.jsx:2208`), both calling `openCalendarExport()`.

**F4 — `.sb-now-*` is entirely dead CSS.** 45 rules spread over `styles.css` 9820-9964, 12690-12900 and 16425-16431 (a "now playing / next class" sidebar card, three visual states, keyframes, an aurora variant). No JSX anywhere in `src/` renders any of it.

**F5 — 20 copies of the same handler triple.** Every link repeats `onMouseEnter={e => showSbTip(e, "X")} onMouseLeave={hideSbTip}` plus a body of `setView(v); setCompareTarget(null); [markBadgeSeen(k);] hideSbTip();`. 17 hand-written 4-line blocks, all structurally identical.

**F6 — The offline banner is 11 inline style properties** (`:52`), including a `sbCollapsed` ternary that duplicates in JS what the ~20 `.sidebar.collapsed .x` CSS rules already do declaratively.

---

## 3. Proposed nav structure

Goal: every group answers "what kind of thing is this", nothing appears twice, and nothing routine is behind a disclosure.

```
  Search                        ⌘K

  SCHEDULE
    Today
    Tomorrow
    Full timetable              ← promoted out of Tools (F2)

  TRACK
    Attendance
    Exams
    Assignments

  CAMPUS
    Announcements
    Social
    Campus Board
    Mess menu                   ← moved from Tools; campus life, not a tool

  MORE ▾                        ← renamed from "Tools"
    Split
    Leave planner
    Companion
    Term Wrapped

  QUICK LINKS
    …user's links

  ADMIN
    Admin Tools
```

Changes and why:

1. **Full timetable → Schedule.** It is a schedule view; it was only in Tools because Tools was where the overflow went.
2. **Mess menu → Campus.** Same reasoning. It stays a modal for now (see decision D2).
3. **Add to Calendar leaves the nav entirely** (F3). It survives in the util strip, where an action-that-opens-a-dialog belongs.
4. **Tools → "More", now 4 genuinely occasional items.** The label stops implying these are a coherent toolkit.
5. **Recent is deleted from the desktop sidebar** (F1). With More holding only 4 items and the two frequently-wanted things promoted out, the shortcut it provided no longer has anything to shortcut. `recentToolViews` state and the `pgp2.recent-tools` key **stay** — the mobile sheet still uses them and they work correctly there.
6. **`sbToolsOpen` default flips to `false`,** matching its own comment and matching mobile — but now it hides only 4 rarely-used rows instead of 7 mixed ones. Visible count drops from 17 to **11 + quick links + admin**.

**Explicitly unchanged:** every `className`, so the ~20 `.sidebar.collapsed .*` rules and the whole aurora skin keep working untouched. No item is removed from the app; the only thing a user loses is a duplicate.

---

## 4. Code refactor

### 4.1 `src/lib/navItems.js` — a declarative nav config

Replaces `TOOLS_VIEWS` / `TOOLS_VIEW_META` and the 17 hand-written blocks. Shape:

```js
{ id, group, label, icon, view?, action?, badgeKey?, gate?, tip? }
```

- `view` → a navigating row; `action` → a dialog-opening row (mutually exclusive; a test enforces it). This is what makes F2 fixable in the UI later without touching structure again.
- `gate` names the flag (`enableAttendance`, `enableExams`, `enableFriends`, `companionEnabled`, `wrappedActive`) rather than hard-coding conditionals in JSX.
- `badgeKey` feeds the existing `showBadge` / `markBadgeSeen` pair.
- Shaped so the **mobile `⋯` sheet can consume the same array later** — out of scope now, but the array must not assume the sidebar's DOM.

`TOOLS_VIEW_META` is kept as a derived export (`Object.fromEntries` over the More group) so `App.jsx:2521-2534`'s mobile Recent block needs no edit.

### 4.2 `SbLink` — one component absorbing the repetition

Takes a config item plus `{ view, setView, setCompareTarget, showSbTip, hideSbTip, markBadgeSeen, badge }` and emits exactly the markup that exists today. Kills all 20 handler triples (F5).

**Constraint:** aurora's entrance cascade is `.sidebar.sb-aurora .sb-nav > *:nth-child(1..12)` (`styles.css:16306+`). `SbLink` and the group labels must remain **direct** children of `.sb-nav` — render groups as fragments, never wrapper `<div>`s, or the stagger silently breaks. Reordering the nav also reassigns which row gets which delay; re-check the cascade visually after §3 lands.

Expected: `DesktopSidebar.jsx` 211 → ~90 lines.

### 4.3 CSS extraction → `src/styles/sidebar.css` — NOT DONE, see below

- Move the contiguous main block (~9203 to the end of the `.sb-profile-pop` cluster) and the aurora block (16201-16435) into one new file, **preserving their relative order**, imported in `main.jsx` immediately after `./styles.css`.
- **Leave the 7 scattered rules where they are** (211, 410-460, 504, 1337, 4423, 5877) — they're global focus/tooltip/typography rules whose cascade position relative to non-sidebar code matters. Moving them is how this phase breaks something.
- **Delete all 45 `.sb-now-*` rules** in the same pass (F4).
- Net: roughly 700 lines out of the 17.8k-line `styles.css`, ~190 of them deleted outright.
- Risk to check: any rule between the main block and 16201 that overrides a `.sb-*` rule at equal specificity would flip.

**This was abandoned on 2026-09-05 after measuring it.** The premise above — two contiguous blocks plus seven strays — is wrong:

- Sidebar CSS is in **three** regions, not two: the main block, the aurora skin, *and* a third at ~12600-12890 (`.sb-quicklinks`, `a.sb-quicklink`, then the dead card). Moving the main block past that third region reorders real rules.
- **Four selectors are declared both inside and outside** the regions that would move: `.sb-link`, `.sb-link .nav-badge`, `.sb-avatar-name`, `.sb-pop-name`. Each one is a cascade flip to reason about individually.
- The regions are interleaved with unrelated rules that would have to be surgically left behind — `.spin-icon` + `@keyframes spin-anim`, `.over-version`, `.nav-badge`, and a 340-line desktop *layout* media block that is not sidebar CSS at all.

That is a real regression surface across two skins × two rail states × two themes, in exchange for file organisation and no user-visible change. Not worth it as part of this pass. If it is ever done, it should be its own change with nothing else in the diff.

The genuinely valuable half of this phase — deleting the dead rules — was done, see §9.

### 4.4 Small cleanups
- Offline banner inline styles → `.sb-offline` class (F6).
- Group labels become a `<SbGroupLabel>`; the More disclosure keeps its existing `aria-expanded` button.

---

## 5. Phasing

| Phase | Content | Risk |
|---|---|---|
| **0** | `navItems.js` + tests, nothing imports it | none — zero bundle impact |
| **1** | `SbLink` + `DesktopSidebar` rewritten against the config, **nav order unchanged** | low — pure refactor, DOM should be byte-identical; diff the rendered HTML |
| **2** | Apply the §3 regrouping; delete desktop Recent; flip `sbToolsOpen` to `false` | medium — visible change; needs the user's eyes |
| **3** | `.sb-now-*` deletion + offline-banner class (extraction dropped, §4.3) | low, as executed |

Phase 1 before Phase 2 on purpose: if something breaks after the refactor, the nav is still visually identical, so the cause is unambiguous.

---

## 6. Verification

- `npm test` — 202 tests currently green; add ~10 for `navItems.js` (unique ids, every item has icon+label, `view` XOR `action`, gates resolve, More group matches `TOOLS_VIEW_META`).
- `npm run lint` on every touched file. Repo baseline is **10 pre-existing errors** (5 `App.jsx`, 5 `AdminDashboard.jsx`), style-level — do not let that number grow.
- `npm run build`.
- Manual matrix, user-verified in the browser per the usual workflow: **Classic × Aurora × collapsed × expanded × light × dark**, plus tablet rail (`768px` landscape) and admin-on.
- Re-check the aurora entrance stagger after the Phase 2 reordering.

## 7. Decisions still open

- **D1 — Keep the "More" disclosure at all?** With only 4 items in it, the nav could go fully flat at 15 visible rows and the accordion, `sbToolsOpen` and `showSbTools` all delete. *Recommendation: keep it, collapsed.* 15 rows plus quick links plus admin starts to scroll on a 768px-tall laptop, and a flat list of 15 has no hierarchy left.
- **D2 — Should Mess menu become a real `view` instead of a modal?** It would make Campus internally consistent (F2), but it is a bigger change than this plan covers and it touches the mobile sheet too. *Recommendation: defer;* for now give `action` rows a small trailing dialog affordance so at least the row is honest about what it does.

## 8. Deferred

**The sidebar is hardcoded dark in both themes.** `.sidebar` paints a fixed `linear-gradient(160deg, #1a0d2e, #110820, #0a0415)` (`styles.css:9218`) with no `data-theme` variant anywhere in the file — it is the one surface that ignores the token system from the dark-mode pass. That may well be intentional (permanently-dark chrome against a light canvas is a real design choice), so it is recorded here, not fixed. Raise it if the light-mode look ever gets revisited.


---

## 9. What actually shipped — 2026-09-05

Phases 1 and 2 were done as one change rather than two: the config had to carry the new grouping to be worth writing, and the render tests below pin the output either way.

**New files**
- `src/lib/navItems.js` — `NAV_GROUPS`, `NAV_ITEMS`, `itemsForGroup()`, `MORE_VIEWS`.
- `src/components/SbLink.jsx` — one row, byte-identical markup to what the hand-written blocks produced.
- `src/lib/navItems.test.js` — 16 tests.
- `src/components/DesktopSidebar.test.js` — 9 tests, incl. a guard that every nav row stays a **direct** child of `.sb-nav` so the aurora `nth-child` cascade survives.

**Changed**
- `DesktopSidebar.jsx` — 211 → 180 lines, nav now data-driven; Recent block gone; offline banner uses a class.
- `App.jsx` — four props dropped from `<DesktopSidebar>`; `viewIsTool` keys off `MORE_VIEWS`; `TOOLS_VIEWS`/`TOOLS_VIEW_META` kept and commented as mobile-only.
- `useSidebar.js` — `sbToolsOpen` now defaults to `false`, matching its own comment.
- `styles.css` — **254 lines of dead `.sb-now-*` CSS deleted**; `.sb-offline` added.
- `vitest.config.js` — `esbuild: { jsx: "automatic" }`, needed for the component tests.

**One correction to F4:** `@keyframes sb-now-pulse` is *not* dead — `.sb-sync-dot` still uses it. It was kept and moved up beside its only remaining caller, with a comment saying why the name no longer matches anything.

**Verification:** 240 tests pass (was 215) across 13 files; `eslint .` holds at the 10 pre-existing errors; `npm run build` green. `calendarExport.perf.test.js` fails intermittently on a timing threshold — pre-existing and unrelated. Browser verification still pending.

**Known, pre-existing, not touched:** aurora declares entrance delays for `nth-child(1..12)` but the nav renders more children than that (19 with every flag on and More expanded), so the tail animates with no delay. The regroup slightly *reduced* the overflow; fixing it properly means an `:nth-child(n+13)` fallback.
