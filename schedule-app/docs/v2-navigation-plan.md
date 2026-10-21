# PGP2 V2 navigation plan

Status: implemented locally. Navigation behavior, nine responsive viewport cases, saved sidebar state, focus return, rotation, dark appearance and reduced motion were verified in an isolated browser; the production build and focused navigation tests passed.

## Objective and completion criteria

V2 users can identify a nested page and return to its parent. Landscape-tablet users can visibly expand and collapse the sidebar without reducing the usable schedule width. Existing desktop preferences, feature gates, navigation side effects and user-owned working-tree changes remain intact.

Discovery: level 0. Reuse React, Lucide, the existing state hooks and CSS; no dependency, API or database changes.

## Current evidence

- V2 is active only at widths <=1200px (src/hooks/useMobileUiVersion.js).
- Phone and portrait-tablet layouts use More and the bottom navigation. Landscape tablets hide the More page and bottom navigation (src/styles/mobile-v2.css).
- src/hooks/useSidebar.js forces sbCollapsed with isTablet || sidebarCollapsed.
- src/components/DesktopSidebar.jsx excludes the toggle with !isTablet.
- Courses detail already returns through onSelectCode(null); Split group detail returns through its existing onBack callback.
- App.jsx and several unrelated application/server files have pre-existing edits. Inspect the latest target diffs before implementation; preserve those edits.

## Design decisions

1. Add one low-emphasis navigation row above the page heading. Use existing surface/text tokens and Lucide chevrons.
2. Show breadcrumbs on secondary pages and nested Courses/Split details; keep Today, Schedule, Attendance, Tasks and More landing free of duplicate navigation.
3. Phones show the immediate parent as a labelled back link. Portrait tablets show More > page > selected item where applicable. Landscape tablets show page > selected item; do not link to More, which is hidden in that layout.
4. More returns to the More landing without triggering a different underlying view. Courses clears the selected course; Split returns to its workspace using the existing callback. Breadcrumbs reflect hierarchy, independent of entry through a shortcut or search.
5. Render one row per page. Let detail screens supply their labels/actions to the same breadcrumb component; suppress the app-level row there. Replace their existing V2 back controls with the shared row. Retain existing controls for V1.
6. Fit long labels with truncation and retain their full accessible text. Parents are buttons with real actions; the current item is non-interactive and marked aria-current=page. Touch targets are at least 44px.
7. Landscape tablets default to the existing icon rail. A visible, touch-friendly Expand sidebar button opens the full navigation panel over the page, preserving the rail's reserved width. The expanded panel has a visible Collapse sidebar button and backdrop.
8. Use a separate V2 tablet preference (proposed key pgp2.v2-tablet-sidebar). Do not overwrite the desktop pgp2.sidebar preference. Close the panel after a navigation selection, Escape, backdrop activation or leaving the landscape-tablet tier; retain the remembered preference for reloads in that tier.
9. The overlay supports focus containment, focus return to its opener and an appropriate dialog label. Existing navigation remains inside it. Phone/portrait navigation continues using the current header and dock.

## Plan 1: Shared breadcrumbs and detail integration

Wave: 1. Depends on: none. Autonomous when implementation is requested.

### Task 1: Shared row and secondary-page wiring

Files:
- src/components/mobile/MobileV2Breadcrumbs.jsx (new)
- src/lib/v2Breadcrumbs.js (new)
- src/App.jsx
- src/styles/mobile-v2.css

Action: Create a reusable responsive breadcrumb renderer and small view-to-label mapping. Insert the row ahead of secondary-page content and pass the existing navigation callbacks. Suppress it on root pages, More landing, comparison views and detail screens that own a row. Check landscape orientation as well as width before exposing a More action. Preserve unread/badge and comparison-reset behavior by using the existing navigation entry points. Do not build history-based breadcrumbs: shortcut entries must produce the same hierarchy.

Verify: targeted ESLint; interaction checks for More -> secondary page -> More, direct shortcut entry and hidden feature gates. Check there is never a link to a hidden landscape More page.

Done: each supported secondary page has one usable parent action and root pages have no redundant row.

### Task 2: Courses and Split detail wiring

Files:
- src/components/CourseHub.jsx
- src/components/SplitPage.jsx
- src/components/split/SplitWorkspace.jsx
- src/App.jsx

Action: Thread a V2-only navigation context into the nested screens. Reuse the shared renderer with the actual course/group label and existing return callbacks. The app suppresses its overview row while these detail rows are active. Handle loading, invalid/deleted selections and long names; clear any transient detail registration on view changes/unmount so a previous group's name cannot leak into another page. Keep the existing V1 back controls.

Verify: open a course from Courses and a dashboard shortcut; return to the course list. Open a Split group normally and through its deep link; return to the workspace and verify filters/state behave as before. Change views and verify the previous detail label disappears.

Done: course/group parents return to their real overview, only one navigation row is present, and no stale label survives a view change.

## Plan 2: Tablet sidebar controls and final verification

Wave: 2. Depends on: Plan 1. Autonomous when implementation is requested.

### Task 1: Sidebar state and overlay controls

Files:
- src/hooks/useSidebar.js
- src/components/DesktopSidebar.jsx
- src/App.jsx
- src/styles/mobile-v2.css

Action: Introduce V2 landscape-tablet state separately from the desktop preference. Remove the forced-collapse behavior only for this supported V2 mode. Render a tablet toggle that stays visible in both states; expand the existing sidebar as an overlay while keeping the page's rail offset stable. Support both Classic and Aurora widths/spacing. Add backdrop, Escape, focus management and close-on-navigation. Scope styling to V2 tablet landscape so desktop/V1 state and portrait navigation retain their contracts. Do not simply enable the existing desktop-width panel in the flex layout: it would shrink the main column and week panel.

Verify: toggle in both sidebar styles; navigate from the open panel; dismiss by button, backdrop and Escape; reload in each saved state; rotate and resize across 767/768 and 1200/1201px. Verify the desktop preference stays unchanged and page/modal controls remain accessible after closing.

Done: landscape V2 tablets always expose an operable control, expanded navigation is readable and dismissible, and opening it causes no horizontal overflow or content-width compression.

### Task 2: Validate the complete navigation change

Files:
- src/components/mobile/MobileV2Breadcrumbs.test.jsx (new, only if needed for parent-action behavior)
- src/hooks/useSidebar.test.js (new or extend if present, for independent tablet/desktop preferences)

Action: Add focused behavior coverage for real navigation/state risks rather than appearance assertions. Run the existing mobile navigation tests, targeted ESLint, Vite build and git diff --check. Compare the working tree with the pre-change baseline. Inspect rendered authenticated pages at phone widths 320/390px, portrait tablet 768/1024px, landscape tablet 1024/1180/1200px and desktop 1280px. Check Light/Dark/System, both sidebar styles, keyboard navigation, reduced motion and long names.

Commands:
- npm.cmd test -- src/components/mobile/MobileV2TabBar.test.jsx src/components/mobile/MobileV2MorePage.test.jsx src/hooks/useMobileUiVersion.test.js (plus new focused tests)
- npx.cmd eslint <changed JavaScript/JSX files>
- npx.cmd vite build --outDir .tmp-v2-navigation-build --emptyOutDir
- git diff --check

Done: behavior checks and build pass; rendered checks establish no overflow, duplicate rows, unreachable controls or desktop/V1 changes. If authenticated visual inspection is unavailable, explicitly report it as unverified rather than marking visual acceptance complete.

## Delivery boundary

This document records the implementation plan and its completed local verification. The code is included in the PGP2 Git release. Supabase deployment and installed-device Android notification acceptance remain separate release steps.
