// Pet companion — pure mechanics.
//
// No React, no storage, no network. Every function is a pure transform over a
// plain state object, so the whole feature can be reasoned about (and tested)
// without a browser or a Supabase row. `petStorage.js` owns persistence;
// `usePet.js` owns wiring. This file owns the rules.
//
// Two things are deliberately DERIVED rather than stored:
//
//   • XP    — the sum of the award ledger (+ `baseXp` for pruned history).
//   • mood  — a function of recency, today's care and the clock.
//
// Storing either would let a cached copy disagree with the cloud row after an
// offline stretch, and there'd be no way to tell which was right. Deriving them
// makes a two-device merge deterministic: union the ledgers and recompute.
//
// See docs/pet-companion-plan.md §4.

import { ymd } from "./datetime.js";

// ── Tuning ──────────────────────────────────────────────────────
// One block, on purpose: balancing this feature means editing numbers here and
// nothing else. Rates assume ~3-4 classes on a teaching day, so a normal
// student earns roughly 40-50 XP/day and reaches MAX_LEVEL near the end of term.
/**
 * Earn rates, tuned against the actual term rather than picked by feel.
 *
 * The original numbers were set before the roster ran to level 12, and they
 * were badly short: modelled over this term's real schedule (107 days, 90
 * teaching days, ~115 classes for the median student), a student who marked
 * EVERY class, opened the app every day and cleared fourteen deadlines finished
 * the term on 2607 XP — level 9. Spark, Leafy, Nova and Cinder sat behind
 * levels 11 and 12 and devotion tiers nobody could reach. Four companions and
 * the whole devotion wardrobe were unreachable content.
 *
 * Re-tuned so an ENGAGED student — marks ~85% of classes, opens the app daily,
 * two or three care taps, eight deadlines over the term — earns the last
 * companion at about 80% of the way through:
 *
 *   Spark  (Lv 11)  ~48%      Nova   (Dv 2)  ~68%
 *   Leafy  (Lv 12)  ~58%      Cinder (Dv 4)  ~80%
 *
 * A student who marks everything gets there around 64% and can finish the whole
 * devotion wardrobe by ~94%; a casual one (marks half, opens most days) ends the
 * term around level 10 with twelve of the sixteen — the premium four stay worth
 * something. Attendance is deliberately 56% of a typical total: the pet levels
 * because you showed up, not because you tapped it (docs §2).
 *
 * The LEVEL CURVE is deliberately untouched. Rates only affect XP awarded from
 * here on — the ledger stores what each event actually paid — whereas moving
 * the curve would re-map every existing pet's level overnight.
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
export const MAX_LEVEL = 12;

/** Ledger retention. An event older than this can no longer newly arrive from
 *  a sync, so keeping its key only costs bytes in every row read. */
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
  { key: "crown", label: "Crown", level: MAX_LEVEL },
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
 * shipping a second copy of every SVG: fourteen pets x six coats would be
 * eighty-four drawings to keep in sync, and the first divergence would be a bug
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
  { key: "chain", label: "Charm chain", devotion: 5 },
];
const NECK_KEYS = new Set(NECKWEAR.map(n => n.key));

/**
 * Companions earned past the level cap.
 *
 * Levels 1-12 hand out all fourteen pets, so devotion — the only progression
 * left after that — had nothing but hats. These two are the carrot at the top
 * of the curve, and they are gated on tier rather than level so they can never
 * arrive before the roster is complete.
 *
 * Tiers 2 and 4 rather than 4 and 8: the pets have to be reachable inside a
 * term (the last one lands at ~80% of it — see XP), while the tiers above them
 * carry cosmetics, which are allowed to outlast the term.
 */
export const DEVOTION_UNLOCKS = { 2: "nova", 4: "cinder" };

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
  { key: "grown", label: "Fully grown", test: ({ level }) => level >= MAX_LEVEL },
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
 * Levels are compared before devotion tiers because that is the order they
 * arrive in, and `null` means there is genuinely nothing left.
 */
