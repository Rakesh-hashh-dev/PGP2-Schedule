# Mobile V2 Premium Polish Roadmap

## Purpose

This document defines the next UI/UX improvements for TermFlow Mobile V2. The goal is to make the interface feel refined, cohesive, and native on both iOS and Android without changing the desktop experience or the existing Mobile V1 theme.

The premium direction should come from consistency, restraint, responsive feedback, and careful information hierarchy—not from adding more decoration.

## Design principles

1. **Clarity before decoration** — every visual effect must improve hierarchy, navigation, or feedback.
2. **One visual system** — cards, controls, icons, typography, spacing, and motion should follow shared rules.
3. **Native mobile behaviour** — respect safe areas, gesture navigation, touch targets, scrolling, and reduced-motion preferences.
4. **Restrained depth** — use glass, shadows, gradients, and colour only where they communicate layering or state.
5. **Fast and stable** — loading should not cause layout jumps, and animations should remain smooth on mid-range Android devices.
6. **V2-only scope** — all new styling must remain scoped to Mobile V2 at phone widths. Mobile V1 and desktop must remain unchanged.

## Priority 1: Context-aware app bar

Create a consistent top app bar for every V2 page.

### Recommended behaviour

- Show one stable page title and remove duplicate headings inside individual pages.
- Use consistent 40–44 px action buttons.
- Slightly reduce the app bar height after the user scrolls.
- Introduce a subtle border or elevation only after content passes behind it.
- Keep important actions visible while moving secondary actions into the overflow menu.
- Correctly handle the iOS status-bar inset and Android display cutouts.

### Acceptance criteria

- Every primary page begins on the same horizontal content axis.
- No page displays the same title twice.
- Header actions do not wrap at 320 px width.
- Header content remains readable with long page titles and large text settings.

## Priority 2: Unified typography

Use a small, intentional mobile type scale.

| Role | Suggested size | Guidance |
|---|---:|---|
| Page title | 20 px | Strong but compact |
| Card title | 15–16 px | Medium or semibold |
| Body | 13–14 px | Comfortable mobile reading |
| Supporting text | 12–13 px | Lower contrast, not excessively small |
| Metadata | 11–12 px | Dates, rooms, timestamps, status labels |

### Additional guidance

- Avoid making every label bold.
- Use weight and colour to create hierarchy before increasing size.
- Keep line heights generous enough for long course and assignment names.
- Use tabular numerals where changing times, counts, or percentages need stable alignment.

## Priority 3: Unified card system

Announcements, schedule, attendance, assignments, exams, and More should look like parts of the same product.

### Shared card rules

- Use one primary corner radius and one compact radius.
- Standardize border opacity for light and dark themes.
- Use consistent horizontal padding and vertical rhythm.
- Reserve stronger elevation for overlays and floating content.
- Avoid placing gradients, glass, shadows, and bright borders on the same card.
- Keep semantic colours limited to states such as live, warning, danger, and success.

### Acceptance criteria

- Cards align with the shared V2 gutter.
- Adjacent cards use consistent spacing.
- Light and dark versions have equivalent hierarchy and contrast.
- Content does not overflow with long subject names or timestamps.

## Priority 4: Directional motion system

Motion should explain what changed rather than simply decorate the screen.

### Recommended transitions

| Interaction | Motion |
|---|---|
| Bottom-tab navigation | Short fade with a 4–6 px rise |
| Open a detail page | Subtle right-to-left movement |
| Return to the previous page | Reverse directional movement |
| Open a bottom sheet | Upward spring-style entrance |
| Change a segmented control | Smooth active-state movement |
| Press a control | Restrained scale and colour response |

Use approximately 180–260 ms for routine transitions. Avoid large bounce effects, animated gradients, or motion on every list item.

### Accessibility and performance

- Disable non-essential motion when `prefers-reduced-motion` is enabled.
- Animate opacity and transforms instead of layout properties.
- Avoid heavy blur animation on mid-range Android devices.
- Prevent animation from delaying navigation or touch response.

## Priority 5: Premium loading states

Replace generic full-page spinners with stable skeleton layouts.

### Recommended coverage

- Today and Tomorrow schedule
- Attendance summary
- Announcements feed
- Assignments and exams
- Friends and shared schedules
- Pet profile data

