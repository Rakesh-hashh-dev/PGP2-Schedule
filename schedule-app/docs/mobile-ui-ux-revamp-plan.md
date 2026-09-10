# Mobile UI/UX revamp plan

**Date:** 2026-09-10  
**Status:** V2 shell implemented locally on 2026-09-10; feature-screen refinement and signed-in device QA remain  
**Product:** TermFlow / PGP2 Schedule  
**Target:** Phone-sized mobile web and installed PWA experience

**Version decision:** The existing mobile interface remains available as **V1**. The redesign described in this document is **V2**. Users can switch between V1 and V2 from the mobile `...` menu.

## Concept mockups

These are visual direction references, not pixel-perfect implementation specifications. Course names, dates, percentages, avatars, and notification copy are illustrative placeholder content.

- [Core screens — light mode](mockups/mobile-core-screens-light.png): Today, Schedule, Tasks, and More
- [Supporting flows — dark mode](mockups/mobile-supporting-flows-dark.png): Attendance, Announcements, Search, and Subject Filter sheet

## 1. Scope boundary

This revamp is **mobile-only**.

- Redesign the app for portrait phones and small mobile screens.
- Keep the current desktop sidebar, desktop navigation, desktop layouts, and desktop visual treatment unchanged.
- Keep the tablet landscape/sidebar experience unchanged.
- Treat widths up to `767px` as the primary mobile scope. Tablet portrait (`768px–1024px`) may receive only safe shell fixes when required; it must not inherit the phone navigation without a separate decision.
- Do not change business logic, schedule calculations, Supabase behavior, authentication, permissions, feature flags, or the underlying data model.
- Preserve light, dark, reduced-motion, offline, archived-term, Lite, and admin feature behavior.
- Preserve both mobile UI versions. V1 is not removed when V2 ships.

### Mobile UI versioning

- **V1 / Classic:** the current mobile header, top-tab/bottom-dock preference, and existing overflow experience.
- **V2 / Modern:** the redesigned phone shell, five labeled bottom tabs, contextual app bars, More hub, and modern mobile surfaces defined below.
- **Both V1 and V2 support Light, Dark, and System appearance modes.** V2 must have full visual and functional parity across all three modes; it is not a light-only or dark-only design.
- Add a clearly labeled **Mobile interface** control inside the `...` menu in both versions.
- Present the choices as **V1 · Classic** and **V2 · Modern**. Do not label this control simply "Theme," because Light/Dark/System appearance remains a separate setting.
- Store the selection as a dedicated device preference such as `pgp2.mobile-ui-version`; do not overload `pgp2.theme` or `pgp2.mobile-nav`.
- Continue using the existing appearance preference for Light/Dark/System. A user may independently choose any combination, such as V1 + Dark or V2 + Light.
- Switching versions changes only the phone shell and responsive presentation. It must preserve the signed-in account, active app view, selected term, filters, feature data, and mutations.
- Recommended rollout: existing users start on V1 and can opt into V2. After V2 is validated, the default for users with no saved choice may be changed separately; an explicit V1 choice must continue to be respected.

### Desktop non-regression rule

Every implementation phase must satisfy all of the following:

1. Existing desktop JSX remains the default at desktop/sidebar breakpoints.
2. New phone components render only within the mobile breakpoint or an explicit mobile render branch.
3. New styles live in a dedicated mobile stylesheet and are scoped below a mobile shell class or mobile media query.
4. Existing `.sidebar`, `.desk-layout`, and desktop header behavior must not be restyled by the mobile work.
5. Desktop screenshots are compared before and after each phase.

## 2. Current mobile experience

The current phone UI is responsive, but it still behaves like a compressed desktop web app in several places.

### Current structure

