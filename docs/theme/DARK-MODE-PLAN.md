# Dark Mode Plan — PGP2 Schedule (TermFlow)

_Drafted 2026-07-12. Status: not started._

## Current state (audited)

- Plain CSS, no Tailwind. One core stylesheet ([src/styles.css](../schedule-app/src/styles.css), ~9k lines) + 8 feature stylesheets in `src/styles/`.
- **Token system already exists** in `:root` (styles.css:1-31): `--bg, --surface, --card, --card-hi, --border, --border-hi, --text, --muted, --live, --amber, --violet, --blue` + legacy `--ink, --bone, --line`. This is the right foundation.
- **But ~600 hardcoded hex values and ~1,100 raw `rgba()` calls bypass the tokens.** Per-file counts (hex / rgba / var uses):

  | File | Hex | rgba() | var() |
  |---|---|---|---|
  | styles.css | 415 | 793 | 942 |
  | friends.css | 61 | 135 | 113 |
  | exams.css | 41 | 113 | 120 |
  | fullschedule.css | 44 | 33 | 144 |
  | assignments.css | 39 | 34 | 106 |
  | compare.css | 5 | 42 | 116 |
  | ui.css | 7 | 7 | 37 |
  | admin.css / cmdk.css | 0 | 6 | 56 |

- **Subject palette**: `.subj-0`…`.subj-9` (styles.css:3086-3095), each sets `--subj` (solid accent), `--subj-bg` (tinted chip), `--subj-border`, `--subj-deep` (4.5:1 text on tint). All light-tuned; needs a dark counterpart set.
- **Time-of-day background themes**: `body.theme-morning/afternoon/evening/night` set `--bg-start/mid/end` gradient stops, applied in App.jsx:888-894. All four are light palettes.
- **Settings pattern**: localStorage keys `pgp2.*` (e.g. `pgp2.sidebar-style`); profile menu already hosts settings entries — natural home for the theme toggle.
- **PWA chrome**: `theme_color: '#15182B'` in vite.config.js:93 and `<meta name="theme-color">` in index.html:54.
- Clerk runs `clerkJSVariant="headless"` with a custom Login component — no Clerk-hosted UI to theme (verify no `<UserProfile/>`-style components are mounted anywhere).

## Approach

**Strategy: `html[data-theme="dark"]` overrides the existing `:root` tokens.** No new CSS files per theme, no class churn in components. The bulk of the work is a one-time sweep converting hardcoded colors to tokens — which also pays off for any future theming.

Theme setting: `light | dark | system`, stored as `pgp2.theme`, `system` resolving via `prefers-color-scheme`.

## Phase 1 — Infrastructure (small, ship first)

1. **Dark token block** in styles.css:
   ```css
   html[data-theme="dark"] {
     --bg: #101216;        /* pick a warm-neutral dark to match the ivory brand, not pure black */
     --surface: #16181E;
     --card: #1C1F26;
     --card-hi: #22252E;
     --border: #2A2D36;
     --border-hi: #3A3E4A;
     --text: #E8E6DF;
     --muted: #9BA0AE;
     --ink: #E8E6DF;  --bone: #101216;  --line: #2A2D36;
     /* accents: brighten for dark bg — e.g. --live #2FC68A, --amber #E0A044, --violet #8B7AE8 */
     color-scheme: dark;    /* native form controls, scrollbars */
   }
   ```
   `--live-dim/--amber-dim/--violet-dim` become higher-alpha equivalents (dark tints need more alpha to read).
2. **Flash-of-wrong-theme guard**: tiny inline script in `index.html` `<head>` that reads `pgp2.theme` + `matchMedia` and sets `data-theme` before first paint.
3. **React hook** (`useTheme` in App.jsx or a small lib file): state + localStorage + `matchMedia('(prefers-color-scheme: dark)')` listener for `system` mode; writes `document.documentElement.dataset.theme`.
4. **Toggle UI**: three-way control (Light / Dark / System) in the profile dropdown next to "Notification settings" / "Edit setup"; optionally a quick sun/moon button in the header.
5. **Dynamic `theme-color`**: update the meta tag from the hook (`#15182B` stays fine for dark; use `#F3F1EA` for light so the status bar matches — note the current light app ships a dark theme-color already, decide intentionally).
6. **Time-of-day gradients**: in dark mode, replace the four `theme-*` gradient sets with dark equivalents (e.g. scope them `html[data-theme="dark"] body.theme-morning { … }` with subtle dark-warm → dark-cool stops). Keep the 2s transition; it's a nice touch worth preserving.

