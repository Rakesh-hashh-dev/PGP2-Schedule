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
export const XP = {
  attendance: 10,   // per class marked (any status — honesty is the point, not presence)
  deadline: 20,     // per assignment cleared
  streak: 5,        // per day of an unbroken open-the-app streak
  care: 2,          // per care tap, hard-capped below
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
export const DEVOTION_STEP = 400;
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
  { key: "halo", label: "Halo", devotion: 3 },
  { key: "ember", label: "Ember", devotion: 6 },
];

/** Fast membership test for `normalize`, which runs on every storage read. */
const HAT_KEYS = new Set(HATS.map(h => h.key));

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
    cosmetics: { accessory: true, hat: null },
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
  const next = award(touched, keyFor.care(day, used + 1), scaleXp(XP.care, rate), now);
  return { ...next, care: { day, used: used + 1 } };
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
  "celebrating", "proud", "excited", "focused", "restless",
  "happy", "rooting", "content", "relaxed", "tired", "sleepy", "bored", "missing",
];

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
  const s = normalize(state);
  if (!isAdopted(s)) return "content";
  const hrs = hoursSince(s, now);
  const hour = now.getHours();
  // A moment outranks everything, the clock included: levelling up at 2am is
  // still worth celebrating, and a pet that slept through it would be a bug.
  if (ctx.moment && ctx.momentUntil > now.getTime()) return ctx.moment;
  // In class beats bedtime too — a 20:00 exam should read alert, not dozing.
  if (ctx.inClass) return "focused";
  // Night reads as sleepy regardless of attention — a pet that's wide awake at
  // 3am is uncanny, and it gives the late-night crowd something to notice.
  if ((hour >= 22 || hour < 6) && hrs >= 0.25) return "sleepy";
  // About to start. Positive, never reproachful: this is an animal noticing
  // something is about to happen, not a nag about being late. See §2.
  if (ctx.minsToClass != null && ctx.minsToClass >= 0 && ctx.minsToClass <= RESTLESS_MINS) return "restless";
  // The evening winds down before bedtime does. Same rule as night — the clock
  // outranks attention — so the pet flags the end of a long day back at you
  // instead of staying breezy until it abruptly falls asleep at 22:00.
  if (hour >= EVENING_HOUR && hrs >= 0.25) return "tired";
  const cared = careUsedToday(s, now);
  if (cared >= 2 && hrs < 2) return "excited";
  if (cared >= 1 && hrs < 6) return "happy";
  // Exam week. The app already knows the calendar, so the pet may as well: it
  // sits up and stays close. Pointedly NOT anxious or nagging — the one thing
  // this feature must never do is add pressure to the week that has the most
  // of it already (§2). It simply outranks the quieter baselines.
  if (hrs < 24 && ctx.examSoon) return "rooting";
  // "relaxed" is just "content" on a day with nothing scheduled — a Sunday
  // should not look identical to a five-class Wednesday.
  if (hrs < 24) return ctx.classesToday === 0 ? "relaxed" : "content";
  if (hrs < 72) return "bored";
  return "missing";
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
  return Array.from(new Set([...unlockedAtLevel(levelFor(xpOf(s))), ...s.unlocked]));
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
  // Deliberately no hat: `get_friend_pets` projects key/name/level only, and
  // widening it needs a migration. Adding the field here first would ship a
  // frontend that reads a column prod does not have yet.
  return { key: s.petKey, name: s.name, level: levelFor(xpOf(s)) };
}
