// Pet companion — pure mechanics.
//
// No React, no storage, no network. Every function is a pure transform over a
// plain state object, so the whole feature can be reasoned about (and tested)
// without a browser or a Supabase row. `petStorage.js` owns persistence;
// `usePet.js` owns wiring. This file owns the rules.
//
// Two things are deliberately DERIVED rather than stored:
//
//   • XP    — the sum of the award ledger plus the signed admin `grantedXp`.
//   • mood  — a function of recency, today's care and the clock.
//
// Storing either would let a cached copy disagree with the cloud row after an
// offline stretch, and there'd be no way to tell which was right. Deriving them
// makes a two-device merge deterministic: union the ledgers and recompute.
//
// See docs/pet-companion-plan.md §4.

import { ymd } from "./datetime.js";
import { normalizeHabitat, validHabitat } from "./petHabitat.js";

// ── Tuning ──────────────────────────────────────────────────────
// One block, on purpose: balancing this feature means editing numbers here and
// nothing else. Rates assume ~3-4 classes on a teaching day, so a normal
// student earns roughly 40-50 XP/day.
/**
 * Earn rates, tuned against the actual term rather than picked by feel.
 *
 * The original numbers were set before the roster ran to level 12 and were badly
 * short (a perfect student finished the term at level 9); they were re-tuned
 * once and have NOT changed since. Raising the cap to 20 did not touch them:
 * devotion pacing depends on them, so levels 13-20 got a gentler cost instead
 * (LATE_STEP_* above).
 *
 * Modelled over this term's real schedule (107 days, ~125 classes for the
 * median student), see `npm run xp-model`:
 *
 *   engaged (marks ~85%, opens daily)   Lv 12 ~58%   Dv 2 ~66%
 *                                       Lv 18 ~78%   Cinder (Dv 4) ~79%
 *                                       Lv 20 (Dragon) ~81%
 *   perfect (marks every class)         Lv 20 at ~66% of the term
 *   casual  (marks half, opens most)    ends the term around level 11
 *
 * Attendance is deliberately 56% of a typical total: the pet levels because you
 * showed up, not because you tapped it (docs §2).
 *
 * DEVOTION runs in parallel with levels 13-20 (it counts from 3,850 XP, the old
 * level-12 mark) and DEVOTION_STEP is pinned at 270 so nobody's tier moved when
 * the cap rose.
 *
 * The LEVEL CURVE for 1-12 is deliberately untouched. Rates only affect XP
 * awarded from here on — the ledger stores what each event actually paid —
 * whereas moving the curve would re-map every existing pet's level overnight.
 *
 * Re-run the model with scripts/xp-model.mjs if the term shape changes.
 */
export const XP = {
  attendance: 32,   // per class marked (any status — honesty is the point, not presence)
  deadline: 60,     // per assignment cleared
  streak: 10,       // per day of an unbroken open-the-app streak
  care: 3,          // per care tap, hard-capped below
};

/** Care taps per local day, across ALL actions combined. */
export const CARE_DAILY_CAP = 3;
export const CARE_ACTIONS = ["pet", "play", "treat"];

/** XP to climb one level: 100, 150, 200, … */
const LEVEL_BASE = 100;
const LEVEL_STEP = 50;
export const MAX_LEVEL = 20;

/**
 * Levels 13-20 use a gentler, separate cost than the 100 + 50n curve above
 * (which would put Lv20 at 10,450 XP, out of reach inside a term). Climbing from
 * level L to L+1 (L >= 12) costs LATE_STEP_BASE + LATE_STEP_RISE * (L - 12):
 * 140, 150, ... 210, so Lv20 = 3,850 + 1,400 = 5,250 XP. Nobody was ever above
 * 12, so this range is free design space. KEEP IN SYNC with pet_level_for in
 * 20261013120000_pet_level_cap_20.sql (table in pet.test.js).
 */
const LATE_FROM_LEVEL = 12;
const LATE_STEP_BASE = 140;
const LATE_STEP_RISE = 10;

/**
 * The level at which devotion starts counting. This was MAX_LEVEL back when the
 * cap was 12, and it is PINNED here: devotion is measured from 3,850 XP, so
 * raising the cap did not demote anybody's tier, coat, hat or companion. Levels
 * 13-20 and devotion now progress in parallel off the same XP.
 */
export const DEVOTION_BASE_LEVEL = 12;
export const DEVOTION_BASE_XP = xpToReach(DEVOTION_BASE_LEVEL);

/**
 * Highest level the cloud schema accepts: pet_state.level is
 * `check (level between 1 and 20)` in prod since
 * 20261013120000_pet_level_cap_20.sql (applied 2026-10-13). Level is derived
 * from XP on the client, so clamping what is WRITTEN costs nothing on screen.
 * Raise MAX_LEVEL again only together with a migration that widens the check.
 */
export const SERVER_LEVEL_CAP = 20;

/** How far back the streak walk looks. The ledger itself is never pruned (pruning
 *  into baseXp double-counted XP across syncs), so this only bounds the walk. */
export const LEDGER_DAYS = 30;

// The three pets offered at adoption. The rest unlock by level — see UNLOCKS.
// Keys only: this module never imports the SVG components, so the logic (and
// its tests) stay free of JSX.
export const STARTER_KEYS = ["cat", "dog", "bunny"];

/**
 * XP past level 12, per "devotion" tier.
 *
 * MAX_LEVEL used to be the end of the feature: every pet was unlocked by level
 * 12, so a student who maxed out in week six earned XP that did nothing for
 * the rest of term. Devotion is the sink — it never gates anything you need,
 * only cosmetics and a quiet glow, so falling behind still costs nothing.
 */
// Sized so the two devotion companions land inside the term (see XP above);
// the ten tiers together are still a stretch only a completionist finishes.
export const DEVOTION_STEP = 270;
export const MAX_DEVOTION = 10;

/**
 * Wearables. `accessory` (the collar/leaf/scarf baked into every pet SVG)
 * stays a boolean for backwards compatibility; `hat` is a slot that holds one
 * key from here, drawn as a shared overlay so no pet needed new art.
 *
 * Gated by `level` or by `devotion` — never by both. The devotion hats are
 * the only thing in the feature that a maxed-out pet can still be working
 * toward, which is the whole point of them.
 */
export const HATS = [
  { key: "bow", label: "Ribbon", level: 2 },
  { key: "bloom", label: "Flower crown", level: 3 },
  { key: "cap", label: "Cap", level: 4 },
  { key: "phones", label: "Headphones", level: 5 },
  { key: "specs", label: "Specs", level: 6 },
  { key: "devil", label: "Little devil", level: 7 },
  { key: "beanie", label: "Beanie", level: 8 },
  { key: "shades", label: "Shades", level: 9 },
  { key: "grad", label: "Grad cap", level: 10 },
  { key: "party", label: "Party hat", level: 11 },
  // Pinned at 12 (not MAX_LEVEL): students already earned it there.
  { key: "crown", label: "Crown", level: 12 },
  // Levels 13-20: the odd ones hand out wearables, the even ones a companion.
  { key: "wizard", label: "Wizard hat", level: 13 },
  { key: "sunburst", label: "Sunburst", level: 19 },
  // Devotion wearables. Ten tiers shipped and only two of them unlocked
  // anything, so eight of the ten level-ups past MAX_LEVEL were silent — the
  // exact stretch that needed a reason to keep going. One per tier now.
  { key: "sprig", label: "Sprig", devotion: 1 },
  { key: "star", label: "Star pin", devotion: 2 },
  { key: "halo", label: "Halo", devotion: 3 },
  { key: "laurel", label: "Laurel", devotion: 4 },
  { key: "muffs", label: "Earmuffs", devotion: 5 },
  { key: "ember", label: "Ember", devotion: 6 },
  { key: "comet", label: "Comet", devotion: 7 },
  { key: "moon", label: "Crescent", devotion: 8 },
  { key: "aurora", label: "Aurora", devotion: 9 },
  { key: "stars", label: "Constellation", devotion: MAX_DEVOTION },
];