- The top header shows the TermFlow brand, Search, Notifications, and a `...` overflow menu.
- Navigation can be set to top tabs, a bottom dock, or both.
- The top navigation contains up to eight horizontally scrolling tabs.
- The optional bottom dock also contains up to eight icon-only destinations.
- The `...` menu contains Schedule actions, term switching, recent pages, Tools, Preferences, About, Admin, and Sign out.
- Many feature screens independently define their own responsive grids, cards, tabs, dialogs, and action rows.

### Main UX problems to solve

1. **Two competing navigation systems.** Top tabs, bottom navigation, and the overflow menu divide the information architecture and can duplicate destinations.
2. **Too many bottom destinations.** Eight icon-only controls do not fit comfortably on narrow phones, force targets below the preferred size, and are difficult to identify without labels.
3. **The overflow menu is overloaded.** It behaves like a desktop dropdown even though it contains enough content to be a mobile destination of its own.
4. **Weak page context.** The same brand header is used across many views instead of a contextual phone app bar with a title, back behavior, and page actions.
5. **Responsive styling is distributed.** Mobile overrides are spread across the global stylesheet and feature styles, which makes consistency and regression control difficult.
6. **Small text and dense controls.** Several secondary labels use `10px–13px` text and some feature actions are visually dense for touch use.
7. **Floating UI collisions.** The dock, help buttons, undo toasts, notifications, modals, and the iPhone home indicator all compete for the bottom safe area.
8. **Web-style overlays.** Popovers and centered dialogs should become bottom sheets or full-screen task flows where appropriate on phones.
9. **Navigation preference adds complexity inside V1.** V1 retains its current top/bottom/both behavior. V2 uses one navigation model, keeping the new experience predictable while both UI versions remain available.

## 3. Target mobile experience

The phone experience should feel like a focused native timetable app while retaining TermFlow's colors, typography, pet personality, and feature set.

### Design principles

- **One obvious V2 navigation model:** stable bottom tabs for primary destinations.
- **Thumb-first interaction:** frequent actions sit within easy reach; minimum target size is `44px`, with `48px` preferred for primary controls.
- **Context before chrome:** each screen clearly states where the user is and what they can do.
- **Progressive disclosure:** advanced and infrequent tools live in More, not in the primary tab bar.
- **Readable at a glance:** default body text is at least `14px`; important schedule content is `15px–17px`.
- **Stable controls:** primary navigation does not auto-hide or shrink during scrolling.
- **Platform-aware surfaces:** use app bars, segmented controls, lists, bottom sheets, snackbars, and full-screen task flows consistently.
- **Safe-area first:** all fixed surfaces respect notches, browser chrome, virtual keyboards, and home indicators.
- **Fast on ordinary phones:** blur, shadows, and motion enhance the UI but are never required for legibility.
- **Accessible by default:** visible labels, strong focus states, semantic headings, screen-reader names, reduced motion, and adequate contrast.

## 4. Recommended mobile information architecture

Use one fixed bottom navigation with **five labeled destinations**:

| Tab | Purpose | Existing views included |
|---|---|---|
| **Today** | Immediate schedule, next class, attendance prompt, quick status | `today`, with Tomorrow reachable through the day control |
| **Schedule** | Week and complete timetable browsing | `week`, `fullSchedule` |
| **Attendance** | Attendance summary and marking workflow | `attendance`; hide or replace through feature-gate rules when disabled |
| **Tasks** | Academic work and deadlines | `assignments`, `exams` through an in-page segmented control |
| **More** | Secondary destinations and preferences | Announcements, Social, Campus Board, Mess, Split, Leave, Companion, Wrapped, Settings, Feedback, Admin |

### Feature-gate behavior

- If Attendance is disabled, promote **Announcements** into the fourth tab position and keep Tasks in its existing position.
- If Exams is disabled, Tasks opens Assignments without showing a one-option segmented control.
- If Social, Companion, Wrapped, Admin, or other gated features are disabled, remove only their More rows; do not leave empty categories.
- Unread state appears as a small badge on the relevant tab or More row.

### Why this structure

