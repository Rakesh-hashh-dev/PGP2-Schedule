import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PETS } from "../components/greetingPets.jsx";
import {
  XP, CARE_DAILY_CAP, MAX_LEVEL, LEDGER_DAYS, STARTER_KEYS, UNLOCKS,
  clampRate, scaleXp, XP_RATE_MIN, XP_RATE_MAX,
  emptyPet, normalize, isAdopted, adopt, rename, switchTo,
  xpOf, xpToReach, levelFor, levelProgress, award, keyFor,
  careUsedToday, careLeft, canCare, care,
  hoursSince, moodFor, moodExplainFor, MOODS,
  devotionFor, hatsFor, hatRequirement, setCosmetic, visibleHat, normalize as normalizePet,
  DEVOTION_STEP, MAX_DEVOTION, MAX_LEVEL as MAXLVL,
  GROWTH_STAGES, growthStageFor, nextGrowthStage,
  unlockedAtLevel, unlockedFor, newlyUnlocked,
  prune, mergePets, publicSummary, xpBySource,
  HATS, COATS, NECKWEAR, TITLES, DEVOTION_UNLOCKS, BUDDY_DEVOTION, STREAK_CAP,
  coatsFor, neckwearFor, coatRequirement, neckwearRequirement,
  visibleCoat, visibleNeckwear, titlesFor, visibleTitle, titleLabel,
  buddyFor, daysAdopted, seasonFor, careStreak, devotionMultiplier, unlockedAtDevotion,
  nextUnlockFor,
} from "./pet.js";

const at = (iso) => new Date(iso);
const adopted = (now = at("2026-09-04T10:00:00")) => adopt(emptyPet(), "cat", "Mochi", now);

describe("adoption", () => {
  it("starts un-adopted", () => {
    expect(isAdopted(emptyPet())).toBe(false);
    expect(publicSummary(emptyPet())).toBeNull();
  });
  it("adopting sets identity, day and the starter roster", () => {
    const s = adopted();
    expect(isAdopted(s)).toBe(true);
    expect(s.petKey).toBe("cat");
    expect(s.name).toBe("Mochi");
    expect(s.adoptedAt).toBe("2026-09-04");
    expect(s.unlocked).toEqual(expect.arrayContaining(STARTER_KEYS));
  });
  it("ignores a missing pet key", () => {
    expect(isAdopted(adopt(emptyPet(), null, "x"))).toBe(false);
  });
  it("caps names at 24 chars and trims them", () => {
    expect(rename(adopted(), "   Sir Fluffington the Third of Sambalpur  ").name)
      .toBe("Sir Fluffington the Thir");
  });
});

describe("xpToReach / levelFor", () => {
  it("level 1 is free and the curve rises 100, 150, 200…", () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(100);
    expect(xpToReach(3)).toBe(250);
    expect(xpToReach(4)).toBe(450);
  });
  it("holds exactly at each boundary", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(249)).toBe(2);
    expect(levelFor(250)).toBe(3);
  });
  it("clamps at MAX_LEVEL and never exceeds it", () => {
    expect(levelFor(xpToReach(MAX_LEVEL))).toBe(MAX_LEVEL);
    expect(levelFor(999_999)).toBe(MAX_LEVEL);
    expect(xpToReach(MAX_LEVEL + 5)).toBe(xpToReach(MAX_LEVEL));
  });
  it("treats junk XP as zero rather than throwing", () => {
    expect(levelFor(-500)).toBe(1);
    expect(levelFor(undefined)).toBe(1);
    expect(levelFor(NaN)).toBe(1);
  });
});

describe("levelProgress", () => {
  it("reports position within the current level", () => {
    expect(levelProgress(100)).toEqual({ level: 2, into: 0, need: 150, pct: 0, maxed: false });
    expect(levelProgress(175)).toEqual({ level: 2, into: 75, need: 150, pct: 50, maxed: false });
  });
  it("flags the max level instead of dividing by zero", () => {
    const p = levelProgress(xpToReach(MAX_LEVEL) + 400);
    expect(p).toEqual({ level: MAX_LEVEL, into: 0, need: 0, pct: 100, maxed: true });
  });
});

describe("award — idempotency", () => {
  it("pays out once per event key", () => {
    let s = adopted();
    s = award(s, keyFor.attendance("2026-09-04_10:00_SCM_A"), XP.attendance);
    expect(xpOf(s)).toBe(XP.attendance);
    s = award(s, keyFor.attendance("2026-09-04_10:00_SCM_A"), XP.attendance);
    s = award(s, keyFor.attendance("2026-09-04_10:00_SCM_A"), XP.attendance);
    expect(xpOf(s)).toBe(XP.attendance);
  });
  it("returns the same object when a key is already paid (lets React bail out)", () => {
    const first = award(adopted(), "due:asg_18", XP.deadline);
    expect(award(first, "due:asg_18", XP.deadline)).toBe(first);
  });
  it("accumulates across distinct keys", () => {
    let s = adopted();
    s = award(s, keyFor.attendance("a"), XP.attendance);
    s = award(s, keyFor.attendance("b"), XP.attendance);
    s = award(s, keyFor.deadline("asg_1"), XP.deadline);
    s = award(s, keyFor.streak("2026-09-04"), XP.streak);
    expect(xpOf(s)).toBe(XP.attendance * 2 + XP.deadline + XP.streak);
  });
  it("rejects a blank key or a non-positive amount", () => {
    const s = adopted();
    expect(xpOf(award(s, "", 10))).toBe(0);
    expect(xpOf(award(s, "k", 0))).toBe(0);
    expect(xpOf(award(s, "k", -50))).toBe(0);
    expect(xpOf(award(s, "k", NaN))).toBe(0);
  });
});

describe("care — daily cap", () => {
  const day1 = at("2026-09-04T12:00:00");
  it("pays XP up to the cap and no further", () => {
    let s = adopted(day1);
    for (let i = 0; i < CARE_DAILY_CAP; i++) s = care(s, "pet", day1);
    expect(xpOf(s)).toBe(CARE_DAILY_CAP * XP.care);
    expect(careLeft(s, day1)).toBe(0);
    expect(canCare(s, day1)).toBe(false);
  });
  it("over-cap taps still register attention but earn nothing", () => {
    let s = adopted(day1);
    for (let i = 0; i < CARE_DAILY_CAP; i++) s = care(s, "play", day1);
    const capped = xpOf(s);
    const later = at("2026-09-04T15:30:00");
    s = care(s, "play", later);
    expect(xpOf(s)).toBe(capped);
    expect(s.lastSeen).toBe(later.getTime());
  });
  it("mashing every action shares one budget", () => {
    let s = adopted(day1);
    s = care(s, "pet", day1);
    s = care(s, "play", day1);
    s = care(s, "treat", day1);
    s = care(s, "pet", day1);
    expect(xpOf(s)).toBe(CARE_DAILY_CAP * XP.care);
  });
  it("resets across a local midnight, and the new day's keys don't collide", () => {
    let s = adopted(day1);
    for (let i = 0; i < CARE_DAILY_CAP; i++) s = care(s, "pet", day1);
    const day2 = at("2026-09-05T00:05:00");
    expect(careUsedToday(s, day2)).toBe(0);
    expect(careLeft(s, day2)).toBe(CARE_DAILY_CAP);
    s = care(s, "pet", day2);
    expect(xpOf(s)).toBe((CARE_DAILY_CAP + 1) * XP.care);
  });
  it("ignores an unknown action and un-adopted state", () => {
    const s = adopted(day1);
    expect(care(s, "wrestle", day1)).toEqual(s);
    expect(xpOf(care(emptyPet(), "pet", day1))).toBe(0);
  });
});

