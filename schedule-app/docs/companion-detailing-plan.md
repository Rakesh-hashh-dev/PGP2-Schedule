# Companion Detailing and Personality-Based Eyes Plan

Date: 2026-10-28  
Status: Implemented locally — verification results recorded below

## Objective

Improve the detailing and cuteness of all 32 companions while giving each pet eyes and expressions that suit its personality. Preserve each companion's identity, existing interactions, and saved progression.

## Current system

The roster uses shared eye rendering and species-specific artwork. Eyes already vary in size and colour, but mostly use the same pupil, highlight, and eyelid formula. The upgrade will give each companion a more distinct face alongside richer body details.

Implementation discovery: Luna now uses the shared vector rig. The older raster assets are unused by the live companion component. Her current vector wolf receives the same personality-eye refinement, plus attached species details.

## 1. Make the eyes express personality

Extend `src/components/PetEyes.jsx` with adjustable eye shapes, pupil proportions, eyelids, catchlights, and brows.

| Personality | Companions | Proposed eye treatment |
| --- | --- | --- |
| Affectionate | Dog, Bunny, Hamster | Rounded puppy eyes, large pupils, soft highlights |
| Clever and mischievous | Fox, Raccoon, Maple, Sable | Gentle almond shapes, playful brows, sideways curiosity |
| Calm and cozy | Panda, Koala, Sloth, Capybara, Mochi | Relaxed upper lids, warm pupils, soft sleepy expressions |
| Curious and lively | Chick, Penguin, Otter, Spark | Bright, open eyes with lifted brows |
| Shy and gentle | Pebble, Prickle, Axolotl | Soft oval or bead eyes, subtle pleading expression |
| Confident and friendly | Lion, Frost, Dragon, Ember | Defined upper lids softened by rounded pupils |
| Dreamy | Unicorn, Nimbus, Leafy | Luminous irises, delicate reflections, gentle lids |
| Digital | Rover, Byte | Expressive rounded display eyes and distinct pixel highlights |

Cat will keep its warm amber gaze and slow-blink character. Inky will get playful, rounded eyes. Each pet will receive individual proportions within these directions.

These are proposed visual directions informed by the existing personality actions, rather than new gameplay personality categories.

Acceptance criteria:

- Each vector companion has deliberately selected eye proportions and styling.
- Eyes look cute and distinct at both greeting and Companion-page sizes.
- Pupils remain inside the eye boundary during gaze movement.
- Existing blink, gaze, and animation hooks continue to work.

## 2. Add meaningful species details

Refine existing artwork with details that strengthen identity:

- **Fur:** layered cheek tufts, inner-ear shading, muzzle depth, paw pads, and clearer tail markings.
- **Feathers and wings:** overlapping feather shapes, wing edges, soft chest plumage, and translucent moth-wing accents.
- **Scales and shells:** restrained scale clusters, shell segments, belly plates, and horn highlights.
- **Other surfaces:** axolotl gill fronds, octopus suckers, leaf veins, robot panel seams, and antenna details.

Keep the strongest details readable at the small greeting size. Use finer accents to enrich the larger Companion view. Follow the existing anatomy, lighting direction, and visual language.

Primary files:

- `src/components/PetDetail.jsx`
- `src/components/PetDesignDetail.jsx`
- The roster artwork modules listed in section 4

Acceptance criteria:

- Every companion receives species-appropriate refinement.
- Details remain attached to the correct head, body, or limb during animation.
- Small-scale silhouettes and faces remain clear.

## 3. Carry personality through expressions

Update `src/components/PetExpression.jsx` so happy, curious, focused, surprised, and sleepy faces retain each pet's eye shape. Coordinate eyes with the mouth, cheeks, and brows.

Preserve pupil movement boundaries, blinking, and care reactions. Keep care reactions ahead of idle personality actions.

Acceptance criteria:

- Expression changes retain the companion's facial identity.
- Eyelids, brows, pupils, and mouths align correctly in each supported expression.
- Care actions and existing personality movements continue to behave correctly.

## 4. Apply the upgrade across the complete roster

Update all existing companions through these artwork modules:

- `src/components/greetingPets.jsx`
- `src/components/petExtras.jsx`
- `src/components/petLateRoster.jsx`
- `src/components/petNewCollection.jsx`

