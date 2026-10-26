# TermFlow (PGP2 Schedule) — Accessibility Audit

**Date:** 2026-10-25 · **App version:** 7.7.0 · **Standard:** WCAG 2.2 AA
**Method:** Static review of `src/` (≈107k lines of JSX/CSS): pattern scans across every component and stylesheet, contrast maths on the theme tokens in `styles.css`, and a manual read of the main flows (login, Today/Timeline, nav, notifications, modals, social, attendance). No screen-reader or browser run was done for this pass — see §6 for the manual checks still needed.

---

## 1. Summary

The app is in better shape than most projects this size. The basics are mostly there: `lang="en-IN"`, pinch-zoom left on, ~1,000 real `<button>`s against only a handful of clickable `<div>`s, 465 `aria-label`s, `aria-current="page"` on nav, a global reduced-motion catch-all, labelled progress bars and chart summaries in Attendance, a well-built Login page using a native `<dialog>`, and focus moving to the page region when you switch views.

The gaps fall into five themes:

| # | Theme | Severity | Effort |
|---|---|---|---|
| A | **Colour contrast** — `--live`, `--amber`, `--blue` used as text fail in light mode; the global focus ring is green and fails 3:1 | High | Low |
| B | **Modals/sheets** — about 15 overlays have no `role="dialog"`, no Escape, no focus trap and never hand focus back | High | Medium |
| C | **Gesture-only actions** — dismissing a notification needs a swipe; reordering favourites needs drag | High | Low–Med |
| D | **Tiny type** — about 1,250 declarations at ≤11px, some as small as 6.5–8px, nearly all in `px` | Medium | Medium |
| E | **Semantics/announcements** — badge counts hidden by `aria-label`, `aria-label` on plain `<div>`s, toasts not announced, no skip link | Medium | Low |

Fixing **A, B (via a shared hook), C, and the quick items in E** would close most of the real-world barriers, and can be done in about 2–3 focused sessions.

---

## 2. What's already good (keep doing this)

- **Document basics** — `index.html` sets `lang="en-IN"` and does not set `maximum-scale` or `user-scalable=no`, so zoom works.
- **Semantic controls** — 994 `<button>` elements. Clickable `<div>`s are almost all modal backdrops, which is acceptable as long as Escape also closes the modal (see B).
- **Nav state** — `NavButton` (`App.jsx:198`) sets `aria-current="page"`, and pressing the active tab again scrolls to the top.
- **View switching** — `App.jsx:475` focuses `.tf-page-stage`, which is a labelled `role="region"` with `tabIndex={-1}` (`App.jsx:3580`). `document.title` updates per view and includes the unread count (`App.jsx:2147`).
- **Reduced motion** — global catch-all at `styles.css:18344`, 88 CSS media queries, and JS checks in the pet hooks, Login slideshow and loader. The Login slideshow also has pause/play controls.
- **Good components to copy:**
  - `Login.jsx` — native `<dialog>`, `aria-labelledby`/`aria-describedby`, `aria-busy`, `aria-pressed` theme toggles.
  - `split/SplitUI.jsx` modal — `role="dialog"`, `aria-modal`, Tab trap, Escape.
  - `CommandPalette.jsx`, `wrapped/WrappedDetailModal.jsx`, `WrappedShareSheet.jsx` — focus trap plus Escape.
  - `DesktopSidebar.jsx` tablet drawer — makes siblings `inert` and traps focus. This is the best pattern in the codebase.
  - `AttendancePanel.jsx` — `role="progressbar"` with values, and the chart has `role="img"` plus a summary label, with a label on each bar.
  - Timeline — `<ol className="rail">`, and attendance buttons grouped with `aria-label="Attendance for …"`.
- **Dark theme contrast** — every text token in dark mode passes AA (lowest is `--violet` on card at 4.75:1).
- **Images** — all 24 `<img>`s have `alt`. Decorative ones use `alt=""`.

---

## 3. Findings

### A. Colour contrast — High

Contrast ratios worked out from the tokens in `styles.css:1-75`:

| Token (light) | on `--bg` | on `--card` | Used as text | Verdict |
|---|---|---|---|---|
| `--text` #1A1C2A | 14.9 | 16.9 | — | ✅ |
| `--muted` #5A5E6E | 5.7 | 6.4 | — | ✅ |
| `--violet` #6D5BD0 | **4.58** | 5.18 | — | ⚠️ just passes on bg, **fails on `--surface` (4.30)** |
| `--danger` #C0392B | 4.81 | 5.44 | — | ✅ |
| `--live` #1FA971 | **2.67** | **3.01** | 185× `color: var(--live)` | ❌ fails AA text |
| `--amber` #C9882B | **2.64** | **2.98** | 90× | ❌ fails AA text |
| `--blue` #3B82F6 | **3.25** | **3.68** | 45× | ❌ fails AA text (passes large text only) |
| `--border-hi` #CCC8BC | 1.48 | 1.67 | input/control borders | ❌ fails 3:1 non-text (1.4.11) |
| White on `--live` / `--amber` / `--blue` buttons | 3.01 / 2.98 / 3.68 | | | ❌ for normal-size labels |

**Biggest single issue: the focus ring.** `styles.css:233-243` sets `outline: 2px solid var(--live)` on every focusable element. In light mode that is **2.67:1** against the page, which is below the 3:1 that WCAG 1.4.11 and 2.4.13 require. Keyboard users struggle to see where they are.

**Fixes:**
1. Add text-safe variants, the same way `--amber-text` already exists:
   ```css
   :root {
     --live-text:  #127A50;  /* ≈5.0:1 on --bg */
     --blue-text:  #1D5FD1;  /* ≈5.3:1 */
     --focus-ring: #4B3BB0;  /* violet, ≈7:1 */
   }
   html[data-theme="dark"] { --live-text: var(--live); --blue-text: var(--blue); --focus-ring: #B4A8F5; }
   ```
   Then replace `color: var(--live|--amber|--blue)` with the `-text` variants. Keep the bright tokens for fills, dots and borders.
2. Change the global focus outline to `var(--focus-ring)` and add `outline-offset: 2px`.
3. Darken `--violet` in light mode slightly (e.g. `#5F4DC4`) so it passes on `--surface` too.
4. Darken `--border-hi` (e.g. `#8F8A7C`) for **input and control borders only**. Decorative card borders can stay light.
5. Remove the hard-coded `color: #94a3b8` (7×), `#999`, `#a8a29e` in favour of `--muted`.
6. Opacity-dimmed text (`opacity: .35–.55` appears ~80×) lowers contrast further. Check each case where it applies to readable text rather than to a disabled control.

### B. Modals, sheets and popovers — High

Each overlay has its own hand-written implementation, and the quality varies widely. Overlays with **no `role="dialog"` and no Escape handler**:

| File | Overlay |
|---|---|
| `BoardPage.jsx:117` | Board composer |
| `CalendarExportModal.jsx:167` | Calendar export |
| `AssignmentsPanel.jsx:613` | Assignment modal |
| `FeedbackWidget.jsx:39` | Feedback |
| `FullSchedulePage.jsx:461, 505` | Day/session modals |
| `FriendsPanel.jsx:146, 1797` (+ others) | Status / connect modals |
| `App.jsx:3919` | Help modal |
| `App.jsx:2343, 2691, 3046, 3105` | Term menu, profile, overflow popovers |
| `AdminDashboard.jsx` (7 overlays) | Review, room, etc. |
| `PetHat.jsx`, `PetNeckwear.jsx`, `PetCameo.jsx`, `PetSleepCue.jsx`, `MigrationBanner.jsx` | Pet sheets, banner |

Some have a role but no Escape: `NotificationsPage.jsx:302`, `notifications/PushToggle.jsx:31`, `WhatsNew.jsx`, `Meetups.jsx`, `CourseHub.jsx`, `CourseLearning.jsx`.