describe("XP rate multiplier", () => {
  const day1 = at("2026-09-04T12:00:00");

  it("clamps a junk, zero or absurd rate to something survivable", () => {
    expect(clampRate(undefined)).toBe(1);
    expect(clampRate(NaN)).toBe(1);
    expect(clampRate("nope")).toBe(1);
    expect(clampRate(0)).toBe(XP_RATE_MIN);      // never freeze progress entirely
    expect(clampRate(-5)).toBe(XP_RATE_MIN);
    expect(clampRate(500)).toBe(XP_RATE_MAX);    // never max the cohort overnight
    expect(clampRate(2)).toBe(2);
  });

  it("scales an award but never rounds a real one away", () => {
    expect(scaleXp(10, 2)).toBe(20);
    expect(scaleXp(10, 0.5)).toBe(5);
    expect(scaleXp(1, 0.25)).toBe(1);            // would round to 0 without the floor
    expect(scaleXp(10)).toBe(10);
  });

  it("applies to care taps", () => {
    expect(xpOf(care(adopted(day1), "pet", day1, 2))).toBe(XP.care * 2);
    expect(xpOf(care(adopted(day1), "pet", day1))).toBe(XP.care);
  });

  it("does not let a rate change re-pay an event already awarded", () => {
    let s = award(adopted(day1), "att:s1", XP.attendance, day1);
    s = award(s, "att:s1", XP.attendance * 3, day1);
    expect(xpOf(s)).toBe(XP.attendance);
  });

  it("leaves already-banked XP alone when the rate changes", () => {
    // Amounts live in the ledger, so past awards keep what they were worth.
    let s = award(adopted(day1), "att:s1", scaleXp(XP.attendance, 1), day1);
    s = award(s, "att:s2", scaleXp(XP.attendance, 2), day1);
    expect(xpOf(s)).toBe(XP.attendance + XP.attendance * 2);
  });
});

describe("mood", () => {
  const noon = at("2026-09-04T12:00:00");
  it("is playful after two taps, then settles", () => {
    let s = adopted(noon);
    s = care(s, "pet", noon);
    s = care(s, "play", noon);
    expect(moodFor(s, noon)).toBe("playful");
    expect(moodFor(s, at("2026-09-04T18:30:00"))).toBe("content");
  });
  it("is happy after a single tap", () => {
    const s = care(adopted(noon), "treat", noon);
    expect(moodFor(s, noon)).toBe("happy");
  });
  it("uses curious mornings and cozy free afternoons", () => {
    const s = adopted(noon);
    expect(moodFor(s, at("2026-09-04T08:00:00"), { classesToday: 3 })).toBe("curious");
    expect(moodFor(s, at("2026-09-04T16:00:00"), { classesToday: 0 })).toBe("cozy");
    // The more urgent and more caring states must still take precedence.
    expect(moodFor(s, at("2026-09-04T08:00:00"), { classesToday: 3, minsToClass: 5 })).toBe("restless");
    expect(moodFor(care(s, "pet", noon), at("2026-09-04T08:00:00"), { classesToday: 3 })).toBe("happy");
  });
  it("drifts to bored then missing, and stops there", () => {
    const s = adopted(noon);
    expect(moodFor(s, at("2026-09-05T18:00:00"))).toBe("bored");
    expect(moodFor(s, at("2026-09-09T12:00:00"))).toBe("missing");
    expect(moodFor(s, at("2027-09-09T12:00:00"))).toBe("missing");
  });
  it("reads tired through the evening, before bedtime", () => {
    const s = adopted(noon);
    expect(moodFor(s, at("2026-09-04T18:45:00"))).toBe("content");
    expect(moodFor(s, at("2026-09-04T19:00:00"))).toBe("tired");
    expect(moodFor(s, at("2026-09-04T21:59:00"))).toBe("tired");
    expect(moodFor(s, at("2026-09-04T22:00:00"))).toBe("sleepy");
  });
  it("lets the evening outrank a good day, like night does", () => {
    const evening = at("2026-09-04T20:00:00");
    let s = care(adopted(noon), "pet", evening);
    s = care(s, "play", evening);
    // Just tapped, so it perks up — then winds back down.
    expect(moodFor(s, evening)).toBe("playful");
    expect(moodFor(s, at("2026-09-04T20:30:00"))).toBe("tired");
  });
  it("sleeps at night regardless of attention", () => {
    const s = adopted(noon);
    expect(moodFor(s, at("2026-09-04T23:30:00"))).toBe("sleepy");
    expect(moodFor(s, at("2026-09-05T03:00:00"))).toBe("sleepy");
  });
  it("wakes for a late-night tap before dozing off again", () => {
    const night = at("2026-09-04T23:30:00");
    const s = care(adopted(noon), "pet", night);
    expect(moodFor(s, night)).toBe("happy");
    expect(moodFor(s, at("2026-09-04T23:50:00"))).toBe("sleepy");
  });
  it("reads focused in class, ahead of bedtime", () => {
    const s = adopted(noon);
    expect(moodFor(s, noon, { inClass: true })).toBe("focused");
    // A 20:00 exam is not a reason to fall asleep.
    expect(moodFor(s, at("2026-09-04T23:30:00"), { inClass: true })).toBe("focused");
  });
  it("fidgets in the last ten minutes before a class", () => {
    const s = adopted(noon);
    expect(moodFor(s, noon, { minsToClass: 11 })).toBe("content");
    expect(moodFor(s, noon, { minsToClass: 10 })).toBe("restless");
    expect(moodFor(s, noon, { minsToClass: 0 })).toBe("restless");
    // A class that started already is `inClass`, not a negative countdown.
    expect(moodFor(s, noon, { minsToClass: -3 })).toBe("content");
    // Night still wins: nobody is fidgeting for an 06:00 class at 03:00.
    expect(moodFor(s, at("2026-09-05T03:00:00"), { minsToClass: 5 })).toBe("sleepy");
  });
  it("is relaxed on a day with nothing scheduled", () => {
    const s = adopted(noon);
    expect(moodFor(s, noon, { classesToday: 0 })).toBe("relaxed");
    expect(moodFor(s, noon, { classesToday: 3 })).toBe("content");
    // Unknown (schedule not loaded yet) must not read as a day off.
    expect(moodFor(s, noon, {})).toBe("content");
    // A day off you have been petting is still a good day, not just a quiet one.
    expect(moodFor(care(s, "pet", noon), noon, { classesToday: 0 })).toBe("happy");
  });
  it("lets a moment outrank everything, then expires", () => {
    const s = adopted(noon);
    const t = noon.getTime();
    const night = at("2026-09-04T23:30:00");
    expect(moodFor(s, noon, { moment: "celebrating", momentUntil: t + 30_000 })).toBe("celebrating");
    expect(moodFor(s, noon, { moment: "proud", momentUntil: t + 30_000, inClass: true })).toBe("proud");
    // Levelling up at 23:30 still gets celebrated.
    expect(moodFor(s, night, { moment: "celebrating", momentUntil: night.getTime() + 1000 })).toBe("celebrating");
    // Expired latches are ignored, not sticky.
    expect(moodFor(s, noon, { moment: "celebrating", momentUntil: t - 1 })).toBe("content");
  });
  it("roots for you when an exam is close", () => {
    const s = adopted(noon);
    expect(moodFor(s, noon, { examSoon: true })).toBe("rooting");
    // Outranks a quiet day, but never the things actually happening now.
    expect(moodFor(s, noon, { examSoon: true, classesToday: 0 })).toBe("rooting");
    expect(moodFor(s, noon, { examSoon: true, inClass: true })).toBe("focused");
    expect(moodFor(s, noon, { examSoon: true, minsToClass: 3 })).toBe("restless");
    // And it is a baseline, not a trump: a well-tended pet is still happy.
    expect(moodFor(care(s, "pet", noon), noon, { examSoon: true })).toBe("happy");
  });
  it("never reports a punishing mood", () => {
    const s = adopted(noon);
    for (const d of ["2026-09-04T13:00:00", "2026-09-06T12:00:00", "2027-01-01T12:00:00"]) {
      expect(MOODS).toContain(moodFor(s, at(d)));
    }
  });
});

