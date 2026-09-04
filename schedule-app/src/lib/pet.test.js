import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PETS } from "../components/greetingPets.jsx";
import {
  XP, CARE_DAILY_CAP, MAX_LEVEL, LEDGER_DAYS, STARTER_KEYS, UNLOCKS,
  clampRate, scaleXp, XP_RATE_MIN, XP_RATE_MAX,
  emptyPet, normalize, isAdopted, adopt, rename, switchTo,
  xpOf, xpToReach, levelFor, levelProgress, award, keyFor,
  careUsedToday, careLeft, canCare, care,
  hoursSince, moodFor, MOODS,
  unlockedAtLevel, unlockedFor, newlyUnlocked,
  prune, mergePets, publicSummary, xpBySource,
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
    expect(xpOf(s)).toBe(10);
    s = award(s, keyFor.attendance("2026-09-04_10:00_SCM_A"), XP.attendance);
    s = award(s, keyFor.attendance("2026-09-04_10:00_SCM_A"), XP.attendance);
    expect(xpOf(s)).toBe(10);
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
    expect(xpOf(s)).toBe(45);
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
  it("is excited after two taps, then settles", () => {
    let s = adopted(noon);
    s = care(s, "pet", noon);
    s = care(s, "play", noon);
    expect(moodFor(s, noon)).toBe("excited");
    expect(moodFor(s, at("2026-09-04T20:00:00"))).toBe("content");
  });
  it("is happy after a single tap", () => {
    const s = care(adopted(noon), "treat", noon);
    expect(moodFor(s, noon)).toBe("happy");
  });
  it("drifts to bored then missing, and stops there", () => {
    const s = adopted(noon);
    expect(moodFor(s, at("2026-09-05T18:00:00"))).toBe("bored");
    expect(moodFor(s, at("2026-09-09T12:00:00"))).toBe("missing");
    expect(moodFor(s, at("2027-09-09T12:00:00"))).toBe("missing");
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
  it("never reports a punishing mood", () => {
    const s = adopted(noon);
    for (const d of ["2026-09-04T13:00:00", "2026-09-06T12:00:00", "2027-01-01T12:00:00"]) {
      expect(["excited", "happy", "content", "sleepy", "bored", "missing"]).toContain(moodFor(s, at(d)));
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
      { prefix: "att", label: "Classes marked", xp: 20 },
      { prefix: "due", label: "Deadlines cleared", xp: 20 },
      { prefix: "stk", label: "Daily streak", xp: 5 },
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
    expect(rows.find(r => r.prefix === "att").xp).toBe(10);
  });

  it("omits sources that earned nothing", () => {
    const s = award(adopted(day1), keyFor.attendance("s1"), XP.attendance, day1);
    expect(xpBySource(s).map(r => r.prefix)).toEqual(["att"]);
  });
});

describe("unlocks", () => {
  it("every unlock key is a real pet", () => {
    const real = new Set(PETS.map(p => p.key));
    for (const k of [...STARTER_KEYS, ...Object.values(UNLOCKS)]) expect(real.has(k)).toBe(true);
  });
  it("covers the whole roster with no duplicates", () => {
    const all = [...STARTER_KEYS, ...Object.values(UNLOCKS)];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all).size).toBe(PETS.length);
  });
  it("grows with level and is complete at MAX_LEVEL", () => {
    expect(unlockedAtLevel(1)).toEqual(STARTER_KEYS);
    expect(unlockedAtLevel(2)).toContain("fox");
    expect(unlockedAtLevel(1)).not.toContain("fox");
    // The curve runs to 12, so the roster should too: 11 and 12 used to unlock
    // nothing, which made the last two level-ups feel empty.
    expect(unlockedAtLevel(10)).not.toHaveLength(PETS.length);
    expect(unlockedAtLevel(MAX_LEVEL)).toHaveLength(PETS.length);
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
      "2026-09-05T18:00:00", "2026-09-09T12:00:00",
    ]) seen.add(moodFor(s, at(iso)));
    for (const mood of seen) expect(MOODS).toContain(mood);
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
  it("exposes only key, name and level", () => {
    let s = adopted();
    s = award(s, "att:1", 200);
    const pub = publicSummary(s);
    expect(Object.keys(pub).sort()).toEqual(["key", "level", "name"]);
    expect(pub).toEqual({ key: "cat", name: "Mochi", level: 2 });
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