Skeletons should match the approximate final layout, preserve page height, and avoid shimmering aggressively. A subtle static or low-motion highlight is sufficient.

## Priority 6: Better empty and error states

Empty states should remain compact and useful.

### Examples

- **No classes tomorrow:** show weather, free-time context, and the next useful action.
- **No announcements:** confirm that the user is caught up and provide calendar access if relevant.
- **No assignments:** show the next exam or academic milestone when available.
- **Offline:** preserve cached content and clearly explain which actions require connectivity.
- **Failed refresh:** keep existing content visible and offer a small retry action.

Avoid oversized illustrations that push useful information below the fold.

## Priority 7: Refined touch feedback

- Maintain at least 44 × 44 px touch targets for important controls.
- Use small press-scale feedback without exaggerated bouncing.
- Use colour or surface changes to confirm selection.
- Consider optional light haptics for high-value actions such as recording attendance.
- Never rely on hover-only feedback for mobile controls.

## Priority 8: Light and dark surface tuning

Do not use identical glass opacity and shadow values in both modes.

### Light mode

- Use slightly more opaque glass surfaces.
- Keep shadows soft and neutral.
- Ensure borders remain visible over white or pale content.

### Dark mode

- Use brighter, low-opacity borders.
- Reduce large dark shadows that disappear into the background.
- Avoid pure black cards against pure black backgrounds.
- Confirm that muted text and inactive navigation icons meet accessible contrast levels.

## Priority 9: Tomorrow briefing hero

Turn the Tomorrow summary into one focused day-briefing card.

### Suggested information hierarchy

1. Tomorrow label, date, and weather
2. First class and start time
3. Total classes and finishing time
4. Compact visual timeline of the day
5. Schedule-change warning, when relevant

The hero should align with the timeline below it and avoid splitting related information across several competing cards.

## Priority 10: Pet placement

Use a two-level placement strategy.

### Primary placement

Keep the full Pet experience under **More → Personal**. This is the appropriate location for pet details, customization, progress, and longer interactions.

### Contextual placement

Show a small companion beside the Today greeting or current-class hero. The pet can respond to meaningful context such as:

- a free day;
- a long schedule;
- attendance milestones;
- an upcoming exam;
- completion of the final class of the day.

Do not add a sixth bottom-navigation tab or a permanent floating pet button. Both options would overcrowd primary navigation and compete with schedule actions.

## Priority 11: Microcopy and naming

- Use the same label for the same destination throughout the app.
- Shorten labels only when mobile space requires it.
- Prefer direct action labels such as “Add to calendar,” “Mark read,” and “View schedule.”
- Keep status messages short and specific.
- Review punctuation, capitalization, date formatting, and empty-state tone as one system.

## Priority 12: Device and accessibility QA

Test the completed V2 experience under the following conditions:

- 320 px, 360 px, 390 px, and 430 px viewport widths;
- iPhone home indicator and safe-area insets;
- Android gesture navigation and three-button navigation;
- Android Chrome and installed PWA mode;
- iOS Safari and installed PWA mode;
- light, dark, and system appearance;
- large text and display zoom;
- long names, course titles, and announcement timestamps;
- slow network, offline mode, and cached content;
- reduced-motion mode;
- keyboard opening over search fields and bottom sheets.

## Recommended implementation sequence

### Phase 1 — Foundation

1. Context-aware app bar
2. Unified typography tokens
3. Shared card and spacing tokens
4. Light/dark surface tuning

### Phase 2 — Interaction quality

1. Directional page transitions
2. Bottom-sheet and segmented-control motion
3. Touch feedback and optional haptics
4. Reduced-motion verification

### Phase 3 — High-value screens

1. Tomorrow briefing hero
2. Today contextual pet placement
3. Announcements refinement
4. Loading, empty, error, and offline states

### Phase 4 — Final QA

1. Small-phone responsive audit
2. iOS and Android safe-area audit
3. Light/dark/system contrast audit
4. Slow-device animation and blur performance audit
5. Accessibility and keyboard audit

## Recommended next implementation batch

The highest-impact next batch is:

1. context-aware app bar;
2. unified typography and card tokens;
3. directional page transitions;
4. redesigned Tomorrow briefing hero.

These changes will improve the perceived quality of the entire Mobile V2 interface while preserving its current navigation structure and avoiding unnecessary visual complexity.