describe("hoursSince", () => {
  it("is Infinity when never seen", () => {
    expect(hoursSince(emptyPet())).toBe(Infinity);
  });
  it("clamps a future lastSeen to zero rather than going negative", () => {
    const s = { ...adopted(), lastSeen: at("2026-09-05T12:00:00").getTime() };
    expect(hoursSince(s, at("2026-09-04T12:00:00"))).toBe(0);
  });
});

describe("xpBySource", () => {
  const day1 = at("2026-09-01T10:00:00");
  const day2 = at("2026-09-04T10:00:00");
  const built = () => {
    let s = adopted(day1);
    s = award(s, keyFor.attendance("s1"), XP.attendance, day1);
    s = award(s, keyFor.attendance("s2"), XP.attendance, day2);
    s = award(s, keyFor.deadline("asg_1"), XP.deadline, day2);
    s = award(s, keyFor.streak("2026-09-04"), XP.streak, day2);
    s = care(s, "pet", day2);
    return s;
  };

  it("groups the ledger by source in display order", () => {
    expect(xpBySource(built())).toEqual([
      { prefix: "att", label: "Classes marked", xp: XP.attendance * 2 },
      { prefix: "due", label: "Deadlines cleared", xp: XP.deadline },
      { prefix: "stk", label: "Daily streak", xp: XP.streak },
      { prefix: "care", label: "Looking after them", xp: XP.care },
    ]);
  });

  it("always sums to the total XP", () => {
    const s = built();
    const summed = xpBySource(s).reduce((n, r) => n + r.xp, 0);
    expect(summed).toBe(xpOf(s));
  });

  it("still sums to the total after pruning folds history into baseXp", () => {
    const s = prune(built(), at("2026-11-01T10:00:00"));
    expect(s.baseXp).toBeGreaterThan(0);
    const summed = xpBySource(s).reduce((n, r) => n + r.xp, 0);
    expect(summed).toBe(xpOf(s));
    expect(xpBySource(s).some(r => r.prefix === "base")).toBe(true);
  });

  it("can be limited to a date window", () => {
    const rows = xpBySource(built(), "2026-09-04");
    // only the second class falls inside the window
    expect(rows.find(r => r.prefix === "att").xp).toBe(XP.attendance);
  });

  it("omits sources that earned nothing", () => {
    const s = award(adopted(day1), keyFor.attendance("s1"), XP.attendance, day1);
    expect(xpBySource(s).map(r => r.prefix)).toEqual(["att"]);
  });
});

describe("unlocks", () => {
  it("every unlock key is a real pet", () => {
    const real = new Set(PETS.map(p => p.key));
    for (const k of [...STARTER_KEYS, ...Object.values(UNLOCKS), ...Object.values(DEVOTION_UNLOCKS)]) {
      expect(real.has(k)).toBe(true);
    }
  });
  it("covers the whole roster with no duplicates", () => {
    const all = [...STARTER_KEYS, ...Object.values(UNLOCKS)];
    expect(new Set(all).size).toBe(all.length);
    // The level curve hands out every pet EXCEPT the devotion companions, which
    // are the point of the tiers past the cap and must not arrive before them.
    expect(new Set(all).size).toBe(PETS.length - Object.keys(DEVOTION_UNLOCKS).length);
  });
  it("grows with level and is complete at MAX_LEVEL", () => {
    expect(unlockedAtLevel(1)).toEqual(STARTER_KEYS);
    expect(unlockedAtLevel(2)).toContain("fox");
    expect(unlockedAtLevel(1)).not.toContain("fox");
    // The curve runs to 12, so the roster should too: 11 and 12 used to unlock
    // nothing, which made the last two level-ups feel empty.
    const byLevel = PETS.length - Object.keys(DEVOTION_UNLOCKS).length;
    expect(unlockedAtLevel(10)).not.toHaveLength(byLevel);
    expect(unlockedAtLevel(MAX_LEVEL)).toHaveLength(byLevel);
    expect(unlockedAtLevel(MAX_LEVEL)).toContain("spark");
    expect(unlockedAtLevel(MAX_LEVEL)).toContain("leafy");
  });

  it("gives every level from 2 to MAX_LEVEL something new", () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(newlyUnlocked(level - 1, level), `level ${level} unlocks nothing`).toHaveLength(1);
    }
  });
  it("reports what a level-up just earned", () => {
    expect(newlyUnlocked(1, 2)).toEqual(["fox"]);
    expect(newlyUnlocked(1, 4)).toEqual(["fox", "penguin", "panda"]);
    expect(newlyUnlocked(4, 4)).toEqual([]);
  });
  it("keeps keys the record already carries", () => {
    const s = { ...adopted(), unlocked: ["cat", "axolotl"] };
    expect(unlockedFor(s)).toContain("axolotl");
  });
  it("switching is free but only to an unlocked pet", () => {
    const s = adopted();
    expect(switchTo(s, "dog").petKey).toBe("dog");
    expect(switchTo(s, "axolotl").petKey).toBe("cat");
    expect(xpOf(switchTo(s, "dog"))).toBe(xpOf(s));
  });
});

