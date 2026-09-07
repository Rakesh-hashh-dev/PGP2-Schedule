# Pet Companion — refine & revamp plan

Status: **plan only, no code written** (2026-09-04)
Supersedes the decorative "pet of the day" shipped in `6e35905`.

Decisions taken with the user up front:

| Fork | Decision |
| --- | --- |
| Ownership | **Adopt one, it grows.** A named companion that levels up from real app activity. |
| Scope | **Full page.** Cloud-backed from Phase 1 — see §3 for why this changed from "local-only first". |
| Social | **Friends can see your pet.** |

> **Revised 2026-09-04 (same day):** the original plan deferred Supabase to Phase 4. A storage
> audit (§3) showed capacity was never the constraint but *durability* is, so the table moves
> into Phase 1 and the phase order below reflects that.

---

## 1. Where we are

The current feature is an ornament, not a feature:

- `src/components/greetingPets.jsx` — 12 hand-drawn inline SVGs, plus `getPetOfTheDay()`:
  an FNV-1a hash of the local date modulo `PETS.length`. **Zero storage, zero ownership** —
  every student sees the same pet on the same day, by design.
- `src/components/DayGreeting.jsx` — the pet renders beside the greeting. Clicking opens a tray
  with **Pet / Play / Treat**, which pick a random flavour string and set `data-reaction` for
  ~1.15s. Nothing is remembered; closing the tray wipes even the last line.
- `src/styles.css:1287-1398` — idle breathe/blink/ear/tail/wing animations, per-pet
  `--pet-accent` / `--pet-turn` tokens, a `prefers-reduced-motion` kill switch.
- Config: admin `sysConfig.flags.greetingPets` (`enabled` / `mode: daily|featured` / `petKey` /
  `motion`, defaults at `AdminDashboard.jsx:280`); per-user opt-out in
  `localStorage["pgp2.greeting-pets-enabled"]` (`App.jsx:408`).

**What's missing to make it a real feature:** ownership, persistence, progression, a reason to
come back, a surface bigger than a 38px button, and any connection to what the student
actually does in the app.

**What we should keep:** the art (it's good and CSP-safe — no external assets), the
reduced-motion discipline, the admin kill switch, the user opt-out, and the deterministic
`dayKey()` helper.

## 2. The target model

The pet is a **mirror of real app activity**, not a tap-farm. This is the single most important
design decision in the document, and the thing that separates a pet feature that lasts a term
from one abandoned in a week.

- **XP comes overwhelmingly from things the student was going to do anyway** — marking
  attendance, clearing a deadline, keeping an open-the-app streak. Care taps (pet/play/feed)
  give a small, **daily-capped** trickle. You cannot grind a level by mashing a button.
- **Mood is derived, never stored.** A pure function of (last interaction, today's care actions,
  current streak, time of day). Derived state cannot desync or get corrupted.
- **Decay is soft and never punishing.** The pet gets *sleepy*, *bored* or *misses you* — it
  never gets sick, never starves, never dies, and never loses a level. Term breaks, exam weeks
  and dead phones are normal in a campus app. Guilt mechanics would make this feature a
  liability, not a delight.
- **No pay-to-win, no dark-pattern pushes, no "your pet is dying" notification.** Ever.

### Progression sketch

```
Adopted: "Mochi" the Fox · Lv 4
[========--] 340 / 500 XP
Mood: content · last seen 2h ago · 6-day streak

Today
  Marked 3/3 classes ............ +30 XP
  Cleared 1 deadline ............ +20 XP
  Care (2/3 daily) .............. +4 XP
```

Levels unlock the **roster** (the other 11 pets become adoptable) and **cosmetics**. Both are
nearly free to build — see §5.

## 3. Storage audit — why this is cloud-backed

Measured, not estimated.

| Item | Size |
| --- | --- |
| `pgp2-feed-cache` (schedule payload) | **185 KB** — from the prod `schedule_cache` backup |
| Heaviest user's attendance, ~4 weeks | 88 marks → ~400/term ≈ **16 KB** |
| Pet record + 400-entry ledger | **~15–20 KB** |
| Flags, dismissals, prefs (~50 keys) | a few KB |
| **App total** | **~250–400 KB** against a ~5 MB per-origin budget |

**Capacity is a non-issue** — the pet costs ~0.4% of quota. But **durability is the real
constraint**, and it is what a local-only pet fails:

1. iOS Safari's ITP evicts script-writable storage after ~7 days without a visit (browser-tab
   users; home-screen installs are treated separately). A term of progression can vanish over a
   mid-term break.
