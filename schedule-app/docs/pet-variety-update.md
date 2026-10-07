# Companion variety update

Status: FINALIZED — implementation approved by the user on 2026-10-07.

The collection now has 21 companions. Hoot is a small strategy owl with glasses;
Byte is a mint robot with arms and feet; Pebble is a baby tortoise; Prickle is a
hedgehog. The lion was subsequently redrawn as a golden cub with a rounded copper
mane, cream muzzle and paws, soft eyes and a tufted tail. Its `cinder` key and
Devotion 4 unlock remain intact.

New companions unlock at Devotion 1 (Hoot), 2 (Pebble), 3 (Byte and Luna), and 4 (Prickle).
Nova remains at 2 and Lion at 4. Multiple companions may share a tier. The
combined `DEVOTION_COMPANIONS` list drives collection, roadmap and recent-unlock
counts. The singular legacy `unlockedAtDevotion` lookup retains its old contract.
The existing term-balance tests rejected the initial tier-6 placement because it
arrived at 92% of the modelled term; all companions now meet the original bounds.

Every companion has at least three signature actions and alternate expressions.
Quiet moods restrict energetic actions. Idle actions use varied 18–46 second
gaps, last up to 1.8 seconds (1.92 seconds for Luna), avoid the previous action, and pause when the page
is hidden. Care interrupts idle actions and resets the clock. Cohort motion-off,
signature-off and live OS reduced-motion preferences are respected. No XP rates,
saved-state schema or database migrations change.

Local verification commands:

- `npm.cmd test`
- `npx.cmd vite build --outDir .local/pet-variety-build --emptyOutDir`
- `node scripts/pet-browser-check.mjs`
- `node scripts/pet-sheet.mjs --pet cinder --out .local/lion-mood-sheet.png`

The browser script renders offline previews from the real artwork and CSS in an
isolated Chromium profile, measures exact desktop/390px viewports, and checks
motion-off and reduced-motion animation names. It writes screenshots and its
full report under `.local/`. It does not use the signed-in production application.

Prickle was subsequently redesigned with a domed back and short quills, a
cream pear-shaped face, glossy eyes, tiny feet and paws, and a mint collar.
Its `prickle` key, existing unlock and sniff/curl/uncurl actions stay intact.

Luna uses the supplied `../luna all-states.gif` artwork. Its 114 frames are split
into nine transparent WebP sprite strips: idle, run right, run left, wave, jump,
rest, wait, think and review. Embedded captions and the pale backdrop were
removed; the source GIF is preserved. The prepared assets, including a still
pose, total 1,001,158 bytes. `scripts/prepare-luna.py` reproduces them.

Mood selects Luna's baseline state, signature actions override it, and care
reactions take priority over both. Petting waves, playing jumps, and treats use
the waiting pose. Wardrobe placement follows each state. Motion-off,
signature-off and OS reduced motion display the still pose; hidden tabs pause
the strips. Luna retains the existing companion adoption and progress contracts.

Final validation: 46 test files and 453 tests passed; targeted ESLint and the
production build passed. Offline browser checks covered desktop and 390px
layouts, care priority, actual frame advancement, still fallback and reduced
motion. Screenshots and `.local/pet-browser-report.json` record the results.