describe("prune", () => {
  it("folds aged-out entries into baseXp without losing XP", () => {
    const old = at("2026-07-01T12:00:00");
    const now = at("2026-09-04T12:00:00");
    let s = adopted(old);
    s = award(s, "att:old-1", 10, old);
    s = award(s, "att:old-2", 10, old);
    s = award(s, "att:new-1", 10, now);
    expect(xpOf(s)).toBe(30);
    const pruned = prune(s, now);
    expect(xpOf(pruned)).toBe(30);
    expect(pruned.baseXp).toBe(20);
    expect(Object.keys(pruned.awarded)).toEqual(["att:new-1"]);
  });
  it("keeps entries inside the retention window", () => {
    const now = at("2026-09-04T12:00:00");
    const recent = new Date(now.getTime() - (LEDGER_DAYS - 2) * 86_400_000);
    const s = award(adopted(recent), "att:recent", 10, recent);
    expect(prune(s, now).awarded["att:recent"]).toBeDefined();
  });
  it("is a no-op when nothing has aged out", () => {
    const now = at("2026-09-04T12:00:00");
    const s = award(adopted(now), "att:x", 10, now);
    expect(prune(s, now)).toBe(s);
  });
});

describe("mergePets", () => {
  const t1 = at("2026-09-04T09:00:00");
  const t2 = at("2026-09-04T17:00:00");
  it("unions ledgers instead of losing a device's earnings", () => {
    const base = adopted(t1);
    const phone = award(base, "att:phone-1", 10, t1);
    const laptop = award(base, "att:laptop-1", 10, t2);
    expect(xpOf(mergePets(phone, laptop))).toBe(20);
  });
  it("does not double-count an event both devices saw", () => {
    const base = adopted(t1);
    const a = award(award(base, "att:shared", 10, t1), "att:a", 10, t1);
    const b = award(award(base, "att:shared", 10, t1), "att:b", 10, t2);
    expect(xpOf(mergePets(a, b))).toBe(30);
  });
  it("is commutative in XP terms", () => {
    const base = adopted(t1);
    const a = award(base, "att:a", 10, t1);
    const b = award(base, "att:b", 20, t2);
    expect(xpOf(mergePets(a, b))).toBe(xpOf(mergePets(b, a)));
  });
  it("takes identity from the more recently touched copy", () => {
    const a = { ...adopted(t1), name: "Older", lastSeen: t1.getTime() };
    const b = { ...adopted(t1), name: "Newer", lastSeen: t2.getTime() };
    expect(mergePets(a, b).name).toBe("Newer");
    expect(mergePets(b, a).name).toBe("Newer");
  });
  it("keeps the earliest adoption date and the union of unlocks", () => {
    const a = { ...adopted(t1), adoptedAt: "2026-08-01", unlocked: ["cat"], lastSeen: t1.getTime() };
    const b = { ...adopted(t1), adoptedAt: "2026-09-04", unlocked: ["fox"], lastSeen: t2.getTime() };
    const m = mergePets(a, b);
    expect(m.adoptedAt).toBe("2026-08-01");
    expect(m.unlocked).toEqual(expect.arrayContaining(["cat", "fox"]));
  });
  it("takes the larger care count on a shared day so the cap can't be doubled", () => {
    let a = adopted(t1); let b = adopted(t1);
    a = care(a, "pet", t1);
    b = care(care(b, "pet", t2), "play", t2);
    expect(mergePets(a, b).care.used).toBe(2);
  });
  it("falls back to whichever side is actually adopted", () => {
    const s = adopted(t1);
    expect(mergePets(emptyPet(), s)).toEqual(s);
    expect(mergePets(s, emptyPet())).toEqual(s);
  });
});

describe("normalize", () => {
  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, 42, "nope", [], { petKey: 7 }]) {
      expect(() => normalize(junk)).not.toThrow();
      expect(normalize(junk).v).toBe(1);
    }
  });
  it("drops malformed ledger entries but keeps good ones", () => {
    const s = normalize({
      ...adopted(),
      awarded: {
        good: ["2026-09-04", 10],
        badShape: ["2026-09-04"],
        badXp: ["2026-09-04", -5],
        badDay: [7, 10],
        notArray: "nope",
      },
    });
    expect(Object.keys(s.awarded)).toEqual(["good"]);
    expect(xpOf(s)).toBe(10);
  });
  it("clamps a tampered care counter and negative baseXp", () => {
    expect(normalize({ care: { day: "2026-09-04", used: 999 } }).care.used).toBe(CARE_DAILY_CAP);
    expect(normalize({ baseXp: -100 }).baseXp).toBe(0);
  });
});

// The mood system is pure CSS (styles.css §Moods), so there is nothing to unit
// test about how it looks — but a mood added here and forgotten there would
// silently render as the baseline. This guards that seam.
describe("mood ↔ CSS coverage", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  it("every mood except the baseline has a CSS rule", () => {
    for (const mood of MOODS) {
      if (mood === "content") continue;   // deliberately the un-overridden idle
      expect(css, `no [data-mood="${mood}"] rule in styles.css`)
        .toContain(`[data-mood="${mood}"]`);
    }
  });

  it("'content' stays the baseline with no overrides of its own", () => {
    expect(css).not.toContain('[data-mood="content"]');
  });

  it("moodFor only ever returns a mood the CSS knows about", () => {
    const s = adopted(at("2026-09-04T12:00:00"));
    const seen = new Set();
    for (const iso of [
      "2026-09-04T12:30:00", "2026-09-04T23:30:00", "2026-09-05T03:00:00",
      "2026-09-04T20:00:00", "2026-09-05T18:00:00", "2026-09-09T12:00:00",
    ]) seen.add(moodFor(s, at(iso)));
    for (const ctx of [
      { inClass: true }, { minsToClass: 2 }, { classesToday: 0 },
      { moment: "celebrating", momentUntil: Date.now() + 5000 },
      { moment: "proud", momentUntil: Date.now() + 5000 },
    ]) seen.add(moodFor(s, at("2026-09-04T12:30:00"), ctx));
    expect(seen.size).toBeGreaterThan(5);
    for (const mood of seen) expect(MOODS).toContain(mood);
  });

  // A rule existing is not the same as a rule being visible. Two moods that
  // set the same knobs render the same animal, and every other test here
  // stays green while they do — this is the one that notices.
  it("gives every mood a distinct pose", () => {
    const KNOBS = ["--pet-ear-droop", "--pet-eye-open", "--pet-lean", "--pet-aura", "--pet-sat", "--pet-dot"];
    const poses = new Map();
    for (const mood of MOODS) {
      if (mood === "content") continue;
      // The mood's own block — the one that sets the knobs, not the part
      // rules that only retime an animation.
      const block = css.match(new RegExp(`\\.dg-pet\\[data-mood="${mood}"\\] \\{([^}]*)\\}`));
      expect(block, `no knob block for [data-mood="${mood}"]`).toBeTruthy();
      const pose = KNOBS
        .map(k => (block[1].match(new RegExp(`${k}:\\s*([^;]+)`)) || [null, "default"])[1].trim())
        .join("|");
      expect(poses.has(pose), `[data-mood="${mood}"] poses identically to "${poses.get(pose)}"`).toBe(false);
      poses.set(pose, mood);
    }
  });

  it("no mood rule uses the `animation` shorthand, which would defeat the reduced-motion guard", () => {
    // The guard sets `animation: none`; mood rules may only retime with
    // `animation-duration`, never re-declare a name.
    const moodRules = css.match(/\[data-mood="[a-z]+"\][^{]*\{[^}]*\}/g) || [];
    expect(moodRules.length).toBeGreaterThan(0);
    for (const rule of moodRules) {
      expect(rule, `mood rule re-declares animation: ${rule}`).not.toMatch(/[^-]animation\s*:/);
    }
  });
});