2. Every storage reader in this app swallows quota/blocked errors and returns an empty default.
   That is correct for a **cache** and wrong for **progression that cannot be re-derived**.
   Attendance survives it because it re-syncs from cloud; a local-only pet has nothing to
   re-sync from.
3. New phone, cleared site data, shared laptop → pet gone, with no recovery path.

**But not cloud-*only*.** Pure server state breaks offline use (campus wifi) and paint latency —
the pet sits in the greeting, above the fold on every `today` load, and cannot wait on a network
round trip. The shape is **cloud as source of truth, localStorage as cache + write buffer**, and
both halves already exist in this repo: `attendance.js:70` for local-first merge, and a real
offline mutation queue at `expenses.js:552-580` (`pgp2.split.queue`).

**Cloud-side cost is negligible:** one row per user. Profiles average 719 bytes; a pet row is
~250 bytes plus a bounded ledger. Even at a few hundred students that is well under a megabyte
against a 500 MB tier.

## 4. Data model

`pet_state` is the source of truth; `localStorage["pgp2.pet"]` is its cache and write buffer.
Both hold the same shape, so the mechanics in `lib/pet.js` never learn which one they are on.

```js
// pet_state row / localStorage["pgp2.pet"]   — as built in src/lib/pet.js
{
  v: 1,
  petKey: "fox",          // must round-trip through getPetByKey() — see LEGACY_KEYS
  name: "Mochi",
  adoptedAt: "2026-09-04",
  baseXp: 120,            // XP folded in from pruned ledger entries
  awarded: {              // idempotency ledger: eventKey → [day, xp]
    "att:2026-09-04_10:00_SCM_A": ["2026-09-04", 10],
    "due:asg_18":                 ["2026-09-04", 20],
    "care:2026-09-04:1":          ["2026-09-04", 2],
  },
  care: { day: "2026-09-04", used: 1 },   // one budget shared by all actions
  lastSeen: 1757000000000,
  unlocked: ["cat", "dog", "bunny", "fox"],
  cosmetics: { accessory: true },
}
```

**XP is not stored.** It is `baseXp` plus the sum of the ledger, derived on read — the same
discipline as mood. A stored integer is exactly what desyncs after an offline stretch, with no
way to tell which copy is right; deriving it makes the two-device merge below deterministic.

The ledger is the load-bearing bit: XP is paid against a **stable key per real-world event**, so
re-syncing attendance, re-rendering, or un-marking and re-marking a class cannot double-pay.
**Bounded to a rolling 30 days** — an event older than the sync window can no longer newly
arrive, so its key only costs bytes in every row read. Pruning folds the dropped XP into
`baseXp`, so retention never costs progress.

Days use `ymd()` from `lib/datetime.js` (zero-padded, so the ledger prunes by string compare),
not the unpadded `dayKey()` in `greetingPets.jsx`.

**Write economics.** XP awards are chatty if written naively (three per class-marking session).
Coalesce: debounce the row upsert ~5–10s and force a flush on `visibilitychange` / `pagehide`.
One row per user means an upsert, never an insert-per-event — cheaper than attendance already is.

**Offline.** Writes that fail go through the same queue idea as
`expenses.js:569 enqueueOfflineExpense`, flushed on reconnect. The pet stays fully interactive
offline because the local copy is authoritative for rendering; the cloud is authoritative for
truth on next load.

**Conflict rule.** Two devices can both earn XP. Resolve by **union on `awardedKeys` and
recompute XP from the union**, rather than last-write-wins on the `xp` integer — LWW silently
discards a day's earnings from the other device. The ledger makes the merge deterministic; this
is the reason it exists in the cloud shape at all.

**Storage adapter** (`src/lib/petStorage.js`) exposes `loadPet()` / `savePet()` /
`syncPetFromCloud()` mirroring `src/lib/attendance.js:62-99` — that file is the house pattern for
local-first-then-merge.

**Key hygiene:** add `"pgp2.pet"` to `USER_SCOPED_KEYS` in `src/lib/appStorage.js:41-46`. Without
this, signing in as a different user on a shared laptop inherits the previous user's cached
companion before the cloud read lands.

## 5. Two free wins in the existing code

Worth calling out because they cut the art and backend budget dramatically:

