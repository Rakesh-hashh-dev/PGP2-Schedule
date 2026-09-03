import { describe, it, expect } from "vitest";
import { PETS, dayKey, getPetByKey, getPetOfTheDay } from "./greetingPets.jsx";

describe("PETS registry", () => {
  it("has unique keys", () => {
    const keys = PETS.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every pet a label and a component", () => {
    for (const pet of PETS) {
      expect(pet.key).toBeTruthy();
      expect(pet.label).toBeTruthy();
      expect(typeof pet.Svg).toBe("function");
    }
  });

  // The rover shipped under the key "turtle" and the label "Rover"; the label is
  // what admins pick from, so the key is the one that had to move.
  it("keys the rover as 'rover'", () => {
    expect(PETS.find(p => p.label === "Rover").key).toBe("rover");
  });
});

describe("getPetByKey", () => {
  it("resolves a known key", () => {
    expect(getPetByKey("panda").label).toBe("Panda");
  });

  it("maps the legacy 'turtle' key onto the rover", () => {
    expect(getPetByKey("turtle").key).toBe("rover");
  });

  it("falls back to the first pet for unknown or missing keys", () => {
    expect(getPetByKey("griffin")).toBe(PETS[0]);
    expect(getPetByKey(undefined)).toBe(PETS[0]);
  });
});

describe("getPetOfTheDay", () => {
  it("is stable across calls within the same local day", () => {
    const morning = new Date(2026, 8, 4, 7, 30);
    const night = new Date(2026, 8, 4, 23, 59);
    expect(getPetOfTheDay(morning)).toBe(getPetOfTheDay(night));
  });

  it("is deterministic — no storage, no randomness", () => {
    const d = new Date(2026, 0, 15);
    const runs = new Set(Array.from({ length: 50 }, () => getPetOfTheDay(d).key));
    expect(runs.size).toBe(1);
  });

  it("always returns a pet from the registry", () => {
    for (let i = 0; i < 400; i++) {
      const d = new Date(2026, 0, 1 + i);
      expect(PETS).toContain(getPetOfTheDay(d));
    }
  });

  it("rotates — a year of days covers every pet and does not stick", () => {
    const year = Array.from({ length: 365 }, (_, i) => getPetOfTheDay(new Date(2026, 0, 1 + i)).key);
    expect(new Set(year).size).toBe(PETS.length);
    const longestRun = year.reduce((acc, key) => {
      const run = key === acc.prev ? acc.run + 1 : 1;
      return { prev: key, run, max: Math.max(acc.max, run) };
    }, { prev: null, run: 0, max: 0 }).max;
    expect(longestRun).toBeLessThanOrEqual(2);
  });
});

describe("dayKey", () => {
  it("uses local calendar parts, not UTC", () => {
    expect(dayKey(new Date(2026, 8, 4, 1, 0))).toBe("2026-9-4");
  });

  it("changes at local midnight", () => {
    expect(dayKey(new Date(2026, 8, 4, 23, 59))).not.toBe(dayKey(new Date(2026, 8, 5, 0, 1)));
  });
});