describe("publicSummary", () => {
  it("exposes the pet, its level and what it is wearing — and nothing else", () => {
    let s = adopted();
    s = award(s, "att:1", 200);
    const pub = publicSummary(s);
    expect(Object.keys(pub).sort()).toEqual(["coat", "hat", "key", "level", "name", "neck", "title"]);
    expect(pub).toEqual({ key: "cat", name: "Mochi", level: 2, hat: null, neck: null, coat: null, title: null });
  });

  // A friend must never be shown a cosmetic the owner has not earned — the
  // summary validates through the same `visible*` helpers the owner's own view
  // uses, so a hand-edited row cannot smuggle a crown onto a level-2 pet.
  it("refuses to publish a cosmetic that is not earned", () => {
    const faked = { ...adopted(), cosmetics: { accessory: true, hat: "crown", coat: "gold", neck: "bell", title: "inseparable", buddy: null } };
    const pub = publicSummary(faked);
    expect(pub.hat).toBe(null);
    expect(pub.coat).toBe(null);
    expect(pub.neck).toBe(null);
    expect(pub.title).toBe(null);
  });

  it("publishes what a maxed pet is actually wearing", () => {
    let s = atDevotion(MAX_DEVOTION);
    s = setCosmetic(s, "hat", "crown");
    s = setCosmetic(s, "coat", "gold");
    s = setCosmetic(s, "neck", "bell");
    const pub = publicSummary(s);
    expect(pub).toMatchObject({ hat: "crown", coat: "gold", neck: "bell" });
  });
  it("leaks no XP, ledger, streak or timestamps", () => {
    const json = JSON.stringify(publicSummary(award(adopted(), "att:1", 50)));
    for (const leak of ["awarded", "baseXp", "lastSeen", "adoptedAt", "care"]) {
      expect(json).not.toContain(leak);
    }
  });
});

describe("admin-granted XP", () => {
  it("counts toward the total alongside earned XP", () => {
    const p = award(adopted(), "att:2026-09-04:SCM_A", XP.attendance, at("2026-09-04T10:00:00"));
    expect(xpOf(p)).toBe(XP.attendance);
    expect(xpOf({ ...p, grantedXp: 700 })).toBe(700 + XP.attendance);
  });

  it("defaults to 0 and rejects junk, but keeps negatives", () => {
    expect(emptyPet().grantedXp).toBe(0);
    expect(normalize({ ...emptyPet(), grantedXp: "700" }).grantedXp).toBe(0);
    // A penalty is a legitimate value now: admins can reduce XP, and the old
    // `> 0 ? x : 0` clamp would have silently discarded every reduction.
    expect(normalize({ ...emptyPet(), grantedXp: -5 }).grantedXp).toBe(-5);
  });

  it("raises the level the same way earned XP would", () => {
    expect(levelFor(xpOf({ ...adopted(), grantedXp: xpToReach(5) }))).toBe(5);
  });

  it("lowers the total when negative, and never past zero", () => {
    const p = award(adopted(), "att:2026-09-04:SCM_A", XP.attendance, at("2026-09-04T10:00:00"));
    expect(xpOf({ ...p, grantedXp: -5 })).toBe(XP.attendance - 5);
    // The server clamps so the total floors at 0; this is the client's own
    // guard so a corrupt cached row can't drive a negative bar or level.
    expect(xpOf({ ...p, grantedXp: -99999 })).toBe(0);
    expect(levelFor(xpOf({ ...p, grantedXp: -99999 }))).toBe(1);
  });

  it("takes the recent copy on merge, so a penalty is not undone", () => {
    const base = adopted();
    // `max` was right while this could only grow, but it would resurrect a
    // reduced grant: max(-200, 0) === 0.
    const cloud = { ...base, grantedXp: -200, lastSeen: 2 };
    const stale = { ...base, grantedXp: 0, lastSeen: 1 };
    expect(mergePets(stale, cloud).grantedXp).toBe(-200);
    expect(mergePets(cloud, stale).grantedXp).toBe(-200);
  });

  it("is reported as its own source so the parts still sum to the total", () => {
    const p = { ...adopted(), grantedXp: 700 };
    const rows = xpBySource(p);
    expect(rows.find(r => r.prefix === "grant")?.xp).toBe(700);
    expect(rows.reduce((n, r) => n + r.xp, 0)).toBe(xpOf(p));
  });

  it("labels a reduction as an adjustment, and still sums", () => {
    const earned = award(adopted(), "att:2026-09-04:SCM_A", 100, at("2026-09-04T10:00:00"));
    const p = { ...earned, grantedXp: -40 };
    const row = xpBySource(p).find(r => r.prefix === "grant");
    expect(row.label).toBe("Adjustment");
    expect(row.xp).toBe(-40);
    expect(xpBySource(p).reduce((n, r) => n + r.xp, 0)).toBe(xpOf(p));
  });
});

describe("devotion", () => {
  const cap = xpToReach(MAXLVL);

  it("is zero until the level curve runs out", () => {
    expect(devotionFor(0).tier).toBe(0);
    expect(devotionFor(cap).tier).toBe(0);
    expect(devotionFor(cap + DEVOTION_STEP - 1).tier).toBe(0);
  });

  it("climbs one tier per step and reports progress into the next", () => {
    expect(devotionFor(cap + DEVOTION_STEP).tier).toBe(1);
    expect(devotionFor(cap + DEVOTION_STEP * 2.5).tier).toBe(2);
    const half = devotionFor(cap + DEVOTION_STEP * 1.5);
    expect(half.into).toBe(DEVOTION_STEP / 2);
    expect(half.pct).toBe(50);
  });

  it("tops out rather than running forever", () => {
    const far = devotionFor(cap + DEVOTION_STEP * 500);
    expect(far.tier).toBe(MAX_DEVOTION);
    expect(far.capped).toBe(true);
    expect(far.pct).toBe(100);
  });
});

