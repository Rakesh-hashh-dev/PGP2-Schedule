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

/** level → pet key unlocked on reaching it. All 12 are earned by level 10. */
export const UNLOCKS = {
  2: "fox", 3: "penguin", 4: "panda", 5: "chick", 6: "koala",
  7: "otter", 8: "rover", 9: "raccoon", 10: "axolotl",
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
    grantedXp: 0,      // admin-granted XP; server-owned, never written here
    awarded: {},       // { eventKey: [ymd, xp] }
    care: { day: null, used: 0 },
    lastSeen: 0,
    unlocked: [],
    cosmetics: { accessory: true },
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
  if (!Number.isFinite(raw.grantedXp) || raw.grantedXp < 0) return false;
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
    grantedXp: Number.isFinite(raw.grantedXp) && raw.grantedXp > 0 ? raw.grantedXp : 0,
    awarded,
    care: {
      day: typeof raw.care?.day === "string" ? raw.care.day : null,
      used: Number.isFinite(raw.care?.used) ? Math.max(0, Math.min(CARE_DAILY_CAP, raw.care.used)) : 0,
    },
    lastSeen: Number.isFinite(raw.lastSeen) && raw.lastSeen > 0 ? raw.lastSeen : 0,
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter(k => typeof k === "string") : [],
    cosmetics: { accessory: raw.cosmetics?.accessory !== false },
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
 * Toggle a cosmetic. Currently only `accessory` (the collar / leaf / scarf that
 * every SVG already carries in its own `.dg-pet-accessory` group), so this is a
 * visibility switch rather than new art.
 */
export function setCosmetic(state, key, on) {
  const s = normalize(state);
  if (s.cosmetics[key] === Boolean(on)) return s;
  return { ...s, cosmetics: { ...s.cosmetics, [key]: Boolean(on) } };
}

// ── XP & levels ─────────────────────────────────────────────────

/** Total XP: pruned history plus every entry still in the ledger. */
export function xpOf(state) {
  const s = normalize(state);
  let total = s.baseXp + s.grantedXp;
  for (const [, xp] of Object.values(s.awarded)) total += xp;
  return total;
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

export const MOODS = ["excited", "happy", "content", "sleepy", "bored", "missing"];

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
export function moodFor(state, now = new Date()) {
  const s = normalize(state);
  if (!isAdopted(s)) return "content";
  const hrs = hoursSince(s, now);
  const hour = now.getHours();
  // Night reads as sleepy regardless of attention — a pet that's wide awake at
  // 3am is uncanny, and it gives the late-night crowd something to notice.
  if ((hour >= 22 || hour < 6) && hrs >= 0.25) return "sleepy";
  const cared = careUsedToday(s, now);
  if (cared >= 2 && hrs < 2) return "excited";
  if (cared >= 1 && hrs < 6) return "happy";
  if (hrs < 24) return "content";
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
  if (!sinceDay && s.grantedXp > 0) out.push({ prefix: "grant", label: "Granted", xp: s.grantedXp });
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
    // Server-owned: the cloud copy is authoritative, so take the larger rather
    // than letting a stale local cache erase a grant made while offline.
    grantedXp: Math.max(left.grantedXp, right.grantedXp),
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
  return { key: s.petKey, name: s.name, level: levelFor(xpOf(s)) };
}