1. **Moods cost almost no new art.** The SVGs already isolate every moving part into its own
   class — `.dg-pet-face`, `.dg-pet-eyes`, `.dg-pet-ear`, `.dg-pet-wing`, `.dg-pet-tail`,
   `.dg-pet-tuft`, `.dg-pet-accessory`. A `data-mood` attribute on the wrapper can retime and
   retarget those existing groups (droopy ears + slow blink = sleepy; fast tail + bounce =
   excited) purely in CSS, for all 12 pets at once. Cosmetics likewise: `.dg-pet-accessory` is
   already a separate group that can simply be toggled off.

2. **Friend visibility is nearly free once `pet_state` exists.** `src/lib/status.js:137-160`
   shows the established batch-fetch shape (one `.in("user_id", ids)` select over the friend
   cloud-ids). Pointing that at `pet_state` with a column-restricted authenticated-read policy
   gives friends' pets with no denormalization and no dual-write.

   **Rejected alternative:** stashing the pet in `profiles.courses->_pet` the way `_status` and
   `_away` are. It is tempting — zero migration, policy already live — but that trick is right
   for an ephemeral 30-minute status and wrong for durable progression: the whole `courses`
   JSONB gets rewritten by unrelated profile writes (a lost-update race on every course edit),
   and there are no column types or constraints to protect an XP total. Use it only if a real
   table proves impossible.

## 6. Phases

Each phase is independently shippable and independently revertable.

### Phase 0 — pure logic + tests ✅ DONE (2026-09-04)
`src/lib/pet.js` — no React, no storage, no I/O. Tuning lives in one `XP` constants block at the
top so balancing the feature is a one-line edit.

Shipped: `emptyPet` / `normalize` / `adopt` / `rename` / `switchTo`; `xpOf` / `xpToReach` /
`levelFor` / `levelProgress`; `award` + `keyFor` (ledger idempotency); `care` / `careLeft` /
`canCare`; `hoursSince` / `moodFor`; `unlockedAtLevel` / `unlockedFor` / `newlyUnlocked`;
`prune`; `mergePets`; `publicSummary`.

Curve: 100/150/200… per level, `MAX_LEVEL` 12 ≈ 3850 XP, which lands near the end of a term at a
normal ~40–50 XP/day. Roster: 3 starters at adoption, the other 9 unlock at levels 2–10.

**48 tests, suite now 160 green (was 112), eslint clean.** One test caught a real defect while
writing it: `award`/`prune` documented an object-identity guarantee (so React can bail out of a
re-render on the live clock tick) that `normalize` was silently breaking by always rebuilding.
Fixed with an `isNormalized` fast path rather than by relaxing the test.

### Phase 1 — adoption + persisted state (cloud-backed) ✅ BUILT (2026-09-04, unverified in browser)

Shipped: `20260904120000_pet_state.sql`, `lib/petStorage.js`, `hooks/usePet.js`, rewritten
`DayGreeting.jsx` (adopt-on-first-tap, level/XP bar, care budget, mood line), XP wiring in
`App.jsx` (attendance + daily streak) and `AssignmentsPanel.jsx` (deadline cleared), `pgp2.pet`
added to `USER_SCOPED_KEYS`, tray styles in `styles.css`. **172 tests green** (12 new for the
row⇄state mapping), lint clean on every touched file, build green.

Migration verified on a local Docker stack: RLS blocks cross-user read/insert/update, all three
check constraints reject bad input, the `updated_at` trigger overrides a client-supplied value,
`anon` is denied the friend RPC, and `get_friend_pets` returns
`TABLE(user_id, pet_key, name, level)` — structurally unable to leak XP or the ledger.

**Not applied to prod.** Also unverified in a browser — needs a signed-in pass.

⚠️ **Found while testing:** this repo's migration chain is *not* replayable from scratch.
`supabase migration up` skips `create_migration_map.sql` (no timestamp prefix), so
`20260709120000_prep_migration_bridge.sql` then fails on the missing `_migration_map` table.
Pre-existing and unrelated to the pet work, but it means local stacks can't be rebuilt from the
migrations folder until those files are renamed.

<details><summary>Original Phase 1 spec</summary>
- **Migration `pet_state`**: `user_id` PK, `pet_key`, `name`, `base_xp`, `adopted_at`, `unlocked`,
  `cosmetics`, `care` jsonb, `awarded` jsonb, `updated_at`. **No `xp` column** — it is derived
  (§4). RLS: self read/write; plus an authenticated read restricted to
  `(user_id, pet_key, name, base_xp)` for Phase 4.