/** Fast membership test for `normalize`, which runs on every storage read. */
const HAT_KEYS = new Set(HATS.map(h => h.key));

/**
 * Coats — the same companion in a different palette.
 *
 * Recoloured in CSS (a filter on `.dg-pet svg`, see styles.css) rather than by
 * shipping a second copy of every SVG: twenty-odd pets x nine coats would be
 * two hundred drawings to keep in sync, and the first divergence would be a bug
 * nobody could see. The cost of the filter approach is that a coat shifts the
 * whole animal, accessories included — which is why they are tuned as gentle
 * shifts and not costume changes.
 */
export const COATS = [
  { key: "frost", label: "Frost", level: 1 },
  { key: "caramel", label: "Caramel", level: 1 },
  { key: "lavender", label: "Lavender", level: 1 },
  { key: "dusk", label: "Dusk", devotion: 1 },
  { key: "sand", label: "Sand", devotion: 2 },
  { key: "mint", label: "Mint", devotion: 4 },
  { key: "berry", label: "Berry", devotion: 6 },
  { key: "ink", label: "Ink", devotion: 8 },
  { key: "gold", label: "Gold", devotion: MAX_DEVOTION },
];
const COAT_KEYS = new Set(COATS.map(c => c.key));

/**
 * Neckwear — a second wearable slot, independent of the hat.
 *
 * Two slots multiply rather than add: eleven level hats against five collars is
 * fifty-five looks out of sixteen drawings. Worn neckwear replaces the collar
 * the pet is drawn with (styles.css hides `.dg-pet-accessory`), so nobody ends
 * up wearing a scarf over a bow.
 */
export const NECKWEAR = [
  { key: "scarf", label: "Scarf", level: 3 },
  { key: "bandana", label: "Bandana", level: 5 },
  { key: "bowtie", label: "Bow tie", level: 7 },
  { key: "bell", label: "Bell collar", level: 9 },
  { key: "medal", label: "Gold medal", level: 15 },
  { key: "chain", label: "Charm chain", devotion: 5 },
];
const NECK_KEYS = new Set(NECKWEAR.map(n => n.key));

/**
 * Companions earned past the level cap.
 *
 * Levels 1-12 once handed out the whole original roster, so devotion had
 * nothing but hats. These companions are the carrot alongside the late levels,
 * and they are gated on tier rather than level so they can never arrive before
 * the level-12 roster is complete.
 *
 * Tiers 2 and 4 rather than 4 and 8: the pets have to be reachable inside a
 * term (the last one lands at ~80% of it — see XP), while the tiers above them
 * carry cosmetics, which are allowed to outlast the term.
 */
// Additional companions fill the gaps without moving existing unlocks.
// Nova (tier 2) was retired on 2026-10-20; its owners map to Inky (RENAMED_PETS).
export const DEVOTION_UNLOCKS = { 4: "cinder" };
export const BONUS_DEVOTION_UNLOCKS = { 1: "hoot", 2: "pebble", 3: "byte", 4: "prickle" };
// Multiple companions can share a tier. Keep the original singular lookup
// for callers, and use this combined list for collection and reward displays.
export const DEVOTION_COMPANIONS = [
  ...Object.entries(DEVOTION_UNLOCKS), ...Object.entries(BONUS_DEVOTION_UNLOCKS),
  ["3", "luna"],
  // The PR #22 collection shares the reachable tiers; old unlocks and XP
  // pacing stay put (petEconomy.test.js still holds).
  ["1", "maple"], ["1", "mochi"], ["2", "inky"],
  ["3", "nimbus"], ["4", "ember"],
].sort(([a], [b]) => Number(a) - Number(b));

/**
 * Titles. Cosmetic, never a rank against anybody else (docs §2), and every one
 * is derived from state the ledger already holds — nothing new to store, and
 * nothing that can disagree with the pet's actual history.
 */
export const TITLES = [
  { key: "friend", label: "New friend", test: () => true },
  { key: "partner", label: "Study partner", test: ({ level }) => level >= 4 },
  { key: "collector", label: "Collector", test: ({ unlocked }) => unlocked >= 8 },
  { key: "constant", label: "Constant companion", test: ({ level }) => level >= 8 },
  { key: "grown", label: "Fully grown", test: ({ level }) => level >= 12 }, // pinned: earned at 12 before the cap rose
  { key: "sage", label: "Sage", test: ({ level }) => level >= 17 },
  { key: "legend", label: "Legend", test: ({ level }) => level >= MAX_LEVEL },
  { key: "devoted", label: "Devoted", test: ({ tier }) => tier >= 3 },
  { key: "veteran", label: "Term veteran", test: ({ days }) => days >= 60 },
  { key: "inseparable", label: "Inseparable", test: ({ tier }) => tier >= 6 },
];
const TITLE_KEYS = new Set(TITLES.map(t => t.key));

/**
 * The next thing this pet has not earned yet, as `{ kind, key, label, at }`.
 *
 * The pet page could say what you have and never what is coming, which is the
 * one thing that makes a curve worth climbing. Everything here is derived from
 * the same registries the wardrobe reads, so a new hat or coat shows up in this
 * line without anyone remembering to update it.
 *
 * Levels and devotion tiers now progress in parallel off the same XP (levels
 * 13-20 vs. devotion from 3,850), so each candidate is ranked by the XP it
 * costs and the cheapest one wins. `null` means there is genuinely nothing left.
 */
export function nextUnlockFor(state) {
  const s = normalize(state);
  const { level, tier } = unlockStanding(s); // owned items are never "next"

  const byLevel = [];
  const byDevotion = [];
  for (const [lvl, key] of Object.entries(UNLOCKS)) {
    byLevel.push({ kind: "companion", key, label: key, at: Number(lvl) });
  }
  for (const [t, key] of DEVOTION_COMPANIONS) {
    byDevotion.push({ kind: "companion", key, label: key, at: Number(t) });
  }
  for (const [list, kind] of [[HATS, "hat"], [COATS, "coat"], [NECKWEAR, "collar"]]) {
    for (const item of list) {
      const row = { kind, key: item.key, label: item.label };
      if (item.devotion) byDevotion.push({ ...row, at: item.devotion });
      else byLevel.push({ ...row, at: item.level });
    }
  }
  if (tier < BUDDY_DEVOTION) {
    byDevotion.push({ kind: "slot", key: "buddy", label: "A second companion", at: BUDDY_DEVOTION });
  }

  const nextLevel = byLevel.filter(r => r.at > level).sort((a, b) => a.at - b.at)[0];
  const nextTier = byDevotion.filter(r => r.at > tier).sort((a, b) => a.at - b.at)[0];
  if (!nextLevel) return nextTier ? { ...nextTier, by: "devotion" } : null;
  if (!nextTier) return { ...nextLevel, by: "level" };
  return DEVOTION_BASE_XP + nextTier.at * DEVOTION_STEP < xpToReach(nextLevel.at)
    ? { ...nextTier, by: "devotion" }
    : { ...nextLevel, by: "level" };
}

/** Devotion tier that opens the second (display-only) companion slot. */
export const BUDDY_DEVOTION = 5;