- It keeps the most frequent student workflows one tap away.
- It removes the eight-icon width problem.
- Labels make destinations discoverable.
- Tomorrow becomes a time choice within the schedule experience instead of consuming a permanent global destination.
- Assignments and Exams become one coherent Tasks area without changing their internal feature logic.
- More becomes a browsable mobile hub, not an oversized dropdown.

### Navigation behavior

- Preserve the selected tab when returning from a detail screen.
- Use real browser history for view changes so Android back, iOS back gestures, and PWA navigation behave predictably.
- A second tap on the active tab scrolls its root screen to the top.
- Deep links such as `?view=pet` continue to open the correct screen, with More shown as the owning tab.
- Keep the current top/bottom/both navigation preference inside V1 only. V2 does not expose that control because its labeled bottom tab bar is the defined V2 navigation model.
- The `...` menu in both versions exposes the Mobile interface selector so the user can switch back at any time.

## 5. Mobile shell specification

### 5.1 Contextual app bar

Replace the single compressed desktop-style header on phones with a reusable mobile app bar.

**Root screens**

```text
+--------------------------------+
| TermFlow          Search Bell  ... |
| Wed, 10 Sep · Term 5             |
+--------------------------------+
```

**Secondary/detail screens**

```text
+--------------------------------+
| Back      Page title    Action ... |
+--------------------------------+
```

Requirements:

- Height approximately `56px` plus `env(safe-area-inset-top)`.
- Sticky at the top with an opaque fallback; optional blur only when supported.
- Root app bar shows identity and the most useful contextual subtitle.
- Detail app bar provides a visible Back action and at most two page actions.
- Search opens a mobile full-screen search experience.
- Bell opens Announcements or a phone-sized notification sheet; avoid a desktop popover anchored below the icon.
- The `...` action opens a short phone menu containing the Mobile interface selector. It may also contain a few shell-level actions, but it must not recreate the current long V1 overflow menu.
- Sync status moves into a subtle status row, pull-to-refresh response, or More/Settings—not a permanent extra toolbar button.

### 5.2 Bottom tab bar

```text
+--------------------------------+
| Today | Schedule | Attend | Tasks | More |
+--------------------------------+
```

Requirements:

- Fixed to the viewport bottom and attached edge-to-edge like a phone tab bar.
- Includes both icon and short text label for every destination.
- Five destinations maximum.
- Each tab has at least a `48px` touch target.
- Active state uses color, label weight, and a restrained indicator—not color alone.
- Respects `env(safe-area-inset-bottom)`.
- Does not recede, scale, or fade while scrolling.
- Content receives one shared bottom inset variable so no screen, FAB, toast, or sheet action is hidden behind the bar.
- In landscape phones, compact spacing but retain labels unless the usable height is exceptionally constrained.

### 5.3 More hub

Move the current long feature list out of the V2 `...` dropdown and into a full mobile page. V2 still keeps a small `...` menu in the app bar for the V1/V2 selector and limited shell-level actions.

Recommended groups:

- **Campus:** Announcements, Social, Campus Board, Mess menu
- **Tools:** Full timetable shortcut, Split expenses, Leave planner, Calendar export
- **Personal:** Companion, Term Wrapped
- **Settings:** Edit setup, Subject filters, Term switcher, Appearance, Pet preference, Notification settings
- **Support:** What's New, Submit feedback
- **Account/Admin:** Profile, Admin tools when authorized, Sign out

Use large list rows with icon, label, optional supporting text, badge, and chevron. Show a compact profile card at the top. Destructive Sign out remains visually separated.

### 5.4 Mobile `...` quick menu and UI version selector

Both mobile versions must provide the same reliable escape hatch:

```text
+------------------------------+
| Mobile interface             |
|  (o) V1 · Classic            |
|  ( ) V2 · Modern             |
|------------------------------|
| Appearance                 >  |
| Edit setup                 >  |
+------------------------------+
```

