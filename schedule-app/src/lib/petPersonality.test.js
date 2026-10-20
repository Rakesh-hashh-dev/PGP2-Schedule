import { afterEach, describe, expect, it, vi } from "vitest";
import { PETS } from "../components/greetingPets.jsx";
import { MOODS } from "./pet.js";
import { LUNA_MOODS, MOOD_ACTIONS, PET_PERSONALITIES, PET_BEAT_MS, PET_GAP_MIN_MS, beatPoolFor, choosePetBeat, createPetBeatClock } from "./petPersonality.js";

afterEach(() => vi.useRealTimers());
describe("companion personalities", () => {
  it("gives all 31 companions at least three signature actions", () => {
    expect(PETS).toHaveLength(31);
    for (const pet of PETS) expect(new Set(PET_PERSONALITIES[pet.key]).size, pet.key).toBeGreaterThanOrEqual(3);
  });
  it("does not repeat the previous action in any pet/mood combination", () => {
    for (const { key } of PETS) for (const mood of MOODS) {
      for (const previous of beatPoolFor(key, mood)) {
        expect(choosePetBeat(key, mood, previous, () => 0)).not.toBe(previous);
        expect(choosePetBeat(key, mood, previous, () => .9999)).not.toBe(previous);
      }
    }
  });
  it("keeps energetic actions out of sleepy and focused pools", () => {
    for (const { key } of PETS) for (const mood of ["sleepy", "tired", "cozy", "focused"]) {
      expect(beatPoolFor(key, mood)).not.toEqual(expect.arrayContaining(["doublehop"]));
      expect(beatPoolFor(key, mood)).not.toContain("zap");
      expect(beatPoolFor(key, mood)).not.toContain("shuffle");
    }
  });
  it("falls back safely for an unknown pet and mood", () => {
    expect(choosePetBeat("future-pet", "unknown", "stretch", () => 0)).toBe("tilt");
  });
});
describe("idle clock", () => {
  it("cancels pending work, clears an active action, and resumes with a fresh gap", () => {
    vi.useFakeTimers();
    const onBeat = vi.fn();
    const clock = createPetBeatClock({ petKey: "hoot", mood: "content", onBeat, random: () => 0 });
    clock.start();
    clock.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(PET_GAP_MIN_MS);
    expect(onBeat).toHaveBeenLastCalledWith("glasses");
    clock.stop();
    expect(onBeat).toHaveBeenLastCalledWith("");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120_000);
    expect(onBeat).toHaveBeenCalledTimes(2);
    clock.start();
    vi.advanceTimersByTime(PET_GAP_MIN_MS);
    expect(onBeat).toHaveBeenLastCalledWith("think");
    vi.advanceTimersByTime(PET_BEAT_MS);
    expect(onBeat).toHaveBeenLastCalledWith("");
    clock.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
describe("mood coverage", () => {
  it("MOOD_ACTIONS and LUNA_MOODS cover every mood", () => {
    for (const mood of MOODS) {
      expect(MOOD_ACTIONS[mood], `MOOD_ACTIONS.${mood}`).toBeTruthy();
      expect(LUNA_MOODS[mood], `LUNA_MOODS.${mood}`).toBeTruthy();
    }
  });
  it("gives new beats to pets, keeps twirl out of quiet moods, allows quiet-safe ones", () => {
    for (const beat of ["downdog", "twirl", "glance", "shimmy"]) {
      expect(Object.values(PET_PERSONALITIES).some(list => list.includes(beat)), beat).toBe(true);
    }
    for (const { key } of PETS) for (const mood of ["sleepy", "tired", "cozy", "focused", "weekend"]) {
      expect(beatPoolFor(key, mood)).not.toContain("twirl");
      expect(beatPoolFor(key, mood)).not.toContain("shimmy");
    }
    expect(beatPoolFor("cat", "weekend")).toContain("downdog");
  });
});