/**
 * Growth stages — the pet you already have visibly maturing, rather than a
 * number next to art that never changes.
 *
 * DERIVED from level, like XP and mood, and for the same reason (see the file
 * header): a stored stage could disagree with the ledger after an offline
 * stretch and there'd be no way to tell which was right. Feeding and the other
 * care taps feed this the way they always have — through XP — so no new
 * counter, no new merge rule, and no way to be "behind" on growth while being
 * ahead on level.
 *
 * Four stages over twelve levels, so a stage change is a real event (~3 levels
 * apart) rather than something that happens quietly every week.
 */
export const GROWTH_STAGES = [
  { key: "hatchling", label: "Hatchling", from: 1 },
  { key: "young", label: "Young", from: 4 },
  { key: "grown", label: "Grown", from: 8 },
  { key: "elder", label: "Elder", from: 12 }, // pinned: reached at 12 before the cap rose
  { key: "ascended", label: "Ascended", from: MAX_LEVEL },
];

/** The stage a level sits in. Clamps, so an out-of-range level is never null. */
export function growthStageFor(level) {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  let stage = GROWTH_STAGES[0];
  for (const s of GROWTH_STAGES) if (lvl >= s.from) stage = s;
  return stage;
}

/**
 * The stage after this one, with the level that reaches it — the pet page uses
 * it to say what the next milestone actually is. `null` once fully grown.
 */
export function nextGrowthStage(level) {
  const current = growthStageFor(level);
  const i = GROWTH_STAGES.indexOf(current);
  return i >= 0 && i < GROWTH_STAGES.length - 1 ? GROWTH_STAGES[i + 1] : null;
}

/** level → pet key unlocked on reaching it. Past 12: the cosy three on the odd
 *  levels (13/15/17, alongside their wearables and titles), the premium four on
 *  14/16/18/20, and 19 is the one level that pays out only a wearable. */
export const UNLOCKS = {
  2: "fox", 3: "penguin", 4: "panda", 5: "chick", 6: "koala",
  7: "otter", 8: "rover", 9: "raccoon", 10: "axolotl",
  // 11 and 12 previously unlocked nothing — the roster ran out before the
  // curve did, so the last two level-ups gave no new companion.
  11: "spark", 12: "leafy",
  13: "hamster", 14: "frost", 15: "sloth", 16: "sable", 17: "capy", 18: "unicorn", 20: "dragon",
};

/**
 * Retired pet keys → the companion now in their slot. Tide, Sol and Eclipse
 * (levels 16/18/20) were replaced on 2026-10-20 by Sable, the Unicorn and the
 * Dragon; Nova (Devotion 2) went to Inky, which unlocks on the same tier, and
 * the Griffin (Lv 16 for an afternoon, never in prod) to Sable. A student who
 * had one keeps the same slot under its new key.
 *
 * Applied by `normalize`, so a stale cache, an old row or a friend's summary
 * all read as the new key, and the next save writes it back. The SQL migrations
 * 20261020130000_pet_rename_premium.sql and 20261020140000_pet_retire_nova.sql
 * rewrite the rows themselves.
 */
export const RENAMED_PETS = { tide: "sable", sol: "unicorn", eclipse: "dragon", griffin: "sable", nova: "inky" };
const isRenamed = key => typeof key === "string" && Object.hasOwn(RENAMED_PETS, key);
const renamed = key => (isRenamed(key) ? RENAMED_PETS[key] : key);

// ── State ───────────────────────────────────────────────────────

/**
 * A ledger entry is `[dayString, xpAmount]` keyed by a STABLE id for the
 * real-world event that earned it (e.g. `att:2026-09-04:SCM_A`). Re-syncing
 * attendance, re-rendering, or un-marking and re-marking a class all replay the
 * same key, and `award` ignores a key it has already paid out — so XP cannot be
 * double-earned no matter how many times the source is observed.
 */
export function emptyPet() {
  return {
    v: 1,
    petKey: null,      // null ⇒ not adopted yet
    name: "",
    adoptedAt: null,
    baseXp: 0,         // RETIRED: always 0, kept so old rows/caches still parse (see xpOf)
    legacyXp: 0,       // pre-repair inflated total; server-owned, an unlock floor only (unlockStanding)
    grantedXp: 0,      // signed admin adjustment; server-owned, never written here
    companionEnabled: true, // per-student kill switch; server-owned too
    awarded: {},       // { eventKey: [ymd, xp] }
    care: { day: null, used: 0 },
    lastSeen: 0,
    unlocked: [],
    cosmetics: { accessory: true, hat: null, coat: null, neck: null, title: null, buddy: null, habitat: normalizeHabitat() },
  };
}

/**
 * True when `raw` already satisfies every invariant `normalize` enforces.
 *
 * This exists so `normalize` can hand back the *same object* it was given
 * instead of an equal copy. Most callers pass state that this module produced,
 * and the identity matters: `award` and `care` are fired on every render and
 * every re-sync, and returning a fresh object each time would defeat React's
 * bail-out and re-render the greeting on a live clock tick.
 */
// Objects already proven normalized. Every helper normalizes its input, and the
// pet page calls a dozen of them per render on a live clock, so re-walking the
// whole ledger each time added up. State is never mutated in place (every
// transform here spreads), so a verified object stays verified.
const VERIFIED = new WeakSet();

function isNormalized(raw) {
  if (raw && typeof raw === "object" && VERIFIED.has(raw)) return true;
  if (!checkNormalized(raw)) return false;
  VERIFIED.add(raw);
  return true;
}

function checkNormalized(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  if (raw.v !== 1) return false;
  if (raw.petKey !== null && typeof raw.petKey !== "string") return false;
  if (isRenamed(raw.petKey) || isRenamed(raw.cosmetics?.buddy)) return false;
  if (typeof raw.name !== "string" || raw.name.length > 24) return false;
  if (raw.baseXp !== 0) return false;
  if (!Number.isFinite(raw.legacyXp) || raw.legacyXp < 0) return false;
  if (!Number.isFinite(raw.grantedXp)) return false;
  if (typeof raw.companionEnabled !== "boolean") return false;
  if (!Number.isFinite(raw.lastSeen) || raw.lastSeen < 0) return false;
  if (!raw.awarded || typeof raw.awarded !== "object" || Array.isArray(raw.awarded)) return false;
  for (const v of Object.values(raw.awarded)) {
    if (!Array.isArray(v) || v.length !== 2) return false;
    if (typeof v[0] !== "string" || !Number.isFinite(v[1]) || v[1] < 0) return false;
  }
  const care = raw.care;
  if (!care || typeof care !== "object") return false;
  if (care.day !== null && typeof care.day !== "string") return false;
  if (!Number.isInteger(care.used) || care.used < 0 || care.used > CARE_DAILY_CAP) return false;
  if (!Array.isArray(raw.unlocked) || raw.unlocked.some(k => typeof k !== "string" || isRenamed(k))) return false;
  if (!raw.cosmetics || typeof raw.cosmetics.accessory !== "boolean") return false;
  if (raw.cosmetics.hat !== null && !HAT_KEYS.has(raw.cosmetics.hat)) return false;
  if (raw.cosmetics.coat !== null && !COAT_KEYS.has(raw.cosmetics.coat)) return false;
  if (raw.cosmetics.neck !== null && !NECK_KEYS.has(raw.cosmetics.neck)) return false;
  if (raw.cosmetics.title !== null && !TITLE_KEYS.has(raw.cosmetics.title)) return false;
  if (raw.cosmetics.buddy !== null && typeof raw.cosmetics.buddy !== "string") return false;
  if (!validHabitat(raw.cosmetics.habitat)) return false;
  return true;
}

/**
 * Defensive read of anything that came out of storage or a JSONB column.
 * Never throws, never returns a partial shape — a corrupt record degrades to a
 * fresh pet rather than crashing the greeting on boot. Already-valid state is
 * passed straight through (see `isNormalized`).
 */