describe("hats", () => {
  /** A pet sitting on exactly `xp`. */
  const at_xp = n => award(adopted(), "att:seed", n);
  const cap = xpToReach(MAXLVL);

  it("unlocks by level, in registry order", () => {
    expect(hatsFor(at_xp(0))).toEqual([]);
    expect(hatsFor(at_xp(xpToReach(2)))).toEqual(["bow"]);
    expect(hatsFor(at_xp(xpToReach(3)))).toEqual(["bow", "bloom"]);
    expect(hatsFor(at_xp(xpToReach(5)))).toEqual(["bow", "bloom", "cap", "phones"]);
  });

  it("keeps the last two behind devotion, not level", () => {
    const maxed = hatsFor(at_xp(cap));
    expect(maxed).toContain("crown");
    expect(maxed).not.toContain("halo");
    expect(hatsFor(at_xp(cap + DEVOTION_STEP * 3))).toContain("halo");
    expect(hatsFor(at_xp(cap + DEVOTION_STEP * 3))).not.toContain("ember");
    expect(hatsFor(at_xp(cap + DEVOTION_STEP * 6))).toContain("ember");
  });

  it("describes what a locked hat still needs", () => {
    expect(hatRequirement("cap")).toBe("Level 4");
    expect(hatRequirement("devil")).toBe("Level 7");
    expect(hatRequirement("grad")).toBe("Level 10");
    expect(hatRequirement("halo")).toBe("Devotion 3");
    expect(hatRequirement("nope")).toBe(null);
  });

  // The UI disables locked hats, but this is the function storage round-trips
  // through — a hand-edited row must not be able to smuggle one on.
  it("refuses a hat the pet has not earned", () => {
    const young = at_xp(0);
    expect(setCosmetic(young, "hat", "crown").cosmetics.hat).toBe(null);
    const grown = at_xp(xpToReach(4));
    expect(setCosmetic(grown, "hat", "cap").cosmetics.hat).toBe("cap");
    expect(setCosmetic(setCosmetic(grown, "hat", "cap"), "hat", null).cosmetics.hat).toBe(null);
  });

  // Cohort policy, applied at render time only.
  it("hides a withdrawn hat without un-earning it", () => {
    const grown = setCosmetic(at_xp(xpToReach(4)), "hat", "cap");
    expect(grown.cosmetics.hat).toBe("cap");
    expect(visibleHat(grown)).toBe("cap");
    // Withdrawn: not drawn, not offered...
    expect(visibleHat(grown, { hatsOff: ["cap"] })).toBe(null);
    expect(hatsFor(grown, { hatsOff: ["cap"] })).not.toContain("cap");
    // ...but the student's choice is untouched, so re-enabling restores it.
    expect(grown.cosmetics.hat).toBe("cap");
    expect(visibleHat(grown, { hatsOff: [] })).toBe("cap");
  });

  it("hides everything when the wardrobe is switched off", () => {
    const grown = setCosmetic(at_xp(xpToReach(6)), "hat", "specs");
    expect(hatsFor(grown, { wardrobe: false })).toEqual([]);
    expect(visibleHat(grown, { wardrobe: false })).toBe(null);
    expect(grown.cosmetics.hat).toBe("specs");
  });

  // A config written before the wardrobe shipped has none of these keys.
  it("defaults to everything available", () => {
    const grown = setCosmetic(at_xp(xpToReach(4)), "hat", "cap");
    expect(visibleHat(grown, {})).toBe("cap");
    expect(hatsFor(grown, {})).toContain("cap");
  });

  it("still toggles the boolean accessory", () => {
    expect(setCosmetic(adopted(), "accessory", false).cosmetics.accessory).toBe(false);
    expect(setCosmetic(adopted(), "accessory", true).cosmetics.accessory).toBe(true);
  });

  it("drops a hat key this build no longer ships", () => {
    expect(normalizePet({ cosmetics: { accessory: true, hat: "sombrero" } }).cosmetics.hat).toBe(null);
    expect(normalizePet({ cosmetics: { accessory: true, hat: "cap" } }).cosmetics.hat).toBe("cap");
  });
});


describe("growth stages", () => {
  it("walks all four stages across the level range", () => {
    expect(growthStageFor(1).key).toBe("hatchling");
    expect(growthStageFor(3).key).toBe("hatchling");
    expect(growthStageFor(4).key).toBe("young");
    expect(growthStageFor(7).key).toBe("young");
    expect(growthStageFor(8).key).toBe("grown");
    expect(growthStageFor(MAX_LEVEL - 1).key).toBe("grown");
    expect(growthStageFor(MAX_LEVEL).key).toBe("elder");
  });

  // Nothing stores a stage, so a level from a stale row must still resolve.
  it("clamps junk and out-of-range levels instead of returning nothing", () => {
    expect(growthStageFor(0).key).toBe("hatchling");
    expect(growthStageFor(-5).key).toBe("hatchling");
    expect(growthStageFor(undefined).key).toBe("hatchling");
    expect(growthStageFor(NaN).key).toBe("hatchling");
    expect(growthStageFor(999).key).toBe("elder");
  });

  it("derives the stage from XP the same way the UI does", () => {
    expect(growthStageFor(levelFor(0)).key).toBe("hatchling");
    expect(growthStageFor(levelFor(xpToReach(4))).key).toBe("young");
    expect(growthStageFor(levelFor(xpToReach(8))).key).toBe("grown");
    expect(growthStageFor(levelFor(xpToReach(MAX_LEVEL))).key).toBe("elder");
  });

  it("points at the next stage until fully grown", () => {
    expect(nextGrowthStage(1).key).toBe("young");
    expect(nextGrowthStage(4).key).toBe("grown");
    expect(nextGrowthStage(8).key).toBe("elder");
    expect(nextGrowthStage(MAX_LEVEL)).toBe(null);
  });

  it("keeps the stage boundaries inside the level range, in order", () => {
    const froms = GROWTH_STAGES.map(s => s.from);
    expect(froms[0]).toBe(1);
    expect(froms[froms.length - 1]).toBe(MAX_LEVEL);
    expect([...froms].sort((a, b) => a - b)).toEqual(froms);
  });

  // Every stage needs a matching CSS block or the pet renders at scale 1.
  it("has a style rule for every stage", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    for (const stage of GROWTH_STAGES) {
      expect(css).toContain(`.dg-pet[data-stage="${stage.key}"]`);
    }
  });
});