Even the better ones mostly **don't return focus to the button that opened them**. A search for `returnFocus` / `previouslyFocused` / `triggerRef` finds nothing (only the notification panel does it, by hand). Only 5 components trap Tab.

**Fix: one shared hook**, applied everywhere. This is the highest-leverage change in the report:

```js
// hooks/useDialog.js
export function useDialog(open, onClose, { initialFocus } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const node = ref.current;
    (initialFocus?.current || node?.querySelector(FOCUSABLE) || node)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") trapTab(e, node);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); trigger?.focus?.(); };
  }, [open]);
  return { ref, role: "dialog", "aria-modal": true, tabIndex: -1 };
}
```

Spread the returned props onto every sheet's inner container, and add `aria-labelledby` pointing at the sheet's heading. For full modals, optionally set `inert` on `#root` siblings the way `DesktopSidebar.jsx:45` already does.

Another option is to move full-screen modals to the native `<dialog>` element with `showModal()`, as `Login.jsx` already does. That gives Escape, focus trapping and an inert background for free.

**Popovers** (profile, overflow, term menu): the trigger buttons need `aria-expanded` and `aria-controls`. 52 `aria-expanded` exist, so check these specific triggers.

### C. Gesture-only interactions — High (WCAG 2.5.1 / 2.1.1)

1. **Dismissing a notification needs a swipe.** In `notifications/SwipeRow.jsx`, swiping left hides an item and swiping right marks it read. The row itself (`NotificationsPage.jsx:152`) is `role="button"` and opens the date, so keyboard and switch users can mark items read but **cannot dismiss individual items at all**.
   **Fix:** show a visible "Hide" icon button on each row (or on hover and focus), or add a per-row overflow menu. Also handle `Delete`/`Backspace` on the focused row.
2. **The snooze button has no accessible name.** `SwipeRow.jsx:85` is an icon-only `<button>` labelled only by `data-tip`, which is a custom CSS tooltip and is not read by screen readers. Add `aria-label={extraAction.title}`.
3. **Unread state is shown only by a dot.** `.notif-dot` (`NotificationsPage.jsx:172`) is purely visual. Add visually hidden "Unread" text, or put it in the row's accessible name.
4. **Reordering favourites in Social needs a mouse or touch drag.** `FriendsPanel.jsx:1128` registers only `PointerSensor`. Add dnd-kit's keyboard support:
   ```js
   useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   ```
   and ideally also "Move up/down" items in the friend's menu.
5. Swipe and pointer handlers also exist in `AssignmentsPanel.jsx`, `CourseHub.jsx` and `FullSchedulePage.jsx`. Check that every swipe action has a button equivalent.

### D. Text size and scaling — Medium (WCAG 1.4.4 / 1.4.12)

Font sizes at or below 12px, across all CSS:

| Size | Count | | Size | Count |
|---|---|---|---|---|
| 6.5–7.5px | 8 | | 10px | 248 |
| 8px | 27 | | 10.5px | 158 |
| 8.5px | 55 | | 11px | 357 |
| 9px | 102 | | 11.5px | 162 |
| 9.5px | 126 | | 12px | 372 |

