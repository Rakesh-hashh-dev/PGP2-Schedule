// Is the roster actually reachable?
//
// The rates shipped tuned by feel and were wrong by roughly a factor of three:
// a student who marked every class, opened the app daily and cleared fourteen
// deadlines ended the term on 2607 XP — level 9 — while Spark, Leafy, Nova and
// Cinder sat behind levels 11-12 and devotion tiers. Four companions and the
// whole devotion wardrobe were content nobody could ever see, and not one test
// in the suite had an opinion about it.
//
// This runs the same model as `npm run xp-model` against the bundled schedule.
// It is a BALANCE test, not a unit test: the bounds are deliberately loose, so
// it stays quiet through ordinary tuning and speaks up when a change — new
// rates, a steeper curve, or a shorter term dropped in at rollover (see
// docs/pet-companion-plan.md and the term-rollover runbook) — puts a companion
// out of reach again.
import { describe, it, expect } from "vitest";
import { model, milestones, reachedAt, termShape, PROFILES } from "../../scripts/xp-model.mjs";
import { DEVOTION_COMPANIONS, MAX_LEVEL, UNLOCKS, xpToReach } from "./pet.js";

const runs = Object.fromEntries(
  Object.entries(PROFILES).map(([name, profile]) => [name, model(profile)])
);

/** Everything that gates a COMPANION — the wardrobe is allowed to outlast the term. */
const companionGates = (run) => milestones(run).filter(([label]) => label !== "wardrobe done");

describe("the term can actually deliver the roster", () => {
  it("has a term to model", () => {
    const { days, median } = termShape();
    expect(days).toBeGreaterThan(60);
    expect(median.length).toBeGreaterThan(40);
  });

  it("gets an engaged student every companion before the term ends", () => {
    for (const [label, gate, need] of companionGates(runs.engaged)) {
      const pct = reachedAt(need, runs.engaged);
      expect(pct, `${label} (${gate}) is unreachable for an engaged student`).not.toBeNull();
      expect(pct, `${label} (${gate}) arrives at ${pct}% — too late to enjoy`).toBeLessThanOrEqual(90);
    }
  });

  // The stated target: the last companion lands around four fifths of the way
  // through, so there is something left to earn for most of the term and time
  // left to enjoy it.
  it("lands the last companion around 80% of the term", () => {
    const last = companionGates(runs.engaged).slice(-1)[0];
    const pct = reachedAt(last[2], runs.engaged);
    // Checked before the range, so an unreachable companion reads as
    // "never arrives" rather than a type error about null.
    expect(pct, `${last[0]} never arrives for an engaged student`).not.toBeNull();
    expect(pct, `last companion lands at ${pct}%`).toBeGreaterThanOrEqual(65);
    expect(pct, `last companion lands at ${pct}%`).toBeLessThanOrEqual(88);
  });

  // A curve nobody can fall off is also a curve nobody climbs.
  it("does not hand a perfect student the whole roster at half term", () => {
    const last = companionGates(runs.perfect).slice(-1)[0];
    const pct = reachedAt(last[2], runs.perfect);
    expect(pct, `${last[0]} never arrives even for a perfect student`).not.toBeNull();
    expect(pct).toBeGreaterThanOrEqual(50);
  });

  // The floor. Missing the premium four is the point of them; missing most of
  // the roster would make the feature a scold, which it is explicitly not.
  it("still gives a casual student most of the roster", () => {
    const finalXp = runs.casual.timeline[runs.casual.timeline.length - 1];
    const levelUnlocks = Object.entries(UNLOCKS)
      .filter(([lvl]) => finalXp >= xpToReach(Number(lvl)))
      .length;
    expect(levelUnlocks, "a casual student ends the term with too few companions")
      .toBeGreaterThanOrEqual(Object.keys(UNLOCKS).length - 3);
  });

  it("leaves the devotion wardrobe as a tail, not a requirement", () => {
    const wardrobe = milestones(runs.engaged).find(([label]) => label === "wardrobe done");
    expect(reachedAt(wardrobe[2], runs.engaged), "an engaged student finishes everything — nothing left to chase")
      .toBeNull();
  });

  it("keeps the companions ahead of the cosmetics they are gated beside", () => {
    // Every devotion companion must sit at a tier a real student reaches, which
    // is what moving them from tiers 4 and 8 down to 2 and 4 was about.
    for (const tier of DEVOTION_COMPANIONS.map(([tier]) => Number(tier))) {
      const need = xpToReach(MAX_LEVEL) + tier * runs.engaged.rates.dev;
      expect(reachedAt(need, runs.engaged), `devotion ${tier} is out of reach`).not.toBeNull();
    }
  });
});
