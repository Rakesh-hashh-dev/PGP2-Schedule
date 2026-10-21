# Companion movement system — complete roster

Prepared against release 7.7.0, commit `670a9e505fa9500788f214bb2f9e10b8fdadb862`.

All 32 registered companions use the visual-only animation director on the
Companion page, daily greeting, buddy slot and cameos. Every species has an
explicit personality profile; no registered pet falls back to the legacy clock.
The current 32-pet registry, unlock gates, XP ledger, storage, renamed identities,
Luna artwork, and shared eye/detail system are preserved.

Nimbus is now a lavender moon moth with feathered antennae, wing eye spots and
a gold crescent. It retains `nimbus`, its name and its Devotion 3 gate.

## Species coverage

`petProfiles.js` defines four supported actions and a calm cadence per companion.
Examples include grooming and paw waves, robot scans, gill ripples, leaf
unfurling, penguin waddles, wolf howls, hamster nibbles and dragon wing stretches.
Quiet contexts filter busy actions. Each profile is checked against actual SVG
anatomy; the preview has a Show gesture button per pet.

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

The movement system extends the current `pet-art` canvas and `PetEyes`, with independent
body frames, heads, paws, tails, wings, gills and antennae where present. Hat anchors use the same head transform;
neckwear follows the body frame. Per-pet wardrobe offsets remain intact. Small badges
omit texture and animation at 32px and below. Existing growth scales remain;
hatchlings have a slightly larger head and elder/ascended pets reveal species-appropriate fur, feather, scale, circuit,
leaf or sparkle markings. These follow each pet’s head.

Pointer hits on head, body, tail and wings have distinct visual reactions.
Keyboard activation of the hero says hello; existing care buttons remain the
accessible way to pet, play and treat. Greeting activation still opens its tray.

## Review

```sh
npm ci
node scripts/companion-upgrade-preview.mjs
npx vitest run src/lib/petBuddy.test.js src/lib/petDirector.test.js src/components/petRigRoster.test.jsx src/components/companionArt.test.jsx src/components/greetingPets.test.jsx src/components/petNewCollection.test.jsx src/lib/petPersonality.test.js src/lib/pet.test.js src/lib/petEconomy.test.js src/lib/petInsights.test.js src/lib/petStorage.test.js
npx vite build
```

Open `.local/companion-upgrade.html`. It bundles the real components and runtime
hook into an offline preview, including care, context, wardrobe, growth and
motion controls. No sign-in or application data is used. `esbuild` is declared
as a pinned development dependency for reproducible preview generation.

Validation: 11 suites / 325 tests, targeted lint, production Vite/PWA build.
Offline Chromium checked all 32 pets / 128 instances and all 128 signature actions, repeated IDs and paint references,
care priority, head/hat transform and pivot agreement for every pet, motion-off and reduced-motion
guards, and 390px layout. Desktop, dark and mobile renders were inspected.

The complete roster and paired social gestures are covered. Habitat scenes are
a separate feature. No database migration or production deployment is included.
A signed-in smoke test is still needed for release.

## Smooth transitions

`usePetTransitions` captures the rendered SVG-part transforms before a director
state change. After React commits the next action, additive Web Animations
corrections decay to identity over 180ms while the new CSS action keeps running.
This preserves the outgoing pose instead of jumping to rest. It works on the
body, head, limbs and matching wearable anchors across all 32 pets. Repeated
interruptions sample the current blended pose. Finished/old blends are cancelled;
removed pets, unmount, reduced motion and motion-off cannot leave stale blends.
The Companion hero stays mounted through care, preserving focus and continuity.

Offline Chromium sampled a head during an interrupted listening gesture: the
first blended treat pose matched the previous transform exactly (matrix delta 0).
Motion-off and reduced-motion checks include active Web Animations, not only CSS.

## Buddy interactions

`useBuddyInteraction` coordinates the existing Companion-page primary and buddy
through `petBuddy.js`. They exchange glances and anatomy-appropriate greetings,
and stagger shared celebrations. The explicit Say hello together button is
keyboard accessible. Each pet's director remains the authority: buddy cues sit
below class context, touch, celebration and care; care cancels pending replies.
A cared-for companion gets a gentle acknowledgement from its buddy.

Automatic exchanges have fresh 32–64-second gaps after recovery. Class, exam,
sleep and tired contexts stay quiet; deliberate greetings in those contexts use
only glances. Turning off spontaneous gestures cancels automatic pair work while
leaving deliberate greetings available. Hidden pages, reduced motion, motion-off,
pet changes and unmount cancel both actors' delayed cues. No XP or state writes
are introduced. Pure tests cover all 1024 pair combinations, priority and timer
cancellation. The offline preview includes both partner selectors and care.

## Habitat phase

The companion page now includes a Habitat tab and a shared decorative stage for
all 32 companions and their buddies. Quiet garden, Study nook and Star terrace
are available immediately. Plant, books, lantern and cushion toggle independently.
Lighting follows local device time (06:00–17:59 daylight) or can be fixed to day
or night. The page's existing `now` clock resolves automatic lighting.

`petHabitat.js` owns validation, defaults and time resolution. The structured
`cosmetics.habitat` value is normalized alongside old cosmetic records and saved
through the existing `setCosmetic` / local cache / JSONB RPC path. Old records
receive garden + automatic light + plant/cushion. XP, unlocks and care are
independent. No schema migration or external image asset is required.

Scenery is native SVG without IDs, input handlers or animation loops. A palette
transition respects both reduced motion and the companion motion setting.
Actors keep the existing movement/transition/buddy hooks; no pet is remounted on
scene changes. `scripts/habitat-preview.mjs` builds an offline fixture using the
actual PetPage and cosmetic transforms. Its local fixture saves are separate
from the app account; the preview never connects to production services.