describe("moodExplainFor", () => {
  const ctx = { classesToday: 2 };

  it("agrees with moodFor on every input the ladder branches on", () => {
    const cases = [
      [emptyPet(), at("2026-09-04T10:00:00"), ctx],
      [adopted(), at("2026-09-04T10:00:00"), { ...ctx, inClass: true }],
      [adopted(), at("2026-09-04T23:30:00"), ctx],
      [adopted(), at("2026-09-04T10:00:00"), { ...ctx, minsToClass: 4 }],
      [adopted(), at("2026-09-04T20:00:00"), ctx],
      [adopted(), at("2026-09-04T10:00:00"), { ...ctx, examSoon: true }],
      [adopted(), at("2026-09-04T08:00:00"), ctx],
      [adopted(), at("2026-09-04T11:00:00"), { classesToday: 0 }],
      [adopted(), at("2026-09-04T16:00:00"), { classesToday: 0 }],
      [adopted(), at("2026-09-04T11:00:00"), ctx],
      [adopted(), at("2026-09-06T11:00:00"), ctx],
      [adopted(), at("2026-09-09T11:00:00"), ctx],
      [adopted(), at("2026-09-04T10:00:00"), { ...ctx, moment: "celebrating", momentUntil: at("2026-09-04T10:00:20").getTime() }],
    ];
    for (const [state, now, c] of cases) {
      expect(moodExplainFor(state, now, c).mood).toBe(moodFor(state, now, c));
    }
  });

  it("always gives a reason", () => {
    for (const [state, now, c] of [
      [emptyPet(), at("2026-09-04T10:00:00"), {}],
      [adopted(), at("2026-09-04T23:30:00"), {}],
      [adopted(), at("2026-09-04T10:00:00"), { minsToClass: 0 }],
    ]) {
      expect(moodExplainFor(state, now, c).because.length).toBeGreaterThan(4);
    }
  });

  it("counts down to the class it is restless about", () => {
    const out = moodExplainFor(adopted(), at("2026-09-04T10:00:00"), { minsToClass: 6, classesToday: 1 });
    expect(out.mood).toBe("restless");
    expect(out.because).toContain("6");
  });
});

// "rooting" shipped with no line in either copy map, so an exam inside the
// horizon rendered "<pet> undefined" in the greeting and a blank mood on the
// pet page. Both maps are read by key with no fallback, so this has to be a
// test rather than a convention.
describe("mood copy", () => {
  const maps = [
    ["DayGreeting MOOD_LINE", readFileSync(new URL("../components/DayGreeting.jsx", import.meta.url), "utf8"), "MOOD_LINE"],
    ["PetPage MOOD_COPY", readFileSync(new URL("../components/PetPage.jsx", import.meta.url), "utf8"), "MOOD_COPY"],
  ];

  for (const [label, src, name] of maps) {
    it(`${label} covers every mood`, () => {
      const body = src.slice(src.indexOf(`const ${name} = {`));
      const keys = new Set([...body.slice(0, body.indexOf("};")).matchAll(/^\s*([a-z]+):/gm)].map(m => m[1]));
      for (const mood of MOODS) expect(keys.has(mood), `${name} has no line for "${mood}"`).toBe(true);
    });
  }
});

// ── Progression past the level cap ───────────────────────────────
// Ten devotion tiers shipped with two unlocks between them, so eight of the ten
// steps past MAX_LEVEL rewarded nothing at all.
const atDevotion = (tier) => award(
  adopt(emptyPet(), "cat", "Mochi", at("2026-09-04T10:00:00")),
  "admin:top-up", xpToReach(MAX_LEVEL) + tier * DEVOTION_STEP, at("2026-09-04T10:00:00"),
);

describe("devotion wardrobe", () => {
  it("gives every tier something to unlock", () => {
    for (let tier = 1; tier <= MAX_DEVOTION; tier++) {
      const earned = [
        ...hatsFor(atDevotion(tier)),
        ...coatsFor(atDevotion(tier)),
        ...neckwearFor(atDevotion(tier)),
      ];
      const before = [
        ...hatsFor(atDevotion(tier - 1)),
        ...coatsFor(atDevotion(tier - 1)),
        ...neckwearFor(atDevotion(tier - 1)),
      ];
      expect(earned.length, `devotion ${tier} unlocks nothing new`).toBeGreaterThan(before.length);
    }
  });

  it("keeps every wearable gated on exactly one of level or devotion", () => {
    for (const item of [...HATS, ...COATS, ...NECKWEAR]) {
      const gates = [item.level, item.devotion].filter(v => v != null);
      expect(gates.length, `${item.key} is gated on ${gates.length} things`).toBe(1);
    }
  });

  it("labels what a coat or collar costs", () => {
    expect(coatRequirement("gold")).toBe(`Devotion ${MAX_DEVOTION}`);
    expect(neckwearRequirement("scarf")).toBe("Level 3");
    expect(coatRequirement("nope")).toBe(null);
  });

  it("refuses a coat or collar that has not been earned", () => {
    const fresh = adopted();
    expect(setCosmetic(fresh, "coat", "gold").cosmetics.coat).toBe(null);
    expect(setCosmetic(fresh, "neck", "scarf").cosmetics.neck).toBe(null);
    const rich = atDevotion(MAX_DEVOTION);
    expect(setCosmetic(rich, "coat", "gold").cosmetics.coat).toBe("gold");
    expect(setCosmetic(rich, "neck", "scarf").cosmetics.neck).toBe("scarf");
  });

  it("hides a cosmetic the admin has withdrawn without wiping the choice", () => {
    const worn = setCosmetic(atDevotion(MAX_DEVOTION), "coat", "gold");
    expect(worn.cosmetics.coat).toBe("gold");
    expect(visibleCoat(worn, { wardrobe: false })).toBe(null);
    expect(visibleCoat(worn)).toBe("gold");
  });

  it("stops showing neckwear if the level that earned it is taken away", () => {
    const worn = setCosmetic(atDevotion(1), "neck", "scarf");
    expect(visibleNeckwear(worn)).toBe("scarf");
    expect(visibleNeckwear({ ...worn, awarded: {}, baseXp: 0, grantedXp: 0 })).toBe(null);
  });
});

describe("devotion companions", () => {
  it("arrives only at its tier", () => {
    for (const [tier, key] of Object.entries(DEVOTION_UNLOCKS)) {
      expect(unlockedFor(atDevotion(Number(tier) - 1))).not.toContain(key);
      expect(unlockedFor(atDevotion(Number(tier)))).toContain(key);
      expect(unlockedAtDevotion(Number(tier))).toBe(key);
    }
  });

  it("is a real pet in the registry", () => {
    for (const key of Object.values(DEVOTION_UNLOCKS)) {
      expect(PETS.map(p => p.key), `${key} is unlockable but not drawn`).toContain(key);
    }
  });

  it("cannot arrive before the roster is complete", () => {
    const maxed = atDevotion(0);
    for (const key of Object.values(UNLOCKS)) expect(unlockedFor(maxed)).toContain(key);
  });
});

