# Companion movement pilot

Prepared against release 7.7.0, commit `670a9e505fa9500788f214bb2f9e10b8fdadb862`.

Fox, Mochi, Ember and Nimbus use a visual-only animation director on the Companion
page and daily greeting. Other companions retain their existing beat clock.
The current 32-pet registry, unlock gates, XP ledger, storage, renamed identities,
Luna artwork, and shared eye/detail system are preserved.

Nimbus is now a lavender moon moth with feathered antennae, wing eye spots and
a gold crescent. It retains `nimbus`, its name and its Devotion 3 gate.

## Runtime

`petDirector.js` owns one active action and two cancellable timers. Priority is
care > celebration > touch > context > idle. An interrupt discards the previous
action rather than queuing it. Care uses the existing app feedback and never
awards additional XP. Repeated care restarts from a fresh interaction token.

Actions last 1800ms: anticipation at 0–18%, movement at 18–72%, then recovery to
the authored rest pose. Idle gaps are 18–46 seconds with no consecutive repeat
when alternatives exist. Quiet moods filter out busy gestures. Class and exam
context listens; deadlines prompt a proud pose; sleep context settles down.

`usePetPerformance` starts/stops the engine for visibility, reduced motion,
pet changes and unmount. Spontaneous-gesture settings leave care and deliberate
touch available. Motion off disables all movement. Offscreen CSS pauses parts.

## Artwork and attachments

The pilot extends the current `pet-art` canvas and `PetEyes`, with independent
head, chest, feet, tail or wing groups. Hat anchors use the same head transform;
neckwear follows the chest. Per-pet wardrobe offsets remain intact. Small badges
omit texture and animation at 32px and below. Existing growth scales remain;
hatchlings have a slightly larger head and elder/ascended pets reveal markings.

Pointer hits on head, body, tail and wings have distinct visual reactions.
Keyboard activation of the hero says hello; existing care buttons remain the
accessible way to pet, play and treat. Greeting activation still opens its tray.

## Review

```sh
npm ci
node scripts/companion-upgrade-preview.mjs
npx vitest run src/lib/petDirector.test.js src/components/companionArt.test.jsx src/components/greetingPets.test.jsx src/components/petNewCollection.test.jsx src/lib/petPersonality.test.js src/lib/pet.test.js src/lib/petEconomy.test.js src/lib/petInsights.test.js src/lib/petStorage.test.js
npx vite build
```

Open `.local/companion-upgrade.html`. It bundles the real components and runtime
hook into an offline preview, including care, context, wardrobe, growth and
motion controls. No sign-in or application data is used. `esbuild` is declared
as a pinned development dependency for reproducible preview generation.

Validation: 9 suites / 252 tests, targeted lint, production Vite/PWA build.
Offline Chromium checked all four pets, repeated IDs and paint references,
care priority, exact head/hat transform agreement, motion-off and reduced-motion
guards, and 390px layout. Desktop, dark and mobile renders were inspected.

This is a four-pet pilot, not a rig conversion for the whole roster. Pair
interactions are deferred. No database migration or production deployment is
included. A signed-in smoke test is still needed for release.