## Habitat interactions

Every companion can respond to plant, books, lantern, cushion and sky targets.
`petHabitatInteraction.js` chooses an anatomy-aware local gesture, a small
spatial visit and a short activity description. Nimbus follows a lantern arc,
Leafy unfurls toward the plant, and Byte/Rover scan objects. Other responses
use their existing species gestures. Cushions invite a doze and a body settle;
buddies settle alongside or glance toward a discovery after 550 ms.

The Habitat director schedules occasional 45–85 second visits, avoiding the
previous target. Sleepy/tired/cozy moods first settle after 4.5 seconds when a
cushion is present. Focus and exam contexts suppress automatic visits and keep
manual exploration quiet. Spontaneous-off still permits deliberate taps.
Every interaction is visual: no care, XP, unlock or storage mutation occurs.

The shared pet director accepts habitat cues below buddy/context priority and
manual taps at touch priority. Care cancels position, gesture and pending
buddy replies. Scene/decor changes, pet/buddy switches, hidden tabs and motion
preferences cancel old cues and timers. A new gap starts on resumption.
Native 44px buttons over the visible decorations provide pointer, touch and
keyboard access, with an activity status beside the companion's name. Removed
decorations have no button. Reduced motion/motion-off keeps a static scene.
The pose blender also samples the actor's translation so an interrupted Nimbus
flight returns smoothly while the care gesture takes over.

## Companion memory and evolving bonds

The memory journal is independent of `pet_state`, cosmetics, care and XP.
`companionMemory.js` validates immutable events and derives favourites, pair
familiarity, return greetings and small discoveries for the full roster.
Intentional exploration contributes one observation per pet/target/local day;
a favourite emerges after three distinct days. Pair familiarity counts one
shared day at a time, regardless of which pet is primary. Familiar (3 days)
and old-friend (7 days) pairs use expanded greeting routines. Neither measure
has decay, a streak requirement or a reward quota.

The habitat scheduler weights a remembered favourite while still avoiding an
immediate repeat. Focus and motion rules continue to apply. Rare discoveries
are deterministic per pet/day/target, with at most one discovery per pet/day.
They produce a small SVG moment and can be saved by choice. The Journey tab's
Memory album preserves the primary/buddy names, caption, discovery and habitat
at save time; later renames or companion switches do not rewrite an album card.

Returns after an observed class or time away get a short welcome. App records
observed class context even when the companion page is closed. Opening the
page and resuming after an absence record a visit; ordinary clock ticks do
not. Quiet returns remain gentle and all animation uses the existing shared
priority/motion controls.

Persistence is account-bound local storage plus the new append-only
`companion_memory_events` table. Apply
`supabase/migrations/20261021120000_companion_memories.sql` in the Dashboard SQL
Editor before the cloud release. The repository's existing instruction says
not to use `db push`. The migration adds a table, required-payload constraints,
self-only SELECT/INSERT RLS policies and privileges. It does not modify the
pet-state RPC, XP ledger or friend visibility. Cloud inserts ignore duplicate
IDs; merging is a set union. Pending local events survive reloads, retry after
network/migration failures, and reconcile on reconnect or foregrounding.

The album accurately shows "Saved on this device" until cloud sync succeeds.
Storage failure is reported as unsaved. Accounts get separate journals and
session moment state is also bound to its owner. A signed-in two-device smoke
test is required for the cloud release.

### Coordinated daily routines

All 32 companions and their buddies share one habitat routine controller.
Observed class time and the ten minutes before class choose a quiet book-side
visit. From 18:00 the pair gathers by the lantern; from 22:00 until 06:00 they
settle on the cushion. Device-local time matches the existing habitat lighting.
Decorations are optional: missing objects fall back to an available favourite
or a quiet sky spot. Between classes, remembered favourites weight exploration
and familiar buddies are more likely to greet. Celebration moments keep their
own choreography.

The Habitat tab's Schedule-based routines checkbox persists through existing
cosmetic storage. Manual habitat, head-touch, care and buddy interactions hold
automatic routines for 90 seconds. Pause 10 min and Resume routine are available
beside the habitat. Quiet pairs arrive with a familiarity-dependent delay, using
the existing animation transitions and care priority. Hidden tabs, reduced
motion and spontaneous-gesture settings continue to control automatic movement.
There is no additional cloud schema, XP change, care penalty or streak.

Validation: 17 companion suites / 389 tests, production Vite/PWA build, ESLint,
and actual-page browser checks for study, evening, bedtime, paired settling,
manual override, pause/resume, persistent opt-out and 390px mobile layout.


### Luna and the dressing room

Luna is a midnight moon wolf with a silver mask/ruff, teal eyes, moon marking
and a curled silver-tipped tail. The persisted luna key and all shared movement,
expression, growth and wardrobe anchors remain. Legacy sprite mood offsets are
removed so hats retain their fit while she rests or howls.

The wardrobe now has a responsive outfit preview and full-pet item cards for
all 23 headwear pieces, six neckwear pieces and nine coat finishes. Hover/focus
is a temporary visual preview; intentional selection equips an owned item.
Independent slots, existing unlock gates and cohort restrictions remain. The
catalogue includes keyboard category navigation, visible wearing states and an
Unlocked only filter. All wearable artwork gains local, uniquely identified
paint servers for shaded surfaces; outlines, highlights and geometry remain
crisp. Coat tinting uses a common tonal base for consistent colour families
across differently coloured species. No schema, XP or stored item-key changes.