export function nextUnlockFor(state) {
  const s = normalize(state);
  const xp = xpOf(s);
  const level = levelFor(xp);
  const { tier } = devotionFor(xp);

  const byLevel = [];
  const byDevotion = [];
  for (const [lvl, key] of Object.entries(UNLOCKS)) {
    byLevel.push({ kind: "companion", key, label: key, at: Number(lvl) });
  }
  for (const [t, key] of Object.entries(DEVOTION_UNLOCKS)) {
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
  if (nextLevel) return { ...nextLevel, by: "level" };
  const nextTier = byDevotion.filter(r => r.at > tier).sort((a, b) => a.at - b.at)[0];
  return nextTier ? { ...nextTier, by: "devotion" } : null;
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
  { key: "elder", label: "Elder", from: MAX_LEVEL },
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

/** level → pet key unlocked on reaching it. All 12 are earned by level 10. */
export const UNLOCKS = {
  2: "fox", 3: "penguin", 4: "panda", 5: "chick", 6: "koala",
  7: "otter", 8: "rover", 9: "raccoon", 10: "axolotl",
  // 11 and 12 previously unlocked nothing — the roster ran out before the
  // curve did, so the last two level-ups gave no new companion.
  11: "spark", 12: "leafy",
};

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
    baseXp: 0,         // XP from ledger entries since pruned
    grantedXp: 0,      // signed admin adjustment; server-owned, never written here
    companionEnabled: true, // per-student kill switch; server-owned too
    awarded: {},       // { eventKey: [ymd, xp] }
    care: { day: null, used: 0 },
    lastSeen: 0,
    unlocked: [],
    cosmetics: { accessory: true, hat: null, coat: null, neck: null, title: null, buddy: null },
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
function isNormalized(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  if (raw.v !== 1) return false;
  if (raw.petKey !== null && typeof raw.petKey !== "string") return false;
  if (typeof raw.name !== "string" || raw.name.length > 24) return false;
  if (!Number.isFinite(raw.baseXp) || raw.baseXp < 0) return false;
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
  if (!Array.isArray(raw.unlocked) || raw.unlocked.some(k => typeof k !== "string")) return false;
  if (!raw.cosmetics || typeof raw.cosmetics.accessory !== "boolean") return false;
  if (raw.cosmetics.hat !== null && !HAT_KEYS.has(raw.cosmetics.hat)) return false;
  if (raw.cosmetics.coat !== null && !COAT_KEYS.has(raw.cosmetics.coat)) return false;
  if (raw.cosmetics.neck !== null && !NECK_KEYS.has(raw.cosmetics.neck)) return false;
  if (raw.cosmetics.title !== null && !TITLE_KEYS.has(raw.cosmetics.title)) return false;
  if (raw.cosmetics.buddy !== null && typeof raw.cosmetics.buddy !== "string") return false;
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
    petKey: typeof raw.petKey === "string" ? raw.petKey : null,
    name: typeof raw.name === "string" ? raw.name.slice(0, 24) : "",
    baseXp: Number.isFinite(raw.baseXp) && raw.baseXp > 0 ? raw.baseXp : 0,
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
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter(k => typeof k === "string") : [],
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
      buddy: typeof raw.cosmetics?.buddy === "string" ? raw.cosmetics.buddy : null,
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
  // Each wearable validates against what was EARNED (never against cohort
  // policy) for the reason spelled out under the hat below.
  if (key === "coat" || key === "neck" || key === "title" || key === "buddy") {
    const earned = key === "coat" ? coatsFor(s)
      : key === "neck" ? neckwearFor(s)
      : key === "title" ? titlesFor(s)
      : devotionFor(xpOf(s)).tier >= BUDDY_DEVOTION ? unlockedFor(s).filter(k => k !== s.petKey) : [];
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

/** Total XP: pruned history plus every entry still in the ledger. */
export function xpOf(state) {
  const s = normalize(state);
  let total = s.baseXp + s.grantedXp;
  for (const [, xp] of Object.values(s.awarded)) total += xp;
  return Math.max(0, total);
}

/** Cumulative XP needed to *reach* `level` (level 1 costs nothing). */
export function xpToReach(level) {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) - 1;
  return n * LEVEL_BASE + LEVEL_STEP * (n * (n - 1)) / 2;
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
 * Progress past MAX_LEVEL, as a "devotion" tier.
 *
 * Deliberately not a second level bar: it unlocks nothing but cosmetics, it is
 * never shown as a rank against anybody else, and it tops out too. A student
 * who maxes their pet and then stops is not punished for it — they simply keep
 * the pet they earned.
 */
export function devotionFor(xp) {
  const cap = xpToReach(MAX_LEVEL);
  const over = Math.max(0, (xp || 0) - cap);
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

/**
 * Hat keys this pet can wear right now, in registry order.
 *
 * Two independent gates: what the student earned, and what the cohort config
 * still allows. `hatsOff` is the admin withdrawing a specific wearable — the
 * flower crown in exam week, the devil horns because someone complained.
 */
export function hatsFor(state, { wardrobe = true, hatsOff = [] } = {}) {
  if (wardrobe === false) return [];
  const xp = xpOf(state);
  const level = levelFor(xp);
  const { tier } = devotionFor(xp);
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
  const xp = xpOf(state);
  const level = levelFor(xp);
  const { tier } = devotionFor(xp);
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
  const xp = xpOf(s);
  const facts = {
    level: levelFor(xp),
    tier: devotionFor(xp).tier,
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
  if (devotionFor(xpOf(s)).tier < BUDDY_DEVOTION) return null;
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
 * Bounded by `LEDGER_DAYS`, because entries older than that are pruned; a
 * hundred-day streak reads as thirty, which is well past where the multiplier
 * caps out anyway.
 */
export function careStreak(state, now = new Date()) {
  const s = normalize(state);
  const days = new Set();
  for (const key of Object.keys(s.awarded)) {
    if (key.startsWith("care:")) days.add(key.split(":")[1]);
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
 * At MAX_LEVEL the only progression left is devotion, and it is a flat 400 XP a
 * tier off care taps worth 2 — so the last stretch of the curve was also the
 * slowest, which is exactly backwards. A streak scales that up to 1.5x.
 *
 * Below the cap this returns 1: the level curve is already paced, and speeding
 * it up would just bring people to the same dead end sooner. The multiplier is
 * applied when the XP is *awarded* and then written to the ledger, so replaying
 * an event key still pays out what it originally paid — `award` stays
 * idempotent, which is the one property this whole model rests on.
 */
export function devotionMultiplier(state, now = new Date()) {
  const s = normalize(state);
  if (levelFor(xpOf(s)) < MAX_LEVEL) return 1;
  const streak = Math.min(STREAK_CAP, careStreak(s, now));
  return 1 + (streak / STREAK_CAP) * 0.5;
}

// ── Mood ────────────────────────────────────────────────────────

/**
 * Every mood, brightest first. Three groups, and the order below is also the
 * order `moodFor` tries them in:
 *
 *   moments   celebrating, proud — short latches fired by something that just
 *             happened. Session-only (see `usePet`), never persisted.
 *   context   focused, restless, relaxed — what the *timetable* is doing. The
 *             pet lives inside a schedule app; before this it was the only
 *             thing in the app that didn't know what day it was.
 *   baseline  the original clock-and-attention ladder.
 */
export const MOODS = [
  "celebrating", "proud", "birthday", "festive", "excited", "focused", "restless",
  "playful", "happy", "curious", "rooting", "content", "relaxed", "cozy",
  "tired", "sleepy", "bored", "missing",
];

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
 * @property {string} [moment]        Which one: "celebrating" or "proud".
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
  // Exam week. The app already knows the calendar, so the pet may as well: it
  // sits up and stays close. Pointedly NOT anxious or nagging — the one thing
  // this feature must never do is add pressure to the week that has the most
  // of it already (§2). It simply outranks the quieter baselines.
  if (hrs < 24 && ctx.examSoon) return of("rooting", "There is an exam inside the week.");
  if (season === "festive" && hrs < 24) return of("festive", "It is the end of the year.");
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
 * Pruned history has no surviving source, so it is reported as "Earlier" rather
 * than being silently dropped — the parts must always sum to the total.
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
  if (!sinceDay && s.baseXp > 0) out.push({ prefix: "base", label: "Earlier", xp: s.baseXp });
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
  const xp = xpOf(s);
  const { tier } = devotionFor(xp);
  const devoted = Object.entries(DEVOTION_UNLOCKS)
    .filter(([t]) => Number(t) <= tier)
    .map(([, key]) => key);
  return Array.from(new Set([...unlockedAtLevel(levelFor(xp)), ...devoted, ...s.unlocked]));
}

/** Companion key earned at a devotion tier, or null. */
export function unlockedAtDevotion(tier) {
  return DEVOTION_UNLOCKS[tier] || null;
}

/** Pets gained crossing from `prevLevel` to `level` — drives the unlock toast. */
export function newlyUnlocked(prevLevel, level) {
  const out = [];
  for (let l = prevLevel + 1; l <= level; l++) if (UNLOCKS[l]) out.push(UNLOCKS[l]);
  return out;
}

// ── Maintenance & merge ─────────────────────────────────────────

/**
 * Drop ledger entries older than LEDGER_DAYS, folding their XP into `baseXp`
 * so pruning never costs progress. Pure: returns a new state.
 */
export function prune(state, now = new Date()) {
  const s = normalize(state);
  const cutoff = new Date(now.getTime() - LEDGER_DAYS * 86_400_000);
  const cutoffDay = ymd(cutoff);
  const kept = {};
  let folded = 0;
  for (const [k, v] of Object.entries(s.awarded)) {
    if (v[0] < cutoffDay) folded += v[1];
    else kept[k] = v;
  }
  if (!folded) return s;
  return { ...s, baseXp: s.baseXp + folded, awarded: kept };
}

/**
 * Merge two copies of the same pet — the local cache and the cloud row, or two
 * devices that both earned XP offline.
 *
 * The ledger is UNIONED and XP recomputed from it. Last-write-wins on an XP
 * integer would silently discard a day's earnings from whichever device wrote
 * first, and neither copy would know it happened.
 *
 * `baseXp` takes the max: it only grows through pruning, both sides observe the
 * same events, so the larger value is the one that has pruned further. Two
 * devices that pruned disjoint sets while >30 days apart could under-count —
 * accepted, since a sync gap that long means one device is effectively dead.
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
    baseXp: Math.max(left.baseXp, right.baseXp),
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
 * The compact public projection — the ONLY shape that may reach another
 * student's screen. No XP, no ledger, no timestamps, no streak.
 */
export function publicSummary(state) {
  const s = normalize(state);
  if (!isAdopted(s)) return null;
  // Cosmetics ride along now that `get_friend_pets` projects them (migration
  // 20260906120000_pet_public_cosmetics.sql). They are validated the same way
  // the wearer's own view validates them — `visibleHat` and friends refuse a
  // cosmetic that is no longer earned — so a hand-edited row cannot show a
  // friend a crown the owner never reached.
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