export function normalize(raw) {
  if (isNormalized(raw)) return raw;
  const base = emptyPet();
  if (!raw || typeof raw !== "object") return base;
  const awarded = {};
  if (raw.awarded && typeof raw.awarded === "object") {
    for (const [k, v] of Object.entries(raw.awarded)) {
      if (!Array.isArray(v) || v.length !== 2) continue;
      const [day, xp] = v;
      if (typeof day !== "string" || !Number.isFinite(xp) || xp < 0) continue;
      awarded[k] = [day, xp];
    }
  }
  return {
    ...base,
    ...raw,
    v: 1,
    petKey: typeof raw.petKey === "string" ? renamed(raw.petKey) : null,
    name: typeof raw.name === "string" ? raw.name.slice(0, 24) : "",
    // Retired: a stale cache's baseXp was double-counted by the old prune/merge
    // loop, so it is read and discarded rather than added to XP.
    baseXp: 0,
    legacyXp: Number.isFinite(raw.legacyXp) && raw.legacyXp > 0 ? raw.legacyXp : 0,
    grantedXp: Number.isFinite(raw.grantedXp) ? raw.grantedXp : 0,
    // Defaults ON: a row written before this column existed, or a cache from
    // an older build, must not read as "switched off".
    companionEnabled: raw.companionEnabled !== false,
    awarded,
    care: {
      day: typeof raw.care?.day === "string" ? raw.care.day : null,
      used: Number.isFinite(raw.care?.used) ? Math.max(0, Math.min(CARE_DAILY_CAP, raw.care.used)) : 0,
    },
    lastSeen: Number.isFinite(raw.lastSeen) && raw.lastSeen > 0 ? raw.lastSeen : 0,
    unlocked: Array.isArray(raw.unlocked)
      ? Array.from(new Set(raw.unlocked.filter(k => typeof k === "string").map(renamed)))
      : [],
    cosmetics: {
      accessory: raw.cosmetics?.accessory !== false,
      // An unknown key means a hat this build no longer ships (or a hand-edited
      // row). Bare-headed is always a valid pet, so degrade rather than reject.
      hat: HAT_KEYS.has(raw.cosmetics?.hat) ? raw.cosmetics.hat : null,
      // Same rule as the hat for every slot added since: an unknown key is a
      // cosmetic this build no longer ships, and the pet without it is always
      // valid, so degrade rather than reject the whole record.
      coat: COAT_KEYS.has(raw.cosmetics?.coat) ? raw.cosmetics.coat : null,
      neck: NECK_KEYS.has(raw.cosmetics?.neck) ? raw.cosmetics.neck : null,
      title: TITLE_KEYS.has(raw.cosmetics?.title) ? raw.cosmetics.title : null,
      buddy: typeof raw.cosmetics?.buddy === "string" ? renamed(raw.cosmetics.buddy) : null,
      habitat: normalizeHabitat(raw.cosmetics?.habitat),
    },
  };
}

export function isAdopted(state) {
  return Boolean(state?.petKey);
}

/**
 * Adopt a companion. The prompt for this appears the first time someone taps
 * the greeting pet — not during onboarding, which is already dense.
 */
export function adopt(state, petKey, name, now = new Date()) {
  const s = normalize(state);
  if (!petKey) return s;
  return {
    ...s,
    petKey,
    name: (name || "").trim().slice(0, 24),
    adoptedAt: ymd(now),
    lastSeen: now.getTime(),
    unlocked: Array.from(new Set([...s.unlocked, ...STARTER_KEYS, petKey])),
  };
}

/** Rename only — switching pets goes through `switchTo`. */
export function rename(state, name) {
  return { ...normalize(state), name: (name || "").trim().slice(0, 24) };
}

/**
 * Switch to an already-unlocked companion. Free, by design: XP lives on the
 * account, not the animal, so trying a new pet never costs progress.
 */
export function switchTo(state, petKey) {
  const s = normalize(state);
  if (!petKey || !unlockedFor(s).includes(petKey)) return s;
  return { ...s, petKey };
}

/**
 * Set a cosmetic.
 *
 * Two shapes share one function: `accessory` is a boolean (the collar / leaf /
 * scarf every SVG already carries in its own `.dg-pet-accessory` group, so it
 * is a visibility switch rather than new art), and `hat` is a slot holding one
 * key from `HATS` — or null for none.
 *
 * A hat that is not unlocked yet is refused here rather than in the UI: this is
 * the function the storage layer round-trips through, so a hand-edited row
 * cannot smuggle a level-12 crown onto a level-2 pet.
 */
export function setCosmetic(state, key, value) {
  const s = normalize(state);
  if (key === "habitat") {
    const habitat = normalizeHabitat(value);
    if (JSON.stringify(s.cosmetics.habitat) === JSON.stringify(habitat)) return s;
    return { ...s, cosmetics: { ...s.cosmetics, habitat } };
  }
  // Each wearable validates against what was EARNED (never against cohort
  // policy) for the reason spelled out under the hat below.
  if (key === "coat" || key === "neck" || key === "title" || key === "buddy") {
    const earned = key === "coat" ? coatsFor(s)
      : key === "neck" ? neckwearFor(s)
      : key === "title" ? titlesFor(s)
      : unlockStanding(s).tier >= BUDDY_DEVOTION ? unlockedFor(s).filter(k => k !== s.petKey) : [];
    const next = value && earned.includes(value) ? value : null;
    if (s.cosmetics[key] === next) return s;
    return { ...s, cosmetics: { ...s.cosmetics, [key]: next } };
  }
  if (key === "hat") {
    // Validated against what was EARNED, not against cohort policy: this
    // function is what storage round-trips through, and a hat withdrawn while
    // a student was offline must not silently wipe their saved choice on the
    // next load. Policy is applied at render time by `visibleHat`.
    const hat = value && hatsFor(s).includes(value) ? value : null;
    if (s.cosmetics.hat === hat) return s;
    return { ...s, cosmetics: { ...s.cosmetics, hat } };
  }
  if (s.cosmetics[key] === Boolean(value)) return s;
  return { ...s, cosmetics: { ...s.cosmetics, [key]: Boolean(value) } };
}

// ── XP & levels ─────────────────────────────────────────────────

/** Total XP: the signed admin adjustment plus every ledger entry. `baseXp` is
 *  deliberately ignored — see `unlockStanding` and the repair migration. */
export function xpOf(state) {
  const s = normalize(state);
  let total = s.grantedXp;
  for (const [, xp] of Object.values(s.awarded)) total += xp;
  return Math.max(0, total);
}

/** Cumulative XP needed to *reach* `level` (level 1 costs nothing). */
export function xpToReach(level) {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const n = Math.min(lvl, LATE_FROM_LEVEL) - 1;
  const early = n * LEVEL_BASE + LEVEL_STEP * (n * (n - 1)) / 2;
  const k = lvl - LATE_FROM_LEVEL; // steps taken past level 12
  return k > 0 ? early + k * LATE_STEP_BASE + LATE_STEP_RISE * (k * (k - 1)) / 2 : early;
}

export function levelFor(xp) {
  const total = Math.max(0, xp || 0);
  let level = 1;
  while (level < MAX_LEVEL && total >= xpToReach(level + 1)) level++;
  return level;
}

/** Everything the XP bar needs, in one pass. */
export function levelProgress(xp) {
  const total = Math.max(0, xp || 0);
  const level = levelFor(total);
  if (level >= MAX_LEVEL) {
    return { level, into: 0, need: 0, pct: 100, maxed: true };
  }
  const floor = xpToReach(level);
  const ceil = xpToReach(level + 1);
  const into = total - floor;
  const need = ceil - floor;
  return { level, into, need, pct: Math.round((into / need) * 100), maxed: false };
}