- In V1, add Mobile interface near the top of the existing `...` menu so it is easy to find without expanding an accordion.
- In V2, the app-bar `...` opens a compact anchored menu on larger phones or a small bottom sheet on narrow/short phones.
- Show the currently selected version with a radio/check state and supporting copy: "Current mobile design".
- Apply the switch immediately after selection; no reload should be required.
- Announce the result to assistive technology and restore focus to the new shell's app bar.
- Keep Appearance directly below it, clearly separated as Light/Dark/System color mode.
- Do not duplicate the complete More hub inside this menu.

### 5.5 Day and section switching

- Today/Tomorrow becomes a compact segmented day control on the Today screen.
- Week/Full timetable becomes a segmented control on the Schedule screen.
- Assignments/Exams becomes a segmented control on the Tasks screen.
- Segment selection must not create nested horizontal scroll areas.
- Preserve the current underlying views initially; the shell can map segments to the existing view state before deeper consolidation.

### 5.6 Sheets, dialogs, and menus

Create one reusable phone sheet pattern for filters, settings, quick actions, confirmation, and small forms.

- Bottom sheet for short choices and contextual actions.
- Full-screen sheet/page for search, complex forms, calendar export, and multi-step tasks.
- Maximum sheet height uses `100dvh`, with a `100vh` fallback.
- Sheet body scrolls independently; header and primary action remain reachable.
- Account for the on-screen keyboard using dynamic viewport units and scroll focused fields into view.
- Add focus trapping, Escape handling, backdrop dismissal only when safe, and focus restoration.
- A drag handle may be visual in the first release; drag-to-dismiss should be added only if it is reliable and accessible.

### 5.7 Feedback and transient UI

- Use one snackbar/toast lane above the bottom tab bar.
- Stack or queue XP, undo, sync, and feedback messages instead of letting them overlap.
- Keep critical errors until dismissed or resolved; auto-dismiss only non-critical confirmations.
- Haptics remain optional enhancement and must not be the only confirmation.

## 6. Mobile visual system

Keep the current TermFlow brand; modernize its phone application, not its identity.

### Tokens

Add mobile-specific tokens rather than scattered literal values:

```css
--mobile-gutter: 16px;
--mobile-appbar-height: 56px;
--mobile-tabbar-height: 64px;
--mobile-touch-min: 44px;
--mobile-section-gap: 20px;
--mobile-card-radius: 16px;
--mobile-sheet-radius: 24px;
--mobile-bottom-clearance: calc(var(--mobile-tabbar-height) + env(safe-area-inset-bottom));
```

- Define V2 tokens for both existing light and dark theme contexts rather than hardcoding either palette inside V2 components.
- System mode continues to follow the operating-system preference and updates V2 without changing the selected UI version.
- Every V2 surface—including app bars, tab bars, sheets, cards, inputs, snackbars, skeletons, and empty/error states—must be reviewed in both light and dark mode.

### Typography

- Page title: `20px–24px`, high emphasis.
- Section title: `16px–18px`.
- Primary body/schedule text: `15px–17px`.
- Secondary text: `13px–14px`.
- Avoid `10px–12px` for meaningful information; reserve it for non-essential metadata only.
- Support browser text scaling without clipped fixed-height controls.

### Layout and surfaces

- Use `16px` phone gutters, reduced to `12px` only below `360px`.
- Prefer fewer, purposeful cards rather than wrapping every row in a card.
- Use consistent `12px–16px` radii and a shallow elevation system.
- Avoid nested cards, excessive gradients, and multiple competing accent colors on one screen.
- Keep dense timetable information aligned in list rows; do not force desktop tables into the viewport.
- Use skeletons that match the final layout to reduce perceived movement.

### Motion

- Use `120ms–240ms` transitions for press, sheet, tab, and content-state feedback.
- Prefer opacity and transform animations.
- Disable decorative motion under `prefers-reduced-motion: reduce`.
- Do not animate layout height for long or data-heavy lists.