After Phase 1 the app is functionally dark — but with hundreds of hardcoded light colors still glaring. Phases 2–3 fix that.

## Phase 2 — Core sweep: styles.css

The 415 hex + 793 rgba in styles.css break down roughly into:

- **Near-token duplicates** (`#FFFFFF` cards, `#E4E0D5`-ish borders, `#1A1C2A`-ish text): replace with the matching `var(--…)`. Largest and most mechanical bucket.
- **White/black alpha overlays** (`rgba(255,255,255,.x)`, `rgba(0,0,0,.x)`): introduce two utility tokens `--overlay-hi` / `--overlay-lo` (or use `color-mix(in srgb, var(--text) N%, transparent)` — `color-mix` is already used in this codebase, so it's safe).
- **Shadows**: dark surfaces don't show black shadows. Add `--shadow-1/-2/-3` tokens; in dark mode reduce shadow strength and lean on `--border` + slightly lighter surface (`--card-hi`) for elevation instead.
- **Subject palette dark variants**: add a `html[data-theme="dark"]` block re-declaring `.subj-0`…`.subj-9`: keep `--subj` hues but lift lightness ~10%, make `--subj-bg` a low-alpha tint of the hue (~15-18%), `--subj-border` ~30%, and swap `--subj-deep` to a *light* readable tone (it's used as text on the tinted bg — recheck 4.5:1 contrast for all 10).
- **True one-offs** (gradients, hero, aurora sidebar): handle case-by-case with scoped `html[data-theme="dark"]` overrides rather than forcing everything into tokens. The "classic" sidebar is already dark — it may need almost nothing, or a border to separate from the dark page.

## Phase 3 — Feature stylesheets

Same sweep applied per file, one PR-sized chunk each, in order of visibility:
1. `fullschedule.css` (main schedule grid — most-used view)
2. `friends.css` (heaviest offender: 61 hex / 135 rgba)
3. `exams.css`
4. `assignments.css`
5. `compare.css`, `ui.css`, `admin.css`, `cmdk.css` (mostly tokenized already — quick)

Also sweep **inline styles in JSX** — grep `style={{` across components for color literals (Hero, TermFlowLoader, WeekGlance are likely spots).

## Phase 4 — Polish & edge cases

- **PWA manifest** `background_color`/`theme_color` are build-time and can't switch per user; keep dark-friendly values (`#15182B` works for both).
- **Images/logos**: check webp/png assets for baked-in light backgrounds; add `html[data-theme="dark"] img.needs-invert { … }` only where required.
- **Onboarding, WhatsNew, MigrationBanner, FeedbackWidget, toasts** — small components easy to miss; do a full click-through of every route in dark.
- **Skeletons/loaders** (TermFlowLoader): shimmer colors need dark variants.
- **Contrast audit**: spot-check with Lighthouse/axe on the dashboard, schedule, and friends pages in dark mode — the `-dim` tints and muted text are the usual failures.
- **Verify Clerk**: confirm no mounted Clerk UI components; if any exist, pass `appearance={{ baseTheme: dark }}` from `@clerk/themes` conditionally.

## Sizing & order

| Phase | Effort | Ships standalone? |
|---|---|---|
| 1 — infra + toggle | ~half a day | Yes (behind the toggle; dark will look rough) |
| 2 — styles.css sweep | 1–2 days (biggest) | Yes |
| 3 — feature CSS | ~1 day total | Per-file |
| 4 — polish | ~half a day | Yes |

Recommendation: build Phase 1 + 2 together on a branch before showing anyone dark mode; Phases 3–4 can land incrementally since each file sweep is independent. Test protocol per repo convention: run dev server, user verifies in browser before any commit.
