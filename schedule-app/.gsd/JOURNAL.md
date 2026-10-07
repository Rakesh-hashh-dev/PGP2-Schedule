# Verification journal

## 2026-10-07 — Companion variety and lion redesign

User-approved scope: add Hoot, Byte, Pebble and Prickle; extend movements and
expressions for existing companions; redesign Lion after the user's follow-up.

- `npm.cmd test`: 45 files passed; 450 tests passed.
- Targeted ESLint on changed companion components, helpers, tests and preview
  scripts: exit 0, no errors or warnings.
- Production Vite build to `.local/pet-variety-build`: passed; PWA assets generated.
- Exact browser viewport checks: roster 1250px (168 previews), lion 1250px
  (14 previews), phone 390px (168 previews), and companion page 390px.
  All had no horizontal overflow. Motion-off previews had 0 running animations.
- OS reduced-motion case: 0 running animations across 168 previews.
- Inspected browser screenshots for the full roster, lion expressions/actions,
  new companions, wardrobe and phone companion page.
- `pet-sheet`: 1 lion x 16 moods rendered to `.local/lion-mood-sheet.png`.

Evidence: `.local/pet-browser-report.json`, `.local/pet-qa-roster.png`,
`.local/pet-qa-lion.png`, `.local/pet-qa-phone.png`, `.local/pet-qa-reduced.png`,
`.local/pet-qa-page-phone.png`. Previews use actual component art and CSS;
authenticated production interaction was not part of these offline checks.

Existing saved identities and progress retain their contract. No Git commit,
push or deployment was requested. Concurrent changes outside companion files
were preserved.

## 2026-10-07 — Prickle redesign and Luna asset review

Prickle now has a domed quill-covered back, cream pear-shaped face, clearer
nose, tiny paws and mint collar. Its saved key, Devotion 4 unlock and action
profile are preserved; wardrobe offsets follow the new face position.

- Targeted tests: 2 files passed, 26 tests passed.
- ESLint for `petExtras.jsx`: exit 0.
- Actual browser preview: 14 Prickle face/action/wardrobe tiles at 1250px;
  inspected `.local/pet-qa-prickle.png`.
- Roster and exact 390px previews: no overflow, 0 motion-off animations.
- Reduced-motion roster: 0 running animations across 168 previews.

Luna asset review only: `../luna all-states.gif`, 192 x 232 pixels, 114 frames
at 120ms/frame (13.68 seconds), 2,343,075 bytes, looping, no GIF transparency.
Frame contact sheet shows embedded state captions and an opaque pale backdrop.
The asset can be integrated after preparing clips/sprites for the individual
states, cleaning those baked-in presentation elements, and adding a static
motion-off pose plus raster-specific wardrobe placement. Luna was not added
by this review. Source file preserved. Evidence: `.local/luna-contact-sheet.png`.

## 2026-10-07 — Luna integration

User authorized adding the reviewed asset. Luna is now the 21st companion,
unlocking at Devotion 3 alongside Byte. All 114 supplied frames are retained in
nine transparent WebP strips, with captions removed and a separate still pose.
Prepared assets total 1,001,158 bytes. Source SHA256 remains
`f35720b660377ab8aa3a43c96a7c78764b3a78f81340ed404dedd812342fcd36`.

- `npm.cmd test`: 46 files and 453 tests passed.
- Targeted ESLint: exit 0.
- Production Vite build to `.local/pet-variety-build`: passed; all ten Luna assets
  copied into the build output.
- Isolated Chromium checks: desktop roster (187 tiles), Lion, Prickle, Luna,
  exact 390px Luna/roster/companion page, and reduced-motion Luna/roster passed.
  No horizontal overflow; motion-off and reduced motion had 0 running animations.
- Browser confirmed pet/play/treat care priority over mood and signature actions,
  actual sprite frame advancement, and exclusive still display with motion off.
- Inspected `.local/pet-qa-luna.png` and `.local/luna-mood-sheet.png` for supplied
  artwork, transparent backdrop, mood poses, running directions and wardrobe.

Evidence: `.local/pet-browser-report.json`, `.local/pet-qa-luna.png`,
`.local/pet-qa-luna-phone.png`, `.local/pet-qa-luna-reduced.png`,
`.local/luna-mood-sheet.png`. These are offline component/CSS previews;
authenticated production interaction was not tested. Changes remain local.