## 7. View-by-view redesign plan

### Priority 1 — core daily journey

#### Today and Tomorrow

- Merge the mobile entry experience under the Today tab with a Today/Tomorrow segment.
- Lead with one compact "Now / Next" card.
- Keep the schedule timeline as the main content, with clearer time, course, room, and status hierarchy.
- Make attendance marking a thumb-friendly inline action with immediate state feedback and undo.
- Reduce stacked banners; combine low-priority notices into one expandable updates row.
- Keep the pet/greeting delightful but subordinate to the schedule and collapsible on short screens.

#### Schedule

- Use Week/Full segments in a contextual app bar or directly below it.
- Make date navigation sticky and thumb-friendly.
- Convert wide timetable layouts to an agenda/list default on phones.
- Offer dense/table mode as an optional secondary view only if it remains readable.
- Keep subject filtering in a bottom sheet with selected-count feedback and a clear Reset action.

#### Attendance

- Start with overall percentage and risk status, then course list.
- Use consistent progress bars and plain-language status labels.
- Make course details drill-down screens rather than expanding several dense regions inline.
- Keep marking controls at least `44px` and provide undo.

#### Tasks

- Combine Assignments and Exams under one mobile destination while retaining their existing components and data logic.
- Default sort by urgency; group Today, Upcoming, and Completed/Past.
- Use compact status chips and one clear primary action per row.
- Move creation/edit forms to full-screen sheets on phones.

### Priority 2 — campus and utilities

#### Announcements

- Present as a normal full page reached from the bell and More hub.
- Use unread grouping, readable timestamps, swipe only as an optional shortcut, and visible non-swipe actions.
- Keep notification settings in a separate sheet/page.

#### Social and comparison

- Separate friends, groups, and availability using a small segmented control.
- Use profile/list rows rather than desktop multi-column cards.
- Make compare selection a guided full-screen task with a sticky action area.

#### Campus Board and Mess

- Use phone lists with category chips and predictable detail sheets.
- Keep Mess as a full-height sheet or dedicated page instead of a small centered modal.

#### Split, Leave, Companion, and Wrapped

- Give each a contextual app bar and reliable Back behavior.
- Convert multi-column controls into a single-column flow.
- Use sticky bottom actions only when the screen has one clear primary action.
- Keep Companion animation within a performance budget and honor reduced motion.

### Priority 3 — admin on phones

- Do not shrink desktop admin dashboards into narrow columns.
- Provide a task-oriented mobile admin home with search and high-frequency actions.
- Convert tables into summary rows with detail drill-down.
- Keep destructive or high-impact actions behind review/confirmation steps.
- If a complex admin workflow cannot be made safe and usable on a phone, label it desktop-recommended instead of shipping a cramped interface.

## 8. Proposed code structure

This structure isolates phone work from desktop behavior.

### New mobile-only modules

```text
src/components/mobile/
  MobileShell.jsx
  MobileAppBar.jsx
  MobileTabBar.jsx
  MobileMorePage.jsx
  MobileUiVersionMenu.jsx
  MobileBottomSheet.jsx
  MobileSegmentedControl.jsx
  MobileSnackbarHost.jsx

src/hooks/
  useMobileNavigation.js
  useMobileUiVersion.js
  useMobileViewport.js

src/lib/
  mobileNavItems.js

src/styles/
  mobile-shell.css
  mobile-components.css
```

### Integration approach

