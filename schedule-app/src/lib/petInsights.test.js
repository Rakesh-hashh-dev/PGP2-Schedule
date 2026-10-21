import { describe, expect, it } from "vitest";
import { adopt, award, emptyPet, xpToReach } from "./pet.js";
import { petMilestones, petWeek, recentPetMoments, unlockRoadmap } from "./petInsights.js";

const date = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`);
const pet = () => adopt(emptyPet(), "cat", "Mochi", date("2026-09-20"));

describe("companion insights", () => {
  it("groups upcoming rewards by gate and respects the wardrobe policy", () => {
    const state = { ...pet(), grantedXp: xpToReach(9) - 50 };
    const gates = unlockRoadmap(state);
    expect(gates.map(gate => gate.at)).toEqual([9, 10, 11]);
    expect(gates[0].remainingXp).toBe(50);
    expect(gates[0].rewards.map(reward => reward.kind)).toContain("hat");
    expect(unlockRoadmap(state, { wardrobe: false })[0].rewards.every(reward => reward.kind === "companion")).toBe(true);
    expect(unlockRoadmap({ ...state, unlocked: [...state.unlocked, "raccoon"] })[0].rewards.some(reward => reward.label === "Raccoon")).toBe(false);
  });

  it("counts only awards from the current local Monday through today", () => {
    let state = pet();
    state = award(state, "att:old", 10, date("2026-09-20"));
    state = award(state, "att:class", 20, date("2026-09-21"));
    state = award(state, "due:task", 30, date("2026-09-24"));
    state = award(state, "care:2026-09-27:1", 3, date("2026-09-27"));
    state = award(state, "stk:2026-09-28", 10, date("2026-09-28"));
    expect(petWeek(state, date("2026-09-27"))).toMatchObject({
      from: "2026-09-21", through: "2026-09-27", xp: 53,
      classes: 1, deadlines: 1, care: 1, streak: 0,
    });
  });

  it("shows dated care and companion unlocks without inventing older events", () => {
    let state = { ...pet(), grantedXp: xpToReach(2) - 5 };
    state = award(state, "att:class", 10, date("2026-09-22"));
    state = award(state, "care:2026-09-23:1", 3, date("2026-09-23"));
    const rows = recentPetMoments(state, 5, date("2026-09-27"));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ day: "2026-09-22", kind: "unlock" }),
      expect.objectContaining({ day: "2026-09-23", kind: "care", xp: 3 }),
    ]));
    expect(recentPetMoments({ ...pet(), grantedXp: 900 }, 5, date("2026-09-27")).some(row => row.kind === "unlock")).toBe(false);
  });

  it("reports collected, active, and locked milestones from lasting progress", () => {
    const rows = petMilestones({ ...pet(), grantedXp: xpToReach(4) });
    expect(rows.find(row => row.key === "friend").status).toBe("completed");
    expect(rows.find(row => row.key === "level4").status).toBe("completed");
    expect(rows.find(row => row.key === "level8").status).toBe("in-progress");
    expect(rows.find(row => row.key === "level12").status).toBe("locked");
  });
});