- About **2,530 `px` font-sizes against 165 `rem`**. Browser text-size settings (Android "Font size" and Chrome's text scaling) only partly reach `px` values, so users who need bigger text don't get it.
- Text at 8–9.5px is mostly used for badges, meta lines, the pet UI and admin. At that size it is hard to read for anyone, and combined with `--muted` or `--live` colours it gets worse.

**Fixes (step by step):**
1. Set a floor. No readable text below **11px**; only purely decorative counters can go smaller. Start with the 8–9.5px group (318 declarations). `mobile-v2.css`, `friends.css`, `pet.css` and `admin.css` are the main sources.
2. Define a type scale as tokens in `rem` (`--fs-xs: .6875rem` = 11px, `--fs-sm: .75rem`, `--fs-base: .875rem`, …) and migrate files gradually as they are touched.
3. Test at 200% zoom and with Android's largest font size. Look for clipped pills and chips: fixed `height:` with `overflow:hidden` breaks first.

### E. Semantics and announcements — Medium

1. **The unread badge is hidden from screen readers.** `App.jsx:3372` has `aria-label="Announcements"` on the nav button, which overrides the inner `.nav-badge` count. Use a dynamic label: ``aria-label={unreadChangeCount ? `Announcements, ${unreadChangeCount} unread` : "Announcements"}``. Apply the same fix to every nav item with a badge (Social, sidebar `SbLink`, mobile tab bar).
2. **`aria-label` on plain `<div>`/`<span>` is ignored.** For example, `Timeline.jsx:301` (`.timeline-overview`) and `:318`. ARIA doesn't allow names on generic elements, so most screen readers skip them. Either add `role="group"` or `role="img"`, or render the sentence as visually hidden text.
3. **No visually hidden utility exists.** No `.sr-only` / `.visually-hidden` class was found. Add one to `styles.css`, since several fixes above need it:
   ```css
   .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
   ```
4. **Toasts aren't always announced.** `XpToast` and `app-toast` use `role="status"`, but `SocialFlashToast.jsx` and `FeedbackFlashToast.jsx` have no live region. Also, toasts that mount and unmount together with their live region often go unannounced. Keep one persistent `aria-live="polite"` region and update its text instead.
5. **Toast timing.** Toasts disappear after 3–4s (`XpToast.jsx:85`, `App.jsx:974`). Pause the timer on hover and on focus, and leave anything actionable on screen until the user dismisses it (WCAG 2.2.1).
6. **No skip link.** Add a "Skip to content" link as the first focusable element, targeting `.tf-page-stage`. On desktop, the sidebar has dozens of tab stops before the content.
7. **Landmark names.** `MobileV2TabBar.jsx:21` reads aloud as "V2 primary navigation". Rename it to "Primary". There are 15 `<nav>` and 10 `<main>` elements. Check that only one `<main>` is rendered at a time, and give each `<nav>` a distinct label (Primary / Sections / Course tabs).
8. **Heading structure.** The Today view's `<h1>` is the current or next course name (`Hero.jsx:199-418`), so the page heading changes every class. Consider a stable visually hidden `<h1>` ("Today") and make the course name an `<h2>`. About 120 `div`/`span` elements have "title" or "heading" class names and are worth checking for missing heading semantics (screen-reader users navigate by heading).
9. **`outline: none` overrides.** There are 44 of them. Many replace the outline with only a border-colour change, such as `.board-input:focus`, `.poll-input:focus` and the `pet.css` slots. A 1px colour shift is not a visible focus indicator. Remove the override and let the global ring apply, or use `box-shadow: 0 0 0 2px var(--focus-ring)`.
10. **Form labelling.**
    - 16 inputs are labelled only by placeholder: `BoardPage.jsx:148-165` and admin inputs at `AdminDashboard.jsx:2897, 2931, 3034, 3056, 3318, 4562, 7222`. Placeholders disappear while typing and are low-contrast.
    - Only 14 `htmlFor` and 1 `aria-invalid` exist in the whole app. Validation errors should be linked to their field with `aria-describedby` and set `aria-invalid`.
11. **Small touch targets.** 238 rules set `width`/`height` to 10–23px. Check that icon buttons (chip remove, swipe snooze, mess rate, pet slots) have at least a **24×24px** hit area (WCAG 2.2 2.5.8), and ideally 44px on mobile.
12. **No `forced-colors` support.** There are zero `@media (forced-colors: active)` rules. Windows High Contrast removes backgrounds and box-shadows, so pills, status dots and custom toggles may vanish. Add borders or `outline` fallbacks for the most important ones, such as attendance state and toggles.
13. **SVGs.** 55 inline `<svg>` elements, of which 19 have neither `aria-hidden` nor a `role`. Mark decorative ones (illustrations, pet art) `aria-hidden="true"`. Give meaningful ones `role="img"` and `aria-label`. lucide-react icons are hidden by default in recent versions; check the installed v1.18 does this.

### F. Admin dashboard — Low priority (small internal audience)

`AdminDashboard.jsx` (7,383 lines) has the most issues: 7 overlays without dialog semantics, most of the placeholder-only inputs, and dense 10–12px type in `admin.css`. Fix it after the student-facing app, ideally by adopting `useDialog` and the `ui.jsx` primitives as it gets refactored.

---

## 4. Prioritised action plan

### Phase 1 — Quick wins (≈1 session, low risk)
- [ ] Add `--focus-ring`, `--live-text`, `--blue-text` tokens. Switch the global focus outline (`styles.css:233`).
- [ ] Replace `color: var(--live|--amber|--blue)` with text-safe tokens (search and replace, then visual check in both themes).
- [ ] Add a `.sr-only` utility and a skip-to-content link.
- [ ] Put badge counts in nav `aria-label`s (`App.jsx:3372` and siblings).
- [ ] Add `aria-label` to the snooze button (`SwipeRow.jsx:85`) and an "Unread" text alternative for `.notif-dot`.
- [ ] Rename "V2 primary navigation".
- [ ] Add `KeyboardSensor` to the dnd-kit sensors in `FriendsPanel.jsx`.

### Phase 2 — Structural (≈1–2 sessions)
- [ ] Build `hooks/useDialog.js` (Escape, focus in, Tab trap, return focus) and roll it out to all overlays in §B. Start with Board, Calendar export, Assignments, Feedback and Help.
- [ ] Add a visible Hide/Dismiss button to notification rows.
- [ ] Add `aria-expanded` and `aria-controls` to the popover triggers (profile, overflow, term menu).
- [ ] Add a single persistent live region for toasts; pause the timer on hover and focus.
- [ ] Remove or replace the 44 `outline: none` overrides.
- [ ] Add labels to placeholder-only inputs; link errors with `aria-describedby` / `aria-invalid`.

### Phase 3 — Ongoing hygiene
- [ ] 11px minimum font size; move type to `rem` tokens file by file.
- [ ] `forced-colors` fallbacks for status pills, toggles and dots.
- [ ] Fix `aria-label` on generic elements; clean up heading levels.
- [ ] Add `eslint-plugin-jsx-a11y` (recommended preset) to `eslint.config.js` to catch regressions. Expect an initial wave of warnings. Start in `warn` mode.
- [ ] Add `vitest-axe` (or `jest-axe`) assertions to the existing component tests (`TodayDashboard.test.jsx`, `FullSchedulePage.test.jsx`, …) so each test also checks a11y.

---

## 5. Suggested tooling

| Tool | Purpose |
|---|---|
| `eslint-plugin-jsx-a11y` | Lint-time catch for missing alt/labels, click-on-div, invalid ARIA |
| `vitest-axe` | axe-core checks inside the existing Vitest suite |
| Lighthouse / axe DevTools | Run on Today, Week, Announcements, Social, Attendance, Split, in light **and** dark |
| Chrome DevTools → Rendering → *Emulate prefers-reduced-motion / forced-colors* | Verify motion and High Contrast fallbacks |
| TalkBack (Android) + NVDA (Windows) | Real screen-reader passes; most students use Android |

---

## 6. Manual checks still needed

A static review can't confirm these. Do them before and after Phase 1–2:

1. **Keyboard-only run-through**: login → Today → mark attendance → open class details → Week → Announcements (mark read, dismiss) → Social (open friend, reorder favourites) → Split (add expense) → Settings/theme. Note anywhere focus is lost, invisible or trapped.
2. **TalkBack on the installed PWA**: bottom tab bar, the swipe rows, the pet page, and push-notification deep links. Check that focus lands sensibly after a deep link.
3. **200% zoom and largest Android font size**: check chips, the hero, the timeline rail and the mobile tab bar for clipping.
4. **Contrast spot-check in the browser**: tinted chips (`--subj-*`), hero backdrop text over images, and translucent `color-mix` surfaces. Token maths can't see these.
5. **Reduced motion on**: check the pet idle animations, confetti/XP effects and view transitions actually stop.