/**
 * Progress past DEVOTION_BASE_LEVEL (12), as a "devotion" tier.
 *
 * Deliberately not a second level bar: it unlocks nothing but cosmetics, it is
 * never shown as a rank against anybody else, and it tops out too. A student
 * who maxes their pet and then stops is not punished for it — they simply keep
 * the pet they earned.
 */
export function devotionFor(xp) {
  const over = Math.max(0, (xp || 0) - DEVOTION_BASE_XP);
  const raw = Math.floor(over / DEVOTION_STEP);
  const tier = Math.min(MAX_DEVOTION, raw);
  if (tier >= MAX_DEVOTION) return { tier, into: 0, need: 0, pct: 100, capped: true };
  return {
    tier,
    into: over - tier * DEVOTION_STEP,
    need: DEVOTION_STEP,
    pct: Math.round(((over - tier * DEVOTION_STEP) / DEVOTION_STEP) * 100),
    capped: false,
  };
}

/** The level cap while the inflation bug existed: the most a legacy total could ever unlock by level. */
const LEGACY_FLOOR_LEVEL = 12;

/**
 * What the pet OWNS, as `{ level, tier }`: the real level/devotion tier, raised
 * by the legacy floor.
 *
 * A sync bug double-counted XP, so some students were shown (and unlocked
 * things at) a total far above what they earned. The repair recounts XP, but
 * everything they could already unlock under the old rules stays theirs:
 *
 *   • level-gated items: floor of min(12, level at legacyXp) — nothing from the
 *     new Lv 13-20 content (those need real XP);
 *   • devotion-gated items: floor of the devotion tier at legacyXp (the devotion
 *     maths is unchanged: base 3,850, step 270).
 *
 * This is for OWNERSHIP only (pets, hats, collars, coats, titles, buddy slot,
 * "what's next"). The level, XP bar, devotion bar and care multiplier all keep
 * using real XP.
 */
export function unlockStanding(state) {
  const s = normalize(state);
  const xp = xpOf(s);
  const real = { level: levelFor(xp), tier: devotionFor(xp).tier };
  if (!(s.legacyXp > xp)) return real;
  return {
    level: Math.max(real.level, Math.min(LEGACY_FLOOR_LEVEL, levelFor(s.legacyXp))),
    tier: Math.max(real.tier, devotionFor(s.legacyXp).tier),
  };
}

/** True when the repair lowered this student's XP: drives the one-time notice. */
export function hasXpRecount(state) {
  const s = normalize(state);
  return isAdopted(s) && s.legacyXp > xpOf(s);
}

/**
 * Hat keys this pet can wear right now, in registry order.
 *
 * Two independent gates: what the student earned, and what the cohort config
 * still allows. `hatsOff` is the admin withdrawing a specific wearable — the
 * flower crown in exam week, the devil horns because someone complained.
 */
export function hatsFor(state, { wardrobe = true, hatsOff = [] } = {}) {
  if (wardrobe === false) return [];
  const { level, tier } = unlockStanding(state);
  return HATS
    .filter(h => !hatsOff.includes(h.key))
    .filter(h => (h.devotion ? tier >= h.devotion : level >= h.level))
    .map(h => h.key);
}

/**
 * The hat to actually draw, or null.
 *
 * Withdrawing a wearable hides it; it does NOT clear the student's choice.
 * Erasing `cosmetics.hat` would be a one-way door — an admin toggling the
 * devil horns off for a day would silently strip them from everyone who had
 * earned and chosen them, and turning it back on would return a cohort of
 * bare-headed pets. Hiding is reversible; deleting is not.
 */
export function visibleHat(state, opts = {}) {
  const hat = normalize(state).cosmetics.hat;
  if (!hat) return null;
  return hatsFor(state, opts).includes(hat) ? hat : null;
}

/** The requirement line for a hat that is still locked, or null once earned. */
export function hatRequirement(key) {
  const hat = HATS.find(h => h.key === key);
  if (!hat) return null;
  return hat.devotion ? `Devotion ${hat.devotion}` : `Level ${hat.level}`;
}

/**
 * Every wearable gate is the same shape — a `level` or a `devotion` on the
 * registry row — so one helper serves the hats, the coats and the neckwear
 * instead of three near-identical filters that drift apart.
 */
function earnedFrom(list, state, { wardrobe = true, off = [] } = {}) {
  if (wardrobe === false) return [];
  const { level, tier } = unlockStanding(state);
  return list
    .filter(item => !off.includes(item.key))
    .filter(item => (item.devotion ? tier >= item.devotion : level >= item.level))
    .map(item => item.key);
}

/** Coat keys this pet has earned. `null` (the pet's own colours) is always on. */
export function coatsFor(state, opts = {}) {
  return earnedFrom(COATS, state, opts);
}

/** Neckwear keys this pet has earned. */
export function neckwearFor(state, opts = {}) {
  return earnedFrom(NECKWEAR, state, opts);
}

export function coatRequirement(key) {
  const coat = COATS.find(c => c.key === key);
  if (!coat) return null;
  if (coat.level === 1) return "Free";
  return coat.devotion ? `Devotion ${coat.devotion}` : `Level ${coat.level}`;
}

export function neckwearRequirement(key) {
  const neck = NECKWEAR.find(n => n.key === key);
  if (!neck) return null;
  return neck.devotion ? `Devotion ${neck.devotion}` : `Level ${neck.level}`;
}

/** The coat actually worn right now, after policy — `null` for the pet's own. */
export function visibleCoat(state, opts = {}) {
  const coat = normalize(state).cosmetics.coat;
  if (!coat) return null;
  return coatsFor(state, opts).includes(coat) ? coat : null;
}

/** The neckwear actually worn right now, after policy. */
export function visibleNeckwear(state, opts = {}) {
  const neck = normalize(state).cosmetics.neck;
  if (!neck) return null;
  return neckwearFor(state, opts).includes(neck) ? neck : null;
}

/** Days since adoption, floored. 0 when never adopted. */
export function daysAdopted(state, now = new Date()) {
  const s = normalize(state);
  if (!s.adoptedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(s.adoptedAt).getTime()) / 86_400_000));
}

/**
 * Titles earned, in registry order. Everything a title tests is derived — level,
 * devotion tier, how many companions are unlocked, how long the pet has been
 * around — so a title can never be out of step with the pet it describes.
 */
export function titlesFor(state, now = new Date()) {
  const s = normalize(state);
  if (!isAdopted(s)) return [];
  const { level, tier } = unlockStanding(s);
  const facts = {
    level,
    tier,
    unlocked: unlockedFor(s).length,
    days: daysAdopted(s, now),
  };
  return TITLES.filter(t => t.test(facts)).map(t => t.key);
}

/** The title on display, after checking it is still earned. */
export function visibleTitle(state, now = new Date()) {
  const title = normalize(state).cosmetics.title;
  if (!title) return null;
  return titlesFor(state, now).includes(title) ? title : null;
}

export function titleLabel(key) {
  return TITLES.find(t => t.key === key)?.label || null;
}

/**
 * The second companion shown beside the main one, once devotion opens the slot.
 *
 * Display only, and deliberately so: a second pet with its own XP would fork
 * the ledger, the merge rules and every "your pet" line in the app. This is the
 * stable — the companions you already earned get to stand next to you.
 */
export function buddyFor(state) {
  const s = normalize(state);
  const key = s.cosmetics.buddy;
  if (!key || key === s.petKey) return null;
  if (unlockStanding(s).tier < BUDDY_DEVOTION) return null;
  return unlockedFor(s).includes(key) ? key : null;
}