Use the shared eye, expression, and detail components, with supporting changes to `src/styles/pet-art.css` and `src/styles/pet-personality.css` where needed.

### Luna

Refine Luna's current vector wolf with gentle ice-blue eyes and attached ear, cheek, chest, and tail details. Preserve her crescent marking, silhouette, gaze, howl, wardrobe, and shared motion controls. Leave the legacy raster assets unchanged.

### Implementation order

1. Refine the shared eye and expression components using representative companions: Dog, Fox, Sloth, and Byte.
2. Apply individual eye styling and species detailing across the entire vector roster.
3. Complete Luna's vector wolf artwork refinement.
4. Inspect the complete roster together and resolve inconsistencies.
5. Complete visual and technical verification.

## 5. Verify the result

Use the existing full-roster preview tooling to compare companions at **40px and 160px**.

Visual checks:

- Light and dark themes.
- Desktop and phone layouts.
- Expressions, blinking, gaze, and moving body parts.
- Hats, scarves, growth details, and care animations.
- Reduced-motion and motion-off modes.
- Luna's attached wolf detailing, gaze, howl, and care expressions.

Technical checks:

- Run relevant companion tests, including roster, expression/rig, personality, and progression coverage where affected.
- Run targeted lint on changed files.
- Run the production build.
- Run `git diff --check`.
- Capture rendered screenshots as evidence of the visual result.

Use `scripts/companion-preview.mjs` and `scripts/pet-browser-check.mjs` where compatible with the current roster. Ensure the preview includes every current companion and displays the correct roster count.

## Preservation requirements

- Keep saved companion identities and stable keys, including Lion's `cinder` key.
- Preserve roster ordering and legacy-key mappings.
- Preserve unlocks, XP, progression, and saved data.
- Preserve wardrobe compatibility and growth details.
- Preserve care-action priority and existing interactions.
- Preserve reduced-motion, motion-off, hidden-tab, and off-screen behaviour.
- Preserve unrelated working-tree changes.

## Definition of done

- All 32 companions have been reviewed and refined with personality-appropriate eyes and meaningful detailing.
- The complete roster looks coherent while each companion remains recognisable.
- Visual checks pass at greeting and detail sizes, across themes and motion settings.
- Relevant tests, lint, build, and diff checks pass, with any limitations reported explicitly.
- The work remains local unless committing, pushing, or deployment is separately requested.

## Implementation and verification record

- Added `src/lib/petFaces.js` with explicit illustration profiles for all 32 saved companion keys.
- Refined `PetEyes.jsx` with personality contours, larger pupils, iris reflections, catchlights, digital highlights, and instance-specific gaze clipping.
- Matched expression coordinates and dimensions to each companion's eye sockets throughout the roster.
- Added `PetSurfaceRelief.jsx` for species-specific filled details, highlights, and restrained texture; refined Luna's current vector artwork directly.
- Updated offline preview counts, included the current rig stylesheet, and replaced obsolete Luna sprite checks with vector checks.
- Companion tests: **16 files / 403 tests passed**.
- Targeted source and preview-tool ESLint: **passed**.
- Production build: **passed**. Vite reported an existing mixed static/dynamic import warning for `splitCloud.js`.
- Whitespace verification: `git diff --check` **passed**.
- Offline browser verification: **all 15 cases passed**, including desktop, phone, light/dark themes, reduced motion, care priority, wardrobe attachment, hidden/off-screen pausing, and all 32 application-page previews.
- Each of the four full-roster browser cases covered **5,920 state/size combinations** with zero geometry findings, missing references, duplicate IDs, or overflow. Both mood sheets rendered **704 tiles**.
- Visually reviewed the complete 40px/160px contact sheet and final light, dark, and phone captures. No detached markings or facial collisions found. This is offline rendering of application components and CSS, not authenticated production QA.

Local review artifacts:

- Interactive preview: `.local/companion-preview.html`
- Contact sheet: `.local/companion-detail-sheet.png`
- Final theme/phone captures: `.local/companion-companion-light.png`, `.local/companion-companion-dark.png`, `.local/companion-companion-phone.png`, `.local/companion-companion-reduced.png`
- Browser report: `.local/pet-browser-report.json`

All work remains local. No commit, push, deployment, or saved companion data changes were made.