- **Test the migration against a local stack first** — Docker is running and `supabase/config.toml`
  exists, so `npx supabase start` gives a real Postgres to apply and verify RLS against before
  anything touches prod. Nothing ships to prod until the whole feature is tested; then it all
  goes together.
- `src/lib/petStorage.js` — local cache + write buffer over the table, debounced upsert, offline
  queue, union-merge on conflict (§4).
- `src/hooks/usePet.js` — reads state, exposes `care(action)`, subscribes to XP sources.
- XP wiring at the call sites that already exist: attendance marks
  (`attendance.js:90 pushMark`), assignment completion (`assignments.js`), and an app-open
  streak tick. Each awards through a stable `awardedKeys` id.
- `DayGreeting.jsx` — the tray stops faking it. Real name, real level, a real XP bar, care
  buttons that persist and respect the daily cap. Pre-adoption, the button opens an **Adopt**
  prompt instead.
- **Opted-out and pre-adoption users keep exactly today's behaviour**, including
  `getPetOfTheDay()`.
</details>

### Phase 2 — the Pet page ✅ BUILT (2026-09-04, unverified in browser)

`components/PetPage.jsx` + `styles/pet.css`, lazily imported and registered in `TOOLS_VIEWS` /
`TOOLS_VIEW_META` (icon `PawPrint`, label "Companion"), with entries in the desktop sidebar's
Tools group and the mobile overflow Tools section, a `?view=pet` deep link, and `!IS_LITE` gating
everywhere the other tool views are gated (including the "Recent tools" filters).

Sections: habitat (large pet, mood copy, last-seen, XP bar), care row with the daily budget
spelled out, **"Where the XP came from"** (new pure `xpBySource` in `lib/pet.js`, 5 tests — the
parts always sum to the total, including pruned history as "Earlier"), the 12-pet roster with
locked slots showing their unlock level, and a details card (rename, accessory toggle).

The accessory toggle is the §5.1 "free win" cashed in: one shared rule
`.dg-pet[data-accessory="off"] .dg-pet-accessory { display: none; }` in `styles.css` covers the
greeting pet and the page at once, with no new art.

**177 tests green**, lint clean on every touched file. `PetPage` builds as its own lazy chunk —
6.41 kB JS / 2.25 kB gzip + 5.12 kB CSS — so the main bundle is unchanged. It is also emitted
into `dist-lite`, which matches how `SplitPage`, `BoardPage`, `WrappedView` and `AdminDashboard`
already behave there (every lazy chunk is emitted; nav gating and the `LITE_VIEWS` clamp make it
unreachable).

<details><summary>Original Phase 2 spec</summary>
New lazy view, following the Split/Wrapped precedent end to end:
- `const PetPage = lazy(() => import("./components/PetPage.jsx"))` alongside `App.jsx:38-55`.
- Register in `TOOLS_VIEWS` and `TOOLS_VIEW_META` (`App.jsx:82-88`), add the sidebar entry in
  `DesktopSidebar.jsx` next to Split/Wrapped, with the `beta-badge` "New" treatment.
- Gate with `!IS_LITE` everywhere the other tool views are gated (`App.jsx:2482-2521`) and keep
  it out of `LITE_VIEWS` — Lite exists to be small.