- Keep `DesktopSidebar.jsx` untouched unless a shared bug must be fixed separately.
- In `App.jsx`, choose the V1 or V2 phone shell from `useMobileUiVersion`; preserve the desktop shell branch regardless of that preference.
- Use `matchMedia` through a small hook for render decisions; CSS remains the source of truth for layout.
- Map the new mobile routes/tabs to existing `view` values during the first phases so feature components do not need simultaneous rewrites.
- Move the hand-written mobile menu configuration to `mobileNavItems.js`; do not force the desktop navigation grouping onto phones.
- Import mobile CSS after current feature styles, but scope every rule under `.mobile-shell` and `@media (max-width: 767px)`.
- Avoid broad edits to the large global `styles.css`; migrate a mobile rule only when its owning component is moved.
- Add the version selector to V1's existing `...` menu and V2's compact `...` menu. Both write the same dedicated preference key.

## 9. Implementation phases

### Phase 0 — baseline and design inventory

**Goal:** establish a reliable before-state.

- Capture signed-in screenshots of every user-facing mobile view in light and dark mode.
- Record phone widths, overflow, tap-target, keyboard, safe-area, and fixed-element issues.
- Capture desktop reference screenshots for the non-regression gate.
- Confirm primary user journeys and, if available, review navigation analytics before finalizing tab priority.
- Create a route/view ownership table and inventory every modal, popover, FAB, toast, and sticky element.

**Exit:** approved shell wireframes, issue inventory, and screenshot baseline.

### Phase 1 — isolated mobile foundations

**Goal:** add mobile tokens and primitives without changing navigation.

- Add mobile-scoped spacing, type, safe-area, dynamic viewport, elevation, and touch-target tokens.
- Build app bar, tab bar, segmented control, sheet, and snackbar primitives.
- Add component and accessibility tests.
- Render primitives in a development-only showcase or test harness before integrating them.

**Desktop risk:** none if scoping rules are followed.

### Phase 2 — mobile shell and navigation

**Goal:** replace the top-tabs/bottom-dock/overflow combination on phones.

- Add `MobileShell`, contextual app bar, five labeled tabs, and More page.
- Add the shared V1/V2 preference and expose it in the `...` menu of both shells.
- Map tabs to existing views and preserve feature flags, unread badges, deep links, and recent state where still useful.
- Add browser-history/back behavior.
- Keep V1 as a supported user-selectable mobile shell rather than a temporary fallback.
- Do not alter desktop sidebar/nav configuration.

**Exit:** every existing user view remains reachable on a phone with one consistent navigation model.

### Phase 3 — core screens

**Goal:** redesign Today/Tomorrow, Schedule, Attendance, Tasks, and their filters/forms.

- Work one view at a time.
- Keep data and mutations unchanged.
- Replace phone-only wide grids/tables with lists or drill-downs.
- Standardize loading, empty, offline, error, success, and undo states.

**Exit:** the four main student journeys meet the mobile acceptance criteria.

### Phase 4 — secondary screens and overlays

**Goal:** migrate Announcements, Social, Board, Mess, Split, Leave, Companion, Wrapped, search, settings, and export flows.

- Replace mobile popovers/centered dialogs with the appropriate sheet or full-screen flow.
- Unify fixed-element spacing through the snackbar/tab-bar clearance system.
- Keep V1's legacy mobile-navigation preference scoped to V1; do not display it in V2.

### Phase 5 — mobile admin and hardening

**Goal:** make authorized administrative workflows safe on phones and complete cross-device QA.

- Prioritize admin lookup, schedule actions, announcements, and moderation.
- Add desktop-recommended states where a phone workflow would be unsafe or unusable.
- Complete performance, accessibility, orientation, keyboard, PWA, and regression testing.

## 10. Validation strategy

### Device/viewport matrix

At minimum test:

| Class | Representative viewport |
|---|---|
| Very small Android / older iPhone | `320 × 568` |
| Common compact Android | `360 × 800` |
| iPhone compact | `375 × 667` and `375 × 812` |
| Current iPhone | `390 × 844` |
| Common Android | `412 × 915` |
| Large iPhone | `430 × 932` |
| Landscape phone | `844 × 390` |
| Tablet portrait boundary | `768 × 1024` |
| Desktop regression | `1280 × 800` and `1440 × 900` |