describe("titles", () => {
  it("earns them from state the ledger already holds", () => {
    expect(titlesFor(emptyPet())).toEqual([]);
    expect(titlesFor(adopted())).toContain("friend");
    expect(titlesFor(atDevotion(6))).toContain("inseparable");
    expect(titlesFor(adopted())).not.toContain("inseparable");
  });

  it("counts days from the adoption date", () => {
    const pet = adopted(at("2026-01-01T10:00:00"));
    expect(daysAdopted(pet, at("2026-01-01T10:00:00"))).toBe(0);
    expect(daysAdopted(pet, at("2026-03-02T10:00:00"))).toBe(60);
    expect(titlesFor(pet, at("2026-03-02T10:00:00"))).toContain("veteran");
  });

  it("drops a title that is no longer true", () => {
    const worn = setCosmetic(atDevotion(6), "title", "inseparable");
    expect(visibleTitle(worn)).toBe("inseparable");
    expect(visibleTitle({ ...worn, awarded: {}, baseXp: 0, grantedXp: 0 })).toBe(null);
    expect(titleLabel("inseparable")).toBe("Inseparable");
  });

  it("has a label for every title", () => {
    for (const t of TITLES) expect(titleLabel(t.key)).toBeTruthy();
  });
});

describe("buddy slot", () => {
  it("stays shut until the tier that opens it", () => {
    const below = setCosmetic(atDevotion(BUDDY_DEVOTION - 1), "buddy", "fox");
    expect(below.cosmetics.buddy).toBe(null);
    const open = setCosmetic(atDevotion(BUDDY_DEVOTION), "buddy", "fox");
    expect(buddyFor(open)).toBe("fox");
  });

  it("refuses a companion that is not unlocked, and refuses itself", () => {
    const open = atDevotion(BUDDY_DEVOTION);
    expect(setCosmetic(open, "buddy", "not-a-pet").cosmetics.buddy).toBe(null);
    expect(buddyFor({ ...open, cosmetics: { ...open.cosmetics, buddy: open.petKey } })).toBe(null);
  });
});

describe("seasonal moods", () => {
  it("remembers the adoption anniversary, but only after a year", () => {
    const pet = adopted(at("2025-03-14T10:00:00"));
    expect(seasonFor(pet, at("2026-03-14T10:00:00"))).toBe("birthday");
    expect(moodFor(pet, at("2026-03-14T10:00:00"), { classesToday: 1 })).toBe("birthday");
    expect(seasonFor(pet, at("2025-04-14T10:00:00"))).toBe(null);
    expect(seasonFor(pet, at("2026-03-15T10:00:00"))).toBe(null);
  });

  it("keeps the informative moods above the flavour ones", () => {
    const pet = adopted(at("2025-03-14T10:00:00"));
    const birthday = at("2026-03-14T10:00:00");
    expect(moodFor(pet, birthday, { inClass: true })).toBe("focused");
    expect(moodFor(pet, birthday, { minsToClass: 3 })).toBe("restless");
  });

  it("closes out the year", () => {
    expect(seasonFor(adopted(), at("2026-12-27T12:00:00"))).toBe("festive");
    expect(seasonFor(adopted(), at("2026-12-23T12:00:00"))).toBe(null);
    expect(seasonFor(adopted(), at("2026-01-01T12:00:00"))).toBe("festive");
  });
});

describe("care streak", () => {
  const build = (offsets, from = at("2026-09-10T10:00:00")) => {
    let pet = adopt(emptyPet(), "cat", "Mochi", at("2026-01-01T10:00:00"));
    for (const offset of offsets) {
      const day = new Date(from);
      day.setDate(day.getDate() - offset);
      pet = care(pet, "pet", day);
    }
    return pet;
  };

  it("counts consecutive days back from today", () => {
    expect(careStreak(build([0, 1, 2]), at("2026-09-10T10:00:00"))).toBe(3);
    expect(careStreak(build([0, 1, 3]), at("2026-09-10T10:00:00"))).toBe(2);
    expect(careStreak(emptyPet(), at("2026-09-10T10:00:00"))).toBe(0);
  });

  it("does not break the streak until the missed day is over", () => {
    expect(careStreak(build([1, 2, 3]), at("2026-09-10T10:00:00"))).toBe(3);
  });

  it("only pays the multiplier once the level curve is finished", () => {
    expect(devotionMultiplier(build([0, 1, 2]), at("2026-09-10T10:00:00"))).toBe(1);
    const maxed = award(build([0, 1, 2]), "admin:top-up", xpToReach(MAX_LEVEL), at("2026-09-10T10:00:00"));
    expect(devotionMultiplier(maxed, at("2026-09-10T10:00:00"))).toBeGreaterThan(1);
    expect(devotionMultiplier(maxed, at("2026-09-10T10:00:00"))).toBeLessThanOrEqual(1.5);
  });

  it("caps the multiplier", () => {
    const long = award(build([...Array(STREAK_CAP + 6).keys()]), "admin:top-up", xpToReach(MAX_LEVEL), at("2026-09-10T10:00:00"));
    expect(devotionMultiplier(long, at("2026-09-10T10:00:00"))).toBe(1.5);
  });

  it("keeps award idempotent — a replayed key pays what it first paid", () => {
    const maxed = award(adopted(), "admin:top-up", xpToReach(MAX_LEVEL), at("2026-09-10T09:00:00"));
    const once = care(maxed, "pet", at("2026-09-10T10:00:00"));
    const twice = care(once, "pet", at("2026-09-10T10:00:00"));
    const key = keyFor.care("2026-09-10", 1);
    expect(twice.awarded[key]).toEqual(once.awarded[key]);
  });
});

// The pet page could say what you have and never what was coming next.
describe("nextUnlockFor", () => {
  it("names the next thing, by level, before anything devotion-gated", () => {
    const next = nextUnlockFor(adopted());
    expect(next.by).toBe("level");
    expect(next.at).toBe(2);
  });

  it("moves on as each gate is passed", () => {
    let seen = null;
    for (const xp of [0, 150, 400, 900, 2000]) {
      const pet = award(adopted(), `admin:${xp}`, xp);
      const next = nextUnlockFor(pet);
      if (seen) expect(next.at >= seen.at || next.by !== seen.by).toBe(true);
      seen = next;
    }
  });

  it("switches to devotion once the level curve is done", () => {
    const next = nextUnlockFor(atDevotion(0));
    expect(next.by).toBe("devotion");
    expect(next.at).toBe(1);
  });

  it("offers the second companion slot before it is open", () => {
    const rows = [];
    for (let tier = 0; tier < MAX_DEVOTION; tier++) rows.push(nextUnlockFor(atDevotion(tier)));
    expect(rows.every(r => r && r.by === "devotion")).toBe(true);
    expect(rows.map(r => r.at).every((at, i) => at > i)).toBe(true);
  });

  it("runs out honestly", () => {
    expect(nextUnlockFor(atDevotion(MAX_DEVOTION))).toBe(null);
  });

  it("only ever names something not yet earned", () => {
    for (const tier of [0, 2, 5, 9]) {
      const pet = atDevotion(tier);
      const next = nextUnlockFor(pet);
      if (!next) continue;
      if (next.kind === "companion") expect(unlockedFor(pet)).not.toContain(next.key);
      if (next.kind === "hat") expect(hatsFor(pet)).not.toContain(next.key);
      if (next.kind === "coat") expect(coatsFor(pet)).not.toContain(next.key);
      if (next.kind === "collar") expect(neckwearFor(pet)).not.toContain(next.key);
    }
  });
});