- Content: habitat scene with the pet at real size, stat panel (level, XP, streak, mood, "how it
  earned XP this week"), care actions, the roster with locked/unlocked states, cosmetics
  toggles, and a rename control.
</details>

### Phase 3 — mood & animation system ✅ BUILT (2026-09-04, unverified in browser)

Six moods, **no new keyframes and no new artwork.** `.dg-pet` now declares five mood knobs —
`--pet-ear-droop`, `--pet-eye-open`, `--pet-lean`, `--pet-aura`, `--pet-sat` (plus `--pet-dot`
for the presence dot) — and the *existing* keyframes read them. Each `[data-mood]` block just
moves the knobs and retimes the existing part animations. Twelve pets, six moods, one stylesheet
block; the knobs default to neutral so a pet with no mood renders exactly as before.

**The reduced-motion problem and its fix.** With `animation: none` every part sits at its neutral
pose, so all six moods would have looked identical. The knobs are therefore *also* applied as
static transforms (`.dg-pet-eyes`, `.dg-pet-ear-left/right`) plus a lean and desaturation on the
never-animated `<svg>`. A running animation overrides those, and the keyframes are built around
the same variables — so motion and no-motion can never disagree about which way the ears point.
Mood is additionally carried in **text** (the tray line and the page's mood copy), so it survives
even without colour or posture.

Crucially, mood rules only ever set `animation-duration`, never the `animation` shorthand, so the
reduced-motion guard's `animation: none` still wins. **A test asserts this** by parsing
`styles.css`, alongside guards that every non-baseline mood has a rule, that `content` stays the
un-overridden baseline, and that `moodFor` can't return a mood the CSS doesn't know.

**181 tests green**, lint clean, build green. CSS grew 250.5 → 253.2 kB (+0.5 kB gzip).

<details><summary>Original Phase 3 spec</summary>
`data-mood` / `data-state` on the pet wrapper driving the existing part classes (§5.1).
Full `prefers-reduced-motion` parity — every new animation needs a line in the existing guard at
`styles.css:1388`. Moods must also be legible **without** motion (posture, expression, a label),
since that guard turns animation off entirely.
</details>

### Phase 4 — friends can see your pet ✅ BUILT (2026-09-04, unverified in browser)

`FriendsPanel` gains a `friendPets` map fetched through `fetchFriendPets` — the same
batched-by-cloudId shape as the presence effect right above it — and renders a 17px companion
chip inline in each card's meta row (`.fr-friend-pet`), so it costs no extra vertical space on a
long list. The chip is `data-motion="off"`: idle-animating dozens of decorative SVGs in a scroll
list is a real cost for no gain.

Gated by `enablePets` in `App.jsx` — the admin kill switch **and** the personal opt-out, since
someone who turned pets off shouldn't meet them again on other people's cards — plus `!IS_LITE`.

Verified against the local stack, not assumed:

| Case | Result |
| --- | --- |
| Ask for an adopted + a never-adopted friend | only the adopted one comes back |
| Ask for a stranger's id | 0 rows |
| Ask with an empty id list | 0 rows — no accidental full-table dump |
| `select * from pet_state` as a non-owner | 0 rows; RLS still holds |

**181 tests green**, lint clean (FriendsPanel adds no new errors), build green.

<details><summary>Original Phase 4 spec</summary>
A batched `.in("user_id", cloudIds)` select against `pet_state` — same shape as
`status.js:137-160` — rendering a mini pet + level badge on the friend cards at
`FriendsPanel.jsx:918-922`, beside the existing status and away chips. Expose **only**
`(pet_key, name, level)` via the restricted read policy — never XP, ledgers, streaks or
timestamps.
</details>

### Phase 5 — admin & gating ✅ BUILT (2026-09-04, unverified in browser)

**Deviation from the original spec, deliberately.** The plan called for renaming
`flags.greetingPets` → `flags.pet` with back-compat reads. That flag is live in prod, and the
rename buys naming tidiness in exchange for a real risk: get the shim wrong and pets vanish
cohort-wide. So the existing object is *extended* instead, with two new keys:

- `companion` (bool) — the adoptable layer: adoption, the pet page, XP, friends' pets. Separate
  from `enabled` so the decorative greeting pet can stay while the game is switched off.
- `xpRate` (number) — an XP multiplier for tuning.

**Both absent in every config saved before this shipped, and both default to on/1× — so the
defaults *are* the back-compat story, with no migration and no shim to get wrong.**

`clampRate` bounds the rate to 0.25×–3× in `lib/pet.js`, not in the admin UI, so a hand-edited or
corrupt config can't hand the app a 0× (progress silently frozen) or a 500× (cohort maxed
overnight). `scaleXp` floors a scaled award at 1, so a real award never rounds away to nothing.
Because the ledger stores the amount paid, changing the rate never revalues already-banked XP,
and never re-pays an event already awarded — both asserted by tests.

`enableCompanion` in `App.jsx` is the single gate: admin kill switch AND companion switch AND the
student's own opt-out AND `!IS_LITE`. It hides the sidebar entry, the mobile Tools entry, the
Recent-tools row, the friend chips, the adopt flow, and the page itself — a `?view=pet` deep link
falls through to Today rather than rendering a nav-less dead end.

**186 tests green** (5 new for the rate), lint clean on every touched file, full and lite builds
green.

<details><summary>Original Phase 5 spec</summary>
Migrate `sysConfig.flags.greetingPets` → `flags.pet` **with back-compat reads**, so a prod config
saved under the old shape keeps working (the same discipline as `LEGACY_KEYS`). Admin gets: master
kill switch, the existing motion toggle, an XP-rate multiplier for tuning, and the live preview
already present at `AdminDashboard.jsx:4973-5013`. The per-user opt-out
(`pgp2.greeting-pets-enabled`) survives and now also hides the Tools entry.
</details>

---

## All five phases are built. Remaining before this ships:

1. **Browser verification** — nothing in phases 1–5 has been seen rendering by anyone.
2. **Apply `20260904120000_pet_state.sql` to prod** (by file; `db push` is unsafe here).
3. **Deploy**, per the agreed "test everything, then push it all together".

## 7. Files touched

| File | Change |
| --- | --- |
| `src/lib/pet.js` | new — pure mechanics |
| `src/lib/pet.test.js` | new — Vitest |
| `src/lib/petStorage.js` | new — cache + write buffer over `pet_state` |
| `supabase/migrations/*_pet_state.sql` | new — table + RLS (Phase 1) |
| `src/hooks/usePet.js` | new |
| `src/components/PetPage.jsx` | new — Phase 2 |
| `src/components/greetingPets.jsx` | roster metadata (unlock level, accent); **do not reorder `PETS`** |
| `src/components/DayGreeting.jsx` | tray → real state; adopt entry point |
| `src/App.jsx` | lazy import, `TOOLS_VIEWS`/`TOOLS_VIEW_META`, XP wiring, lite gating |
| `src/components/DesktopSidebar.jsx` | Tools entry |
| `src/components/FriendsPanel.jsx` | friend pet badge (Phase 4) |
| `src/lib/appStorage.js` | `USER_SCOPED_KEYS` += `pgp2.pet` |
| `src/lib/attendance.js`, `assignments.js` | award hooks |
| `src/styles.css` | mood states, page styles, reduced-motion guard |
| `src/components/AdminDashboard.jsx` | `flags.pet` panel (Phase 5) |

## 8. Risks & things to verify before building

1. **The restricted friend-read policy needs care.** Exposing `(pet_key, name, level)` to any
   authenticated user while keeping XP/ledger private is a column-level concern; verify the
   policy actually withholds the private columns rather than relying on the client's select
   list. The `admin_rls_lockdown` migration is the precedent for getting this right.
2. **`PETS` order is load-bearing** for `getPetOfTheDay()` and its tests — reordering or removing
   an entry silently changes which pet every past and future date resolves to. Roster metadata
   must be added *in place*.
3. **`LEGACY_KEYS` (`turtle` → `rover`) must survive** into the adopted-pet path, or admin
   configs and any saved pet key from prod resolve to the wrong animal.
4. **Bundle cost.** The pet page must be lazy and Lite-excluded. Watch `stats.html` after Phase 2;
   this project has a documented history of perf regressions being caught late.
5. **Timezone.** Daily caps, streaks and decay must use the existing IST-aware helpers in
   `lib/datetime.js` and the existing `dayKey()` — not raw `Date` maths. The scheduled-push
   ~5.5h TZ bug in the notification work is the cautionary precedent.
6. **No new notification type in v1.** A "your pet misses you" push is exactly the dark pattern
   §2 rules out, and it would need a `prefs` matrix entry besides.
7. **A name is user-generated content shown to friends.** Pet names reach other students' screens
   in Phase 4, so they need the same length cap and trimming any other shared string gets, and
   the friend card must render them as text, never markup.
8. **Scope honesty:** Phases 0–3 deliver a complete, durable solo pet. Phases 4–5 add social and
   admin control. If the term gets busy, stopping after Phase 3 leaves something coherent rather
   than half-built.

## 9. Decisions (all settled 2026-09-04)

- **Adoption timing** — the prompt appears the **first time someone taps the greeting pet**, not
  during onboarding. Onboarding is already dense, and discovery-by-tap means only students who
  are curious ever see it.
- **Re-adoption** — **free switching** among unlocked pets. XP lives on the account, not the
  animal, so trying a new companion never costs progress (`switchTo` in `lib/pet.js`).
- **Daily rotation survives** as the pre-adoption and opted-out state. `getPetOfTheDay()` and its
  12 tests stay exactly as they are; nothing in the roster order moves.
- **XP numbers** live in the single `XP` block at the top of `lib/pet.js`, so balancing is a
  one-line edit rather than a hunt.
- **Prod deployment** — nothing goes to prod piecemeal. The migration is verified against a local
  Docker stack; the whole feature ships together once tested.

## 10. Refit — 2026-09-06

Phases 0-5 shipped the companion; this pass fixed what a browser showed and the
tests could not, and gave the curve somewhere to go past the cap.

**Mood legibility.** The penguin, the chick and Rover had no ears, and ear droop
is most of what a mood looks like — sixteen moods that rendered as one animal.
The wings now rotate to the same `--pet-ear-droop` (scaled .6 through
`--pet-wing-droop`), Rover was redrawn with servo housings on the same classes,
and a new `--pet-drop` sags the whole body per mood, which reads at 40px where a
3deg lean never did. `greetingPets.test.jsx` now fails if a pet ships with
neither ears nor wings.

**A raster harness.** `npm run pet-sheet` renders the roster against every mood
to one PNG, reading the knobs, per-pet gains and transform-origins out of
styles.css so it cannot drift from what ships. Part pivots come from real
bounding boxes (each moving part is rasterized alone and measured from its alpha
channel), which is also how the neckwear anchors were measured. It is a still,
so it shows posture and not timing — which is the half that has to carry a mood
anyway. Two of the three defects found this pass were invisible to the suite and
obvious in the sheet.

**Why this mood.** `moodExplainFor` returns the mood *and* the rung it stopped
on; `moodFor` delegates to it so the ladder exists once. The pet page prints the
reason under the mood copy. Found in passing: `rooting` had no line in either
copy map, so exam week rendered "<pet> undefined" in the greeting and a blank
mood on the pet page. Both maps are now covered by a test.

**Art.** The dog and the cat — the two most-seen companions, both starters —
were redrawn as outlined stickers. Koala, otter, raccoon and Rover got a craft
pass in the existing flat style. The roster is deliberately mid-migration: see
the open question below.

**Progression past level 12.** Ten devotion tiers shipped with two hats between
them, so eight of the ten steps past the cap unlocked nothing. Now:

* eight more devotion hats, one per empty tier;
* **coats** (`COATS`) — the same pet recoloured by a CSS filter, six of them,
  devotion-gated. A filter rather than 96 more SVGs;
* **neckwear** (`NECKWEAR`) — a second wearable slot, independent of the hat, so
  the wardrobe multiplies instead of adding. A worn collar replaces the one the
  pet is drawn with;
* **Nova** (devotion 4) and **Cinder** (devotion 8) — the first companions not
  earned by levelling, drawn to the premium brief;
* **titles**, all derived from state the ledger already holds;
* a **second companion slot** at devotion 5 — display only, so the ledger is
  never forked;
* **birthday** and **festive** moods, from the adoption date and the calendar;
* a **care streak** multiplier (up to 1.5x) that only applies at MAX_LEVEL,
  applied at award time so `award` stays idempotent.

### Follow-up — same day

Four more, picked off the enhancement list:

**Friends see the wardrobe.** `get_friend_pets` projected key/name/level, which
was right when the wardrobe was eleven hats and wrong once it was thirty pieces
across three slots — a cosmetic nobody else sees may as well not exist. The
migration `20260906120000_pet_public_cosmetics.sql` widens the projection with
hat/neck/coat/title and nothing else: no XP, no ledger, no timestamps, no buddy
(the friends list draws dozens of these at once). The client re-validates every
cosmetic through the same `visible*` helpers the owner's own view uses, so a
hand-edited row cannot show a friend a crown its owner never earned, and
`fetchFriendPets` reads the new columns with `?? null` so a client that ships
ahead of the migration just sees bare pets. **The migration is written but NOT
applied — prod is a deliberate step.**

**The daily rotation stops spoiling the roster.** `getPetOfTheDay` picked from
all sixteen, so someone who had not adopted yet could be greeted by Nova. It now
draws from `ROTATION` (everything except the four premium companions), which
filters `PETS` rather than restating it, so the rotation stays in roster order
and a new companion is still a one-line change. Note this moved which pet every
past and future date resolves to — unavoidable, and the rotation is decorative.

**What's next.** `nextUnlockFor` returns the nearest unearned thing across every
registry — companion, hat, coat, collar, the buddy slot — as
`{ kind, key, label, at, by }`, levels before devotion tiers. The pet page shows
it under the XP numbers. Derived from the registries, so a new wearable appears
there without anyone remembering to add it.

**The companion leaves its two screens.** `PetCameo` renders the pet with its
current mood and full wardrobe anywhere, and returns null unless there is a pet
and both the student and the cohort still want one — so callers drop it in
unconditionally. Placed on the free-day card (the pet has a mood for exactly
that day, and had nowhere to show it) and in the Term Wrapped hero. Adding a
third place is now one line.

Also fixed in passing: the hat and collar offsets are absolute px tuned against
the 40px greeting chip, so they did not scale with the mount. `--pet-overlay-k`
scales them per mount (default 1, so nothing that does not set it moves), which
is what lets the 17px friends badge and the cameos wear the wardrobe straight.

### XP rebalance — 2026-09-07

The earn rates were set by feel before the roster ran past level 9, and modelling
them against the term that actually ships showed how far off they were. This
term is 107 days, 90 teaching days, ~115 classes for the median student. Under
the original rates (10 / 20 / 5 / 2) a student who marked EVERY class, opened the
app daily and cleared fourteen deadlines finished on **2607 XP — level 9**.
Spark, Leafy, Nova and Cinder were unreachable, and so was every devotion tier.
Four companions and the whole devotion wardrobe were content nobody could see.

New rates, tuned so an engaged student (marks ~85%, opens daily, two or three
cares, eight deadlines) earns the last companion at about 80% of the term:

| | was | now |
|---|---|---|
| class marked | 10 | **32** |
| deadline cleared | 20 | **60** |
| daily streak | 5 | **10** |
| care tap (max 3/day) | 2 | **3** |
| devotion tier | 400 | **270** |
| Nova / Cinder gates | Dv 4 / Dv 8 | **Dv 2 / Dv 4** |

Where that lands:

| | perfect | engaged | casual |
|---|---|---|---|
| Spark (Lv 11) | 40% | 48% | never |
| Leafy (Lv 12) | 48% | 58% | never |
| Nova (Dv 2) | 54% | 68% | never |
| **Cinder (Dv 4)** | 64% | **80%** | never |
| whole wardrobe (Dv 10) | 94% | never | never |

A casual student (marks half, opens most days) ends around level 10 with twelve
of the sixteen — the premium four stay worth something, and nobody is scolded.
Attendance is ~56% of a typical total, so the pet still levels because you showed
up rather than because you tapped it (§2).

**The level curve is deliberately unchanged.** Rates only affect XP awarded from
here on — the ledger records what each event actually paid — whereas moving
`LEVEL_BASE`/`LEVEL_STEP` would re-map every existing pet's level overnight. The
smaller devotion step can only raise a tier, and tiers hold nothing but
cosmetics.

`npm run xp-model` runs the model (and takes rate overrides as JSON, so a change
can be tried without editing `pet.js`). `src/lib/petEconomy.test.js` runs the
same model in CI and fails if a companion goes out of reach — which it does if
you put the old rates back. That matters most at term rollover: a shorter term
with fewer classes silently makes the tail unreachable, and nothing else in the
suite would notice.

### Mood-timing fix — 2026-09-07

An audit of which parts each mood actually retimes (one selector-coverage pass
over styles.css) turned up two real defects:

* **Nova and Cinder never changed speed.** The premium flourishes were retimed
  by six long selector lists naming Spark's and Leafy's classes; the two
  companions added later have their own class names, which nobody added to those
  lists. A sleepy Cinder flickered exactly as fast as a celebrating one.
* **Even for Spark and Leafy it was three moods out of seventeen** — excited,
  tired and sleepy. The other fourteen retimed the ears, tail, face and
  signature and left the sparks and vines at idle speed. And because each list
  set one flat duration for every part in it, a retimed Spark lost its internal
  rhythm: the static, which is meant to tick faster than the bolts, ran at
  exactly the bolts' speed.

Both are fixed by `--pet-tempo`. Every flourish keeps its OWN base duration
written as `calc(<base> * var(--pet-tempo))`, and each mood sets the tempo once,
derived from that mood's own idle bob against the 2.9s base — so the flourish
slows down with the animal and keeps its internal rhythm at every speed. Six
selector lists became seventeen single declarations, and a new companion is
covered the moment its parts are drawn.

`greetingPets.test.jsx` now fails if a looping flourish rule is written without
the tempo, if a mood forgets to set one, or if a tempo points the opposite way
to its own idle (a mood that bobs slower must not flicker faster).

### Open question

The outline style now covers two of sixteen pets. Either it becomes the roster
style (fourteen redraws, and the premium pair lose some of their separation) or
the two starters stay deliberately the most finished pets in the set. Not
decided — do not "fix" the inconsistency without settling it.
