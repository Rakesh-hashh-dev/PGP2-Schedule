# Companion artwork review

The local artwork pass covers the existing 24 editable SVG companions and Luna. Stable identity keys, registry order, progression, unlocks and selection rules are preserved.

## Changes

- Shared expressive eyes with restrained iris/pupil highlights, lids and pupil-only gaze.
- Species details, contact shadows and subtle paint gradients; connected head/body groups and bounded ear, wing and tail pivots.
- Mood posture and colour remain active. Happy open eyes, celebration, focus, sleep and care have distinct expression channels.
- Crowns follow breathing, pondering, focus and care head motions; robot antennas stay attached to the head.
- Motion-off and reduced-motion stop artwork and wardrobe animations, transitions and hover/focus tilts. Hidden/offscreen pets pause; removed pets are released from the observer.
- Luna retains its original nine poses, 114 frames, frame dimensions and 120ms timing. Soft alpha edges are preserved exactly; colour WebP quality 90 keeps total assets at 1,034,172 bytes. Luna remains raster artwork.

## Review artifacts

- [Interactive full-roster preview](../.local/companion-preview.html): theme, mood, detail size, gesture, care, wardrobe, motion, freeze/replay, pointer gaze and application-page selection. Greeting sample is 40px; detail samples are 48/96/116/160px.
- [Light mood sheet](../.local/pet-qa-moods-light.png) and [dark mood sheet](../.local/pet-qa-moods-dark.png): 25 companions x 22 moods at 48px in the actual browser renderer.
- [Light Luna frames](../.local/luna-114-light.png) and [dark Luna frames](../.local/luna-114-dark.png): all 114 decoded frames.
- [Browser report](../.local/pet-browser-report.json) and [Luna report](../.local/luna-visual-report.json).

Regenerate from the project root with `node scripts/companion-preview.mjs`, `node scripts/pet-browser-check.mjs`, or `python scripts/luna-visual-check.py`. Generated artifacts are ignored/local and should be regenerated after moving the checkout.

## Verification

- Vitest: 60 test files, 589 tests passed. Added regressions cover persisted roster ordering, repeated SVG IDs/references and attached eyes/expressions/antennas.
- Targeted application and Node preview-script ESLint passed.
- Production Vite build passed into `.local/companion-polish-build`, including PWA precaching, without the public-data prebuild generators. Existing Split dynamic-import/plugin-timing warnings remain.
- Browser checks cover desktop and 390px phone, both themes, all moods at 48/96/116/160px plus 40px greeting samples, the 69 gesture selectors and four care actions. Each full-roster sweep renders 4,025 state/size combinations and all 25 application-page heroes. No broken/duplicate SVG references or out-of-canvas geometry at the checked 550ms poses.
- Motion-off/reduced-motion, keyboard focus tilt, signature-off, care priority, wardrobe head synchronization, Luna frame advancement, actual IntersectionObserver pause and hidden-page pause are checked.
- Luna: all 114 decoded alpha channels match preparation exactly; maximum per-frame mean colour difference from compression is 2.716 out of 255.
- `git diff --check` passed.

These are offline component/CSS renders in an isolated browser, not authenticated production interaction QA. Page templates render the real PetPage component; the preview controls do not persist application data and page buttons are static. Geometry sampling is at 550ms, not a proof of every possible in-between animation frame.

Changes remain local and uncommitted. Unrelated sheet.js, sheet.test.js, vite.config.js and pet-codex-lessons-plan.md were preserved.