Test actual iOS Safari/installed PWA and Android Chrome/installed PWA in addition to responsive emulation.

### State matrix

- Light, dark, and system appearance
- All six primary combinations: V1 Light, V1 Dark, V1 System, V2 Light, V2 Dark, and V2 System
- Reduced motion
- 200% browser zoom / increased text size
- Online, offline, reconnecting, and stale data
- Empty, loading, error, and populated states
- Attendance/Exams/Social/Companion/Archived Terms/Admin flags on and off
- Signed-in standard user and admin
- Keyboard open on forms
- Notch/home-indicator safe areas
- PWA standalone and normal browser modes

### Automated checks

- Unit-test mobile navigation configuration and feature-gate resolution.
- Component-test app-bar titles/actions, tab selection, badge states, More grouping, sheet focus management, Back behavior, and switching V1 to V2 and back.
- Run the core reachability and feature-gate tests against both mobile versions.
- Add accessibility checks for landmarks, names, focus order, dialog semantics, and contrast-sensitive states.
- Add screenshot regression coverage for the phone shell and critical screens.
- Run the existing repository tests and lint; do not accept new warnings/errors.
- Avoid relying on the normal production build during early iterations because its prebuild regenerates schedule snapshot data; use the existing safe verification workflow and inspect generated diffs when a build is necessary.

### Manual journey tests

1. Open the app and identify the next class within five seconds.
2. Switch to Tomorrow and back without losing scroll or context.
3. Mark attendance and undo it with one hand.
4. Find the week/full timetable and filter subjects.
5. Find an assignment and an exam from Tasks.
6. Read an announcement and verify its unread badge clears.
7. Open a secondary tool from More and return using system Back.
8. Complete a form while the on-screen keyboard is open.
9. Use every core flow offline and confirm the state is explained honestly.
10. Repeat critical journeys with reduced motion and increased text size.

## 11. Acceptance criteria

The mobile revamp is complete when:

- V2 users see one navigation system with no more than five labeled bottom tabs.
- V1 and V2 are both selectable from the mobile `...` menu, and switching either direction does not require a reload.
- Light/Dark/System appearance remains independent of the V1/V2 mobile interface choice.
- V2 reaches complete light/dark parity: no unreadable, unthemed, or light-only/dark-only screen is accepted.
- Every existing non-admin feature is reachable in three taps or fewer from a root tab.
- Primary student tasks—next class, timetable, attendance, assignments, and exams—are reachable in one or two taps.
- No meaningful control has a touch target smaller than `44 × 44px`.
- No primary content requires horizontal page scrolling at `320px` width.
- Fixed bars, sheets, keyboards, toasts, and FABs never obscure actionable content.
- System Back and browser history behave predictably.
- All phone pages have a clear title, primary action hierarchy, and loading/empty/error/offline state.
- Light/dark themes, reduced motion, text scaling, and screen-reader navigation pass review.
- Core screens remain usable on budget Android devices without depending on blur or heavy animation.
- Desktop/sidebar screenshots and behavior remain unchanged.
- Existing tests pass and mobile-specific navigation/accessibility tests are added.
- Signed-in testing succeeds on real iOS and Android devices before rollout.

## 12. Risks and controls

| Risk | Control |
|---|---|
| Mobile CSS leaks into desktop | Scope new rules under `.mobile-shell` plus the phone media query; run desktop visual regression each phase |
| Large `App.jsx` integration creates regressions | Extract shell pieces first and map them to existing handlers rather than rewriting feature logic |
| Supporting two mobile shells causes feature drift | Share business logic and view components, keep only shell/presentation different, and run reachability tests against V1 and V2 |
| A user gets stuck in one version | Put the shared version selector near the top of the `...` menu in both versions and test switching in both directions |
| Navigation regrouping hides features | Maintain a reachability test generated from mobile nav config and feature flags |
| Browser Back conflicts with current view state | Define one navigation adapter and test direct links, Back, Forward, refresh, and account switching |
| iOS viewport/keyboard issues | Use dynamic viewport units with fallbacks and test on physical Safari/PWA |
| Bottom bar overlaps existing fixed UI | Establish one shared bottom-clearance variable and one snackbar host |
| Visual polish hurts performance | Use opaque fallbacks, restrained blur, compositor-friendly motion, and real-device profiling |
| Desktop design changes accidentally enter scope | Keep desktop files/components out of mobile phases and reject unrelated visual cleanup |
| Existing uncommitted work is overwritten | Inspect target diffs before every phase and make small, isolated patches; do not reset or broadly reformat |