/**
 * Award XP against a stable event key. Idempotent: a key that has already paid
 * out is ignored, so callers can fire on every render or every re-sync without
 * guarding. Returns the same object identity when nothing changed, which lets
 * React bail out of a re-render.
 */
export function award(state, key, amount, now = new Date()) {
  const s = normalize(state);
  if (!key || typeof key !== "string") return s;
  if (!Number.isFinite(amount) || amount <= 0) return s;
  if (key in s.awarded) return s;
  return { ...s, awarded: { ...s.awarded, [key]: [ymd(now), amount] } };
}

/** Stable keys for the app's XP sources. Changing these re-pays old events. */
export const keyFor = {
  attendance: sessionKey => `att:${sessionKey}`,
  deadline: id => `due:${id}`,
  streak: day => `stk:${day}`,
  care: (day, n) => `care:${day}:${n}`,
};

// ── Care ────────────────────────────────────────────────────────

/** Care taps used today. Counters reset on the local day, not on a timer. */
export function careUsedToday(state, now = new Date()) {
  const s = normalize(state);
  return s.care.day === ymd(now) ? s.care.used : 0;
}

export function careLeft(state, now = new Date()) {
  return Math.max(0, CARE_DAILY_CAP - careUsedToday(state, now));
}

export function canCare(state, now = new Date()) {
  return isAdopted(state) && careLeft(state, now) > 0;
}

/**
 * Admin XP-rate multiplier, clamped. Kept here rather than in the admin UI so
 * a hand-edited or corrupt config can't hand the app a 0x (progress silently
 * frozen) or a 500x (everyone maxed overnight) rate.
 */
export const XP_RATE_MIN = 0.25;
export const XP_RATE_MAX = 3;
export function clampRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 1;
  return Math.min(XP_RATE_MAX, Math.max(XP_RATE_MIN, n));
}

/** Apply the rate to an award, never rounding a real award down to nothing. */
export function scaleXp(amount, rate = 1) {
  return Math.max(1, Math.round(amount * clampRate(rate)));
}

/**
 * A care tap: refreshes `lastSeen` (so mood responds immediately) and pays a
 * small, capped amount of XP. The cap is the anti-grind guarantee — no amount
 * of tapping outruns a student who simply marks their attendance.
 *
 * Over-cap taps still count as attention (mood updates) but earn nothing, so
 * the pet never feels unresponsive.
 */
export function care(state, action, now = new Date(), rate = 1) {
  const s = normalize(state);
  if (!isAdopted(s) || !CARE_ACTIONS.includes(action)) return s;
  const day = ymd(now);
  const used = careUsedToday(s, now);
  const touched = { ...s, lastSeen: now.getTime() };
  if (used >= CARE_DAILY_CAP) return touched;
  const xp = Math.round(scaleXp(XP.care, rate) * devotionMultiplier(s, now));
  const next = award(touched, keyFor.care(day, used + 1), xp, now);
  return { ...next, care: { day, used: used + 1 } };
}

/**
 * Consecutive days, ending today or yesterday, on which the pet was looked
 * after. Read back out of the ledger rather than stored as a counter — a
 * counter would have to survive the same offline merge every other field does,
 * and the ledger already knows.
 *
 * Bounded by `LEDGER_DAYS`, so a
 * hundred-day streak reads as thirty, which is well past where the multiplier
 * caps out anyway.
 */
export function careStreak(state, now = new Date()) {
  return ledgerStreak(state, now, "care:");
}

/**
 * Consecutive class-days with at least one `att:` award, counted back from today.
 * What "hyped" reads.
 *
 * `classDays` is the set of ISO dates that have a scheduled class (the pet
 * context supplies it). Days outside it - weekends, holidays - never break the
 * run. Today does not break it either: its classes may not have happened yet,
 * so counting starts from the last class-day that has finished. Without
 * `classDays`, weekends are skipped and any other unmarked day breaks it.
 */
export function attendanceStreak(state, now = new Date(), classDays = null) {
  const s = normalize(state);
  const attended = new Set();
  for (const key of Object.keys(s.awarded)) {
    const day = attendanceDayOf(key);
    if (day) attended.add(day);
  }
  if (attended.size === 0) return 0;
  const today = ymd(now);
  const cursor = new Date(now);
  let streak = 0;
  for (let i = 0; i <= LEDGER_DAYS; i++, cursor.setDate(cursor.getDate() - 1)) {
    const day = ymd(cursor);
    if (attended.has(day)) { streak++; continue; }
    if (day === today) continue;
    const dow = cursor.getDay();
    const offDay = classDays ? !classDays.has(day) : dow === 0 || dow === 6;
    if (!offDay) break;
  }
  return streak;
}

/**
 * The class date an `att:` key belongs to, or null.
 *
 * Read with a pattern rather than `split(":")`: a real key embeds the session
 * key, `att:2026-10-16_09:00_SCM_A`, and the colon inside the start time cut
 * the date to "2026-10-16_09", so no attended day ever matched and "hyped"
 * could not fire.
 */
const ATT_DAY = /^att:(\d{4}-\d{2}-\d{2})/;
export function attendanceDayOf(key) {
  const m = ATT_DAY.exec(key);
  return m ? m[1] : null;
}

