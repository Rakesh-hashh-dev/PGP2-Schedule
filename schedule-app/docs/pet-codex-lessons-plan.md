# Companion × Codex Pets — what to borrow

_Plan, 2026-10-14. Nothing implemented yet. Companion to [pet-companion-plan.md](pet-companion-plan.md)._

## Background

OpenAI's Codex desktop app shipped **Pets** (May 2026): an animated sprite that floats over the desktop and shows what the agent is doing. It has no XP, care or cosmetics — it is a **status indicator with a personality**.

The format is fixed (from the `hatch-pet` skill's `codex-pet-contract.md` / `animation-rows.md`):

- One atlas: **8 cols × 9 rows, 192×208 cells, 1536×1872**, PNG/WebP, transparent unused cells.
- Package: `~/.codex/pets/<id>/pet.json` (`id`, `displayName`, `description`, `spritesheetPath`) + `spritesheet.webp`.
- Rows ↔ agent states, each with per-frame durations:

| Row | State | Frames | Durations (ms) | Meaning |
|---|---|---|---|---|
| 0 | idle | 6 | 280, 110, 110, 140, 140, 320 | at rest; frame 0 = reduced-motion still |
| 1 | running-right | 8 | 120 ×7, 220 | dragged right |
| 2 | running-left | 8 | 120 ×7, 220 | dragged left |
| 3 | waving | 4 | 140 ×3, 280 | greeting / attention |
| 4 | jumping | 5 | 140 ×4, 280 | celebration |
| 5 | failed | 8 | 140 ×7, 240 | error |
| 6 | waiting | 6 | 150 ×5, 260 | blocked on the user |
| 7 | running | 6 | 120 ×5, 220 | working (not foot-running) |
| 8 | review | 6 | 150 ×5, 280 | done, ready to review |

Speech bubbles carry short status lines; clicking a talking pet lets the user reply.

**Where TermFlow already stands:** it is ahead on everything game-like (progression to Lv 20, devotion, hats/coats/neckwear, 22 moods, a timetable-driven mood ladder with a `because` reason in `moodExplainFor`). Luna is already a raster sprite pet in near-Codex geometry (192×210 frames, `idle`/`run-right`/`run-left`/`wave`/`jump`… strips, `still.webp`, pauses when hidden). What TermFlow lacks is **the pet telling you things**.

## Phase 1 — Speech bubble from `because` (do first)

**Why:** highest value, smallest change. `moodExplainFor` (`src/lib/pet.js:1053`) already produces the sentence ("Class starts in 12 minutes.", "Something is due today.") but it only appears inside `PetMoodSheet`.

**What:**
- Render a small bubble next to the greeting-chip pet showing `because` for the current mood.
- Show it on mood *change* and on app open, auto-dismiss after ~6 s; never re-show the same `{mood, because}` pair in a session.
- Tap on the bubble → contextual action:
  - `restless` / `focused` → open the class (Today view)
  - `determined` → open Assignments
  - celebration moments → open the pet page
- Respect the existing greeting-pets toggle and `prefers-reduced-motion` (bubble fades, no bounce).
- Tone rule from pet-companion-plan §2 still applies: never reproachful, never a nag about attendance.

**Touches:** `components/greetingPets.jsx` (chip mount), new `PetBubble` component, `styles.css` §pets. No data or backend change.

**Done when:** bubble shows the right reason for every mood in the ladder (unit-test the mood → action map), is dismissible, and never covers the chip on a 360 px screen.

## Phase 2 — App events drive moods (Codex's state mapping)

**Why:** Codex's pet reacts to what the *software* is doing; TermFlow's only reacts to the timetable. Wiring app events in makes the pet a status light students learn to read.

| Codex state | TermFlow trigger | Mood | Bubble |
|---|---|---|---|
| running | `handleSync` in progress (`syncing`) | `focused` (reuse) | "Checking the schedule…" |
| failed | refresh returned `_meta.status === "error"` | **new** `worried` | "Couldn't reach the schedule. Tap to retry." → calls `handleSync` |
| waiting | attendance unmarked after a class / unanswered poll / meetup invite | `curious` (reuse) or **new** `asking` | "Did you make it to SCA?" |
| review | new announcements / cancellation / Wrapped ready | `excited` (reuse) | "2 new announcements" |

**How:** feed these as short-lived moments through the existing slot — `petContext.moment` / `momentUntil` (`App.jsx:1860`), which already outranks the clock in `moodExplainFor`. Add `because` copy for each. Priority among simultaneous events: failed > waiting > review > running.

**Art cost:** reuse existing moods first. A new `worried` mood means drawing it for every pet (see the roster art question in pet-companion-plan §10) — decide that before adding new moods.

**Done when:** a failed refresh shows the worried pet + retry bubble, success clears it, and mood tests cover each trigger.

## Phase 3 — Atlas contract + `$hatch-pet` as the raster art pipeline

**Why:** Luna proves raster pets work; a single contract makes adding more cheap and resolves part of the "what art style" question without hand-drawing SVG for every pet.

**What:**
1. **One atlas per raster pet** instead of one webp per state — one request, one cache entry. Keep Luna's CSS `steps()` approach, switching to background-position over a grid.
2. **Per-frame durations** (array per state) instead of a single `durationMs`, so idle loops get the uneven "alive" timing.
3. **Import path:** generate new pets in Codex with `$hatch-pet` (8×9 atlas), then a script converts `spritesheet.webp` → TermFlow's asset JSON. Row → mood mapping:

   | Codex row | TermFlow mood(s) |
   |---|---|
   | idle | content, relaxed, cozy (and the still) |
   | running | focused |
   | waiting | restless, asking |
   | failed | worried, missing |
   | review | determined, curious |
   | jumping | celebrating, proud, hyped |
   | waving | reunion, greeting |
   | running-left/right | unused (no drag in TermFlow) |

4. **Fold Codex's QA rules into `npm run pet-sheet`:** no detached effects, no frame-to-frame size popping, idle must visibly move, same identity across rows, unused cells fully transparent.

**Caution:** the 2026-10-07 Luna motion refit was reverted ("seems messed"). Change one thing at a time — format first with identical visuals, timing second.

**Done when:** Luna renders identically from an atlas, and one new pet goes from `$hatch-pet` to the roster through the converter with no hand edits.

## Not taking

- **Always-on-top overlay** — impossible for a PWA; Glance + badge already cover "check without opening".
- **Directional run rows** — exist for dragging the overlay; no use here.
- **Student-hatched pets** — ~10 image generations per pet plus moderation risk.
- **Anything progression-related** — Codex has none; TermFlow is already ahead.

## Open questions

- New moods (`worried`, `asking`) vs. reusing existing ones — depends on the roster-wide art decision.
- Should Phase 2 bubbles be allowed to repeat across sessions (e.g. unmarked attendance) or once per day?
- Licensing: only use `$hatch-pet` output we generate ourselves, not community PetShare/PetDex pets.