## 13. Decisions to confirm before implementation

The V1/V2 coexistence decision is confirmed. The remaining V2 defaults should be reviewed during Phase 0 before code changes:

1. **Primary tabs:** Today, Schedule, Attendance, Tasks, More.
2. **Tomorrow:** a segment inside Today rather than a permanent bottom tab.
3. **Assignments + Exams:** one Tasks destination with an internal segment.
4. **Announcements:** bell plus a More entry, with a promoted tab only when Attendance is disabled.
5. **More:** a full V2 mobile page; V2 retains a compact `...` menu for interface version and shell settings.
6. **Bottom bar:** stable, edge-attached, labeled, and never auto-hidden.
7. **Version coexistence — confirmed:** keep V1 and V2, with a shared Mobile interface selector in the `...` menu of both.
8. **V1 navigation preference:** retain top/bottom/both inside V1 only; V2 uses its defined bottom tabs.
9. **Tablet portrait:** retain its current tablet treatment unless separately approved for the phone shell.

## 14. First implementation slice after approval

The safest first build slice is:

1. Create the mobile tokens and the isolated `MobileAppBar`, `MobileTabBar`, and `MobileMorePage` components.
2. Render the new shell only at phone widths when the saved Mobile interface preference is V2; otherwise render V1.
3. Map Today, Schedule, Attendance, Tasks, and More to existing `view` state without altering feature internals.
4. Add the V1/V2 selector to the `...` menu in both shells.
5. Add navigation, feature-gate, bidirectional version-switch, Back, and accessibility tests.
6. Review both mobile versions on real iOS and Android devices plus the desktop regression matrix.

Only after that shell is accepted should the Today screen and other feature pages be redesigned.

## 15. Implementation progress — 2026-09-10

The first V2 build slice is now implemented locally:

- V1 remains the default and is preserved in full.
- The shared mobile `...` menu now offers **V1 · Classic** and **V2 · Modern**.
- The selection is stored independently at `pgp2.mobile-ui-version`.
- V2 supports the existing Light, Dark, and System appearance setting.
- V2 has five labeled bottom destinations, including Attendance feature-gate fallback behavior.
- Today/Tomorrow, Week/Full timetable, and Assignments/Exams use phone-scoped segmented controls.
- V2 includes a full More hub with gated Campus, Tools, Personal, Settings, Support, Admin, and Account entries.
- V2 fixed surfaces share safe-area-aware spacing; V1 and all desktop breakpoints remain outside the new CSS scope.
- New V2 logic/component tests cover version restoration, interface options, appearance independence, tab mapping, labels, feature gates, and More-page reachability.

Verification recorded for this slice:

- Full Vitest suite: **350/350 passed** across 21 test files.
- All newly added V2 source/test files pass ESLint.
- Repository lint retains its pre-existing findings in `App.jsx`, `AdminDashboard.jsx`, `DesktopSidebar.jsx`, `Timeline.jsx`, `useSidebar.js`, and existing hook warnings; no new V2-file findings were introduced.
- An isolated Vite production compilation succeeded in `.local/mobile-v2-build` without running the snapshot-generating `prebuild` script.
- Signed-in browser/device visual QA is still required. The available computer-use environment exposed no browser surface during this implementation run.
