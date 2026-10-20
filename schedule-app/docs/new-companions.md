# Six new TermFlow companions

Native SVG adaptations of Maple, Ember, Mochi, Nimbus, Sable and Inky, prepared
against main commit `42ace7c2d7e7903b5e40d635f9595ded41d1c98d`.

The detailed raster concepts have been simplified into the app's layered,
32-unit illustration format. These are scalable, CSS-animated characters;
they are not animated versions of the original bitmap paintings.

| Saved key | Label | Character | Unlock | Signature beats |
| --- | --- | --- | --- | --- |
| maple | Maple | Red panda | Devotion 1 | Tail curl, paw rub, ear listen, glance |
| mochi | Mochi | Capybara | Devotion 1 | Slow stretch, nose twitch, tuck, glance |
| inky | Inky | Octopus | Devotion 2 | Wave, paddle, wiggle, float |
| nimbus | Nimbus | Cloud spirit | Devotion 3 | Float, wave, dreamy blink, sway |
| sable | Sable | Snow leopard | Devotion 4 | Tail flick, groom, ear listen, down-dog |
| ember | Ember | Baby dragon | Devotion 4 | Flutter, proud pose, head tilt, yawn |

## Integration

- `petNewCollection.jsx` contains six native components, with addressable eyes,
  faces, tails/arms/wings, expression variants and removable accessories.
- `greetingPets.jsx` registers them alongside the existing 25 companions.
  Every existing consumer of `getPetByKey` or `PETS` can render the new entries.
- `pet.js` adds six entries to the multi-companion devotion registry.
  Existing level gates, starters, XP rates, the level cap, earned items and
  account progress remain intact. Existing holders receive new choices when
  they satisfy the relevant tier. No additional XP currency is introduced.
- `petPersonality.js` provides four existing, supported beats per companion.
  Quiet mood filtering, care priority, hidden-tab cancellation and signature
  settings continue to use the existing hooks and motion watcher.
- `styles.css` adds three low-specificity signature animation classes before
  the existing motion guards. `pet-personality.css` adds wearable anchors.
- All 22 moods, pet/play/treat expressions and five growth stages reuse the
  current app's CSS and state model. Growth changes scale/eye proportions;
  it does not replace the pet with a different illustration.
- Wardrobe hats, eyewear, neckwear, coat filters, accessory hiding, sleep cues
  and the second companion slot use the current contracts. The second slot
  retains its existing Devotion 5 requirement.
- Gradient IDs use React `useId`, so multiple instances do not collide.
- `capybara` remains a legacy alias for Axolotl. Mochi uses the new key
  `mochi`; no saved pet identity is reassigned.

The inspected database migrations store pet keys as text and unlocks as JSON;
they do not enumerate allowed companion keys. This change needs no schema
migration. Normal storage round-trips and public summaries retain the new keys.

## Preview and validation

From `schedule-app`:

```sh
node scripts/new-companion-preview.mjs
npx vitest run src/components/greetingPets.test.jsx src/components/petNewCollection.test.jsx src/lib/pet.test.js src/lib/petPersonality.test.js src/lib/petEconomy.test.js src/lib/petInsights.test.js src/lib/petStorage.test.js
npx eslint src/components/petNewCollection.jsx src/components/petNewCollection.test.jsx src/components/greetingPets.jsx src/lib/pet.js src/lib/petPersonality.js src/lib/petPersonality.test.js scripts/new-companion-preview.mjs
```

Open `.local/new-companions.html`. It contains 414 instances showing the new
collection, 17/32/64px icons, every mood, growth stages, signature actions,
care overrides, every hat and neckwear item, and motion guards. Toggle the
hero motion and light/dark presentation. The preview uses production artwork
and CSS without signing in or reading/writing application data. Its bundler
dependency is the same `esbuild` used by the existing pet preview scripts.

Validation completed:

- 7 targeted Vitest suites, 228 tests passed; targeted ESLint passed.
- The preview's pet bundle compiled successfully with esbuild.
- Offline Chromium rendered all 414 instances without script errors or
  duplicate gradient IDs. Every gradient reference resolved.
- No horizontal overflow at 1200px or 390px widths.
- Motion-off, signature-off for active beats, and live OS reduced-motion
  checks reported zero running animation names on guarded elements.
- Care joy expressions replaced sleepy expressions; neckwear hid baked-in
  accessories; growth resolved to .8/.89/1/1.07/1.1 at the five stages.
- All 24 new personality beats had active animation rules. Existing term
  economy tests passed with the new unlock tiers.
- Light, dark and mobile previews were visually inspected.

Limits: this is an isolated source integration and offline rendering check.
The authenticated live page could not be reconnected for this run. A full
application production build, live multi-device synchronization and deployment
were not performed. Review the draft PR, then run normal repository CI and a
signed-in smoke check before release. All client surfaces should update in
the same release so old clients do not fall back to Cat for unfamiliar keys.

Rollback: revert this PR's source changes. If any new pets have already been
selected in production, retain their artwork/registry entries while retiring
their unlocks, or explicitly migrate those selections before removing them.