function ledgerStreak(state, now, prefix) {
  const s = normalize(state);
  const days = new Set();
  for (const key of Object.keys(s.awarded)) {
    if (key.startsWith(prefix)) days.add(key.split(":")[1]);
  }
  if (days.size === 0) return 0;
  const cursor = new Date(now);
  // A streak is not broken until the day it is missed is over, so a student
  // who has not opened the app yet today still holds yesterday's streak.
  if (!days.has(ymd(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(ymd(cursor)) && streak <= LEDGER_DAYS) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Streak days at which the care multiplier stops growing. */
export const STREAK_CAP = 10;

/**
 * How much a care tap is worth once the pet is maxed out.
 *
 * From DEVOTION_BASE_LEVEL (12) on, devotion runs alongside the last levels,
 * and it is a flat 270 XP a tier off care taps worth a few — so the late stretch
 * of the curve was also the slowest, which is exactly backwards. A streak scales
 * that up to 1.5x.
 *
 * Below level 12 this returns 1: the level curve is already paced, and speeding
 * it up would just bring people to the same dead end sooner. The multiplier is
 * applied when the XP is *awarded* and then written to the ledger, so replaying
 * an event key still pays out what it originally paid — `award` stays
 * idempotent, which is the one property this whole model rests on.
 */
export function devotionMultiplier(state, now = new Date()) {
  const s = normalize(state);
  if (levelFor(xpOf(s)) < DEVOTION_BASE_LEVEL) return 1;
  const streak = Math.min(STREAK_CAP, careStreak(s, now));
  return 1 + (streak / STREAK_CAP) * 0.5;
}

// ── Mood ────────────────────────────────────────────────────────

/**
 * Every mood, brightest first. Three groups, and the order below is also the
 * order `moodFor` tries them in:
 *
 *   moments   celebrating, reunion, proud — short latches fired by something that just
 *             happened. Session-only (see `usePet`), never persisted.
 *   context   focused, restless, relaxed — what the *timetable* is doing. The
 *             pet lives inside a schedule app; before this it was the only
 *             thing in the app that didn't know what day it was.
 *   baseline  the original clock-and-attention ladder.
 */
export const MOODS = [
  "celebrating", "reunion", "proud", "birthday", "festive", "weekend", "excited", "focused",
  "restless", "determined", "playful", "happy", "hyped", "curious", "rooting", "content",
  "relaxed", "cozy", "tired", "sleepy", "bored", "missing",
];

/** Attendance streak, in class-days, at which the pet turns "hyped". */
export const HYPED_STREAK = 5;

/** Hours away after which coming back and caring for the pet is a "reunion". */
export const REUNION_HOURS = 72;

/**
 * Moods that only exist on a handful of days a year.
 *
 * Derived from the calendar and the pet's own adoption date, so they need no
 * context from the app and no admin switch to turn on - the same reason the
 * mood ladder reads the clock itself. A companion that quietly remembers the
 * day you adopted it is the cheapest warmth in the whole feature.
 *
 * The anniversary needs the pet to have actually been around for close to a
 * year: a pet adopted on the 3rd must not have a birthday on the 3rd of the
 * following month.
 */
export function seasonFor(state, now = new Date()) {
  const s = normalize(state);
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (s.adoptedAt) {
    const [, m, d] = String(s.adoptedAt).split("-").map(Number);
    if (m === month && d === day && daysAdopted(s, now) >= 360) return "birthday";
  }
  // Year's end. Deliberately a secular window - the app's cohort is not one
  // faith and a companion should not assume.
  if ((month === 12 && day >= 24) || (month === 1 && day <= 1)) return "festive";
  return null;
}

/** How long a one-off "moment" mood holds the pet before it drops back. */
export const MOMENT_MS = 30_000;

/** Hours since the pet was last interacted with. `Infinity` if never. */
export function hoursSince(state, now = new Date()) {
  const s = normalize(state);
  if (!s.lastSeen) return Infinity;
  return Math.max(0, (now.getTime() - s.lastSeen) / 3_600_000);
}

/**
 * Mood, derived. Deliberately bottoms out at "missing" — the pet never gets
 * sick, never starves, never dies and never loses a level. Term breaks, exam
 * weeks and dead phones are normal here; guilt mechanics would make this
 * feature a liability. See docs/pet-companion-plan.md §2.
 */
/** Local hour the pet starts reading as tired. Bedtime ("sleepy") is 22:00. */
const EVENING_HOUR = 19;

/** Minutes before a class starts that the pet begins to fidget. */
export const RESTLESS_MINS = 10;

/** How far ahead an exam counts as "this week" for the pet's benefit. */
export const EXAM_HORIZON_DAYS = 5;

/**
 * @typedef {object} MoodContext
 * @property {boolean} [inClass]      A class or exam is in session right now.
 * @property {number|null} [minsToClass] Minutes until the next one starts.
 * @property {number|null} [classesToday] Today's class count; null ⇒ unknown.
 * @property {boolean} [examSoon]    An exam falls within the next few days.
 * @property {number} [momentUntil]   Epoch ms a `moment` mood holds until.
 * @property {Set<string>} [classDays] ISO dates with a scheduled class.
 * @property {boolean} [deadlineDueToday] An assignment is due today and not cleared.
 * @property {string} [moment]        Which one: "celebrating", "reunion" or "proud".
 */

export function moodFor(state, now = new Date(), ctx = {}) {
  return moodExplainFor(state, now, ctx).mood;
}

/**
 * The same ladder as `moodFor`, plus the reason it stopped where it did.
 *
 * The pet reads the timetable — that is the whole point of it living in this
 * app rather than being a widget — but until now it had no way to say so, and
 * a companion whose mood looks arbitrary is a companion nobody trusts. One
 * short clause, phrased the way the mood copy is: never reproachful, never a
 * nag about attendance (see docs/pet-companion-plan.md §2).
 *
 * `moodFor` delegates here so the ladder exists exactly once — two copies would
 * be one refactor away from telling the student a reason for a mood the pet is
 * not actually in.
 *
 * @returns {{ mood: string, because: string }}
 */
export function moodExplainFor(state, now = new Date(), ctx = {}) {
  const s = normalize(state);
  const of = (mood, because) => ({ mood, because });
  if (!isAdopted(s)) return of("content", "No companion adopted yet.");
  const hrs = hoursSince(s, now);
  const hour = now.getHours();
  // A moment outranks everything, the clock included: levelling up at 2am is
  // still worth celebrating, and a pet that slept through it would be a bug.
  if (ctx.moment && ctx.momentUntil > now.getTime()) {
    return of(ctx.moment, ctx.moment === "celebrating"
      ? "They just levelled up."
      : ctx.moment === "reunion"
        ? "You came back after a few days away."
        : "You just cleared something off the list.");
  }
  // In class beats bedtime too — a 20:00 exam should read alert, not dozing.
  if (ctx.inClass) return of("focused", "You are in class right now.");
  // Night reads as sleepy regardless of attention — a pet that's wide awake at
  // 3am is uncanny, and it gives the late-night crowd something to notice.
  if ((hour >= 22 || hour < 6) && hrs >= 0.25) return of("sleepy", "It is the middle of the night.");
  // About to start. Positive, never reproachful: this is an animal noticing
  // something is about to happen, not a nag about being late. See §2.
  if (ctx.minsToClass != null && ctx.minsToClass >= 0 && ctx.minsToClass <= RESTLESS_MINS) {
    const mins = Math.max(0, Math.round(ctx.minsToClass));
    return of("restless", mins <= 1 ? "Class is about to start." : `Class starts in ${mins} minutes.`);
  }
  // A deadline today. Resolve, not pressure: forward-leaning and sharp-eyed,
  // and it clears the moment the task is ticked off (the proud moment follows).
  if (ctx.deadlineDueToday) return of("determined", "Something is due today.");
  // The evening winds down before bedtime does. Same rule as night — the clock
  // outranks attention — so the pet flags the end of a long day back at you
  // instead of staying breezy until it abruptly falls asleep at 22:00.
  if (hour >= EVENING_HOUR && hrs >= 0.25) return of("tired", "It is getting late in the evening.");
  // Once a year each, and both sit here on purpose: under everything that tells
  // the student something useful (a class, a bedtime, an exam is not moved by a
  // birthday), over the ordinary baselines they would otherwise never beat.
  const season = seasonFor(s, now);
  if (season === "birthday") return of("birthday", "It is a year today since you adopted them.");
  const cared = careUsedToday(s, now);
  if (cared >= 3 && hrs < 2) return of("excited", "You have looked after them three times today.");
  // A second bit of care is a distinct, lively state rather than just a
  // faster version of "happy". The third tap remains the bigger excited
  // payoff, while the hard cap keeps this expressive rather than grindy.
  if (cared >= 2 && hrs < 2) return of("playful", "You have looked after them twice today.");
  if (cared >= 1 && hrs < 6) return of("happy", "You looked after them today.");
  if (hrs < 24 && attendanceStreak(s, now, ctx.classDays) >= HYPED_STREAK) return of("hyped", "You have made it to class five days running.");
  // Exam week. The app already knows the calendar, so the pet may as well: it
  // sits up and stays close. Pointedly NOT anxious or nagging — the one thing
  // this feature must never do is add pressure to the week that has the most
  // of it already (§2). It simply outranks the quieter baselines.
  if (hrs < 24 && ctx.examSoon) return of("rooting", "There is an exam inside the week.");
  if (season === "festive" && hrs < 24) return of("festive", "It is the end of the year.");
  // Saturday or Sunday with nothing scheduled. Ahead of curious/relaxed/cozy so
  // a weekend never reads as an ordinary free weekday.
  if (hrs < 24 && ctx.classesToday === 0 && (now.getDay() === 0 || now.getDay() === 6)) {
    return of("weekend", "It is the weekend, with nothing scheduled.");
  }
  // A new day with classes ahead gives the companion a small anticipatory
  // personality beat. It is deliberately after the imminent-class check so
  // "restless" still communicates that a class is about to begin.
  if (hrs < 24 && hour >= 6 && hour < 10 && (ctx.classesToday || 0) > 0) {
    return of("curious", "A new morning, with classes ahead.");
  }
  // "relaxed" is just "content" on a day with nothing scheduled — a Sunday
  // should not look identical to a five-class Wednesday.
  if (hrs < 24 && ctx.classesToday === 0) {
    return hour >= 15
      ? of("cozy", "Nothing on the timetable today.")
      : of("relaxed", "Nothing on the timetable today.");
  }
  if (hrs < 24) return of("content", "An ordinary day.");
  if (hrs < 72) return of("bored", "No visit for over a day.");
  return of("missing", "No visit for a few days.");
}

// ── Where the XP came from ──────────────────────────────────────

/** Ledger key prefix → human label. Order is the display order. */
export const XP_SOURCES = [
  ["att", "Classes marked"],
  ["due", "Deadlines cleared"],
  ["stk", "Daily streak"],
  ["care", "Looking after them"],
];

/**
 * XP grouped by where it came from, for the pet page's "how it earned this"
 * panel. Optionally limited to entries on or after `sinceDay` (a `ymd` string).
 *
 * The ledger is never pruned, so the parts sum to the total (plus any grant).
 */
export function xpBySource(state, sinceDay = null) {
  const s = normalize(state);
  const totals = {};
  for (const [key, [day, xp]] of Object.entries(s.awarded)) {
    if (sinceDay && day < sinceDay) continue;
    const prefix = key.slice(0, key.indexOf(":"));
    totals[prefix] = (totals[prefix] || 0) + xp;
  }
  const out = XP_SOURCES
    .filter(([prefix]) => totals[prefix])
    .map(([prefix, label]) => ({ prefix, label, xp: totals[prefix] }));
  if (!sinceDay && s.grantedXp !== 0) {
    out.push({
      prefix: "grant",
      label: s.grantedXp > 0 ? "Granted" : "Adjustment",
      xp: s.grantedXp,
    });
  }
  return out;
}

// ── Unlocks ─────────────────────────────────────────────────────

/** Keys unlocked at or below `level`, plus the starters. */
export function unlockedAtLevel(level) {
  const keys = [...STARTER_KEYS];
  for (const [lvl, key] of Object.entries(UNLOCKS)) {
    if (Number(lvl) <= level) keys.push(key);
  }
  return Array.from(new Set(keys));
}

/** Everything this pet can currently be: earned by level, union anything the
 *  record already carries (so a manual grant or a future gift can't be lost). */
export function unlockedFor(state) {
  const s = normalize(state);
  const { level, tier } = unlockStanding(s);
  const devoted = DEVOTION_COMPANIONS
    .filter(([t]) => Number(t) <= tier)
    .map(([, key]) => key);
  return Array.from(new Set([...unlockedAtLevel(level), ...devoted, ...s.unlocked]));
}

/** A companion key earned at a devotion tier (the headline one), or null.
 *  Several can share a tier — `DEVOTION_COMPANIONS` has the full list. */
export function unlockedAtDevotion(tier) {
  return DEVOTION_UNLOCKS[tier]
    || DEVOTION_COMPANIONS.find(([t]) => Number(t) === Number(tier))?.[1]
    || null;
}

/**
 * Companions `next` owns that `prev` did not, in roster-unlock order — drives
 * the "new companion" toast. Covers level AND devotion unlocks (and the legacy
 * floor), because it diffs `unlockedFor` rather than walking one table.
 */
export function companionsGained(prev, next) {
  if (!isAdopted(prev) || !isAdopted(next)) return [];
  const had = new Set(unlockedFor(prev));
  return unlockedFor(next).filter(k => !had.has(k));
}

/** Pets gained crossing from `prevLevel` to `level` — drives the unlock toast. */
export function newlyUnlocked(prevLevel, level) {
  const out = [];
  for (let l = prevLevel + 1; l <= level; l++) if (UNLOCKS[l]) out.push(UNLOCKS[l]);
  return out;
}

// ── Maintenance & merge ─────────────────────────────────────────

/**
 * Merge two copies of the same pet — the local cache and the cloud row, or two
 * devices that both earned XP offline.
 *
 * The ledger is UNIONED and XP recomputed from it. Last-write-wins on an XP
 * integer would silently discard a day's earnings from whichever device wrote
 * first, and neither copy would know it happened.
 *
 * There is no `baseXp` any more: folding old entries into it and then unioning
 * them back in from the server double-counted XP on every sync. The ledger is
 * kept whole instead (it is a few hundred small entries a term).
 */
export function mergePets(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!isAdopted(left)) return right;
  if (!isAdopted(right)) return left;
  // The more recently touched copy wins on cosmetic/identity fields.
  const [recent, older] = left.lastSeen >= right.lastSeen ? [left, right] : [right, left];
  const careDay = recent.care.day === older.care.day
    ? { day: recent.care.day, used: Math.max(recent.care.used, older.care.used) }
    : recent.care;
  return {
    ...recent,
    // Server-owned and monotonic; the row overrides it in syncPetFromCloud anyway.
    legacyXp: Math.max(left.legacyXp, right.legacyXp),
    // Server-owned and now signed, so `max` would quietly undo a penalty
    // (max(-200, 0) === 0). The more recently touched copy wins here, and
    // syncPetFromCloud overrides it from the remote row anyway.
    grantedXp: recent.grantedXp,
    companionEnabled: recent.companionEnabled,
    awarded: { ...older.awarded, ...recent.awarded },
    care: careDay,
    lastSeen: Math.max(left.lastSeen, right.lastSeen),
    adoptedAt: [left.adoptedAt, right.adoptedAt].filter(Boolean).sort()[0] || null,
    unlocked: Array.from(new Set([...left.unlocked, ...right.unlocked])),
  };
}

/**
 * A friend's cosmetics, kept only where the friend's standing earns them.
 *
 * Friends never see the ledger, so they cannot run `visibleHat` and friends.
 * `get_friend_pets` instead returns the owner's server-computed unlock standing
 * (`{ level, tier }`, legacy floor included) and this re-applies the registry
 * gates to it, so a hand-edited row cannot show a friend a crown. Titles gated
 * on facts the projection does not carry (companions owned, days adopted) are
 * let through; they are cosmetic and the level/tier ones cover the big claims.
 */
export function friendCosmetics({ hat = null, neck = null, coat = null, title = null } = {}, { level = 1, tier = 0 } = {}) {
  const ok = (list, key) => {
    const item = list.find(i => i.key === key);
    if (!item) return null;
    return (item.devotion ? tier >= item.devotion : level >= item.level) ? key : null;
  };
  let shownTitle = null;
  if (TITLE_KEYS.has(title)) {
    const t = TITLES.find(x => x.key === title);
    shownTitle = t.test({ level, tier, unlocked: Infinity, days: Infinity }) ? title : null;
  }
  return { hat: ok(HATS, hat), neck: ok(NECKWEAR, neck), coat: ok(COATS, coat), title: shownTitle };
}

/**
 * The compact public projection — the ONLY shape that may reach another
 * student's screen. No XP, no ledger, no timestamps, no streak.
 */
export function publicSummary(state) {
  const s = normalize(state);
  if (!isAdopted(s)) return null;
  // Cosmetics ride along now that `get_friend_pets` projects them (migration
  // 20260906120000_pet_public_cosmetics.sql). This summary is validated the
  // way the wearer's own view is. The RPC itself reads the raw cosmetics
  // column, so the receiving side re-checks them with `friendCosmetics`.
  //
  // Titles are deliberately included and the buddy is deliberately not: a
  // title is a fact about the pet, the buddy is a second animal to draw, and
  // the friends list already renders dozens of these.
  return {
    key: s.petKey,
    name: s.name,
    level: levelFor(xpOf(s)),
    hat: visibleHat(s),
    neck: visibleNeckwear(s),
    coat: visibleCoat(s),
    title: visibleTitle(s),
  };
}
