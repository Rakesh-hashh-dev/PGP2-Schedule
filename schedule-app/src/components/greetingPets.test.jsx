import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
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

  // The capybara was retired for the axolotl after the roster shipped. Anyone
  // who had adopted one must land on the replacement, not silently fall back
  // to PETS[0] and appear to have lost their companion.
  it("maps the legacy 'capybara' key onto the axolotl", () => {
    expect(getPetByKey("capybara").key).toBe("axolotl");
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

// Personality is opt-in per pet, and a pet that never got a signature reads as
// a colour swap of its neighbours — which is exactly the failure this feature
// exists to prevent, and it is invisible from the roster.
describe("signature micro-motion", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  // Spark and Leafy are excluded on purpose: their staged sequences are what
  // reaching level 11 and 12 buys, and a signature on everything would flatten
  // that back out.
  const PREMIUM = ["spark", "leafy"];

  it("gives every non-premium pet one", () => {
    for (const pet of PETS) {
      if (PREMIUM.includes(pet.key)) continue;
      const html = renderToStaticMarkup(<pet.Svg />);
      expect(html, `${pet.key} has no dg-pet-sig element`).toContain("dg-pet-sig");
    }
  });

  it("backs every signature class in the markup with a keyframe", () => {
    for (const pet of PETS) {
      const html = renderToStaticMarkup(<pet.Svg />);
      for (const cls of html.match(/dg-pet-sig-[a-z-]+/g) || []) {
        expect(css, `no rule for .${cls}`).toContain(`.${cls} {`);
      }
    }
  });

  // The axolotl's gills used to be `.dg-pet[data-pet="axolotl"] .part` at
  // (0,3,0), which outran both motion guards — it kept animating for readers
  // who asked for stillness, and inside the 17px friends badge.
  it("keeps every signature rule below the motion guards", () => {
    const rules = css.match(/^\.dg-pet-sig[a-z-]* \{[^}]*\}/gm) || [];
    expect(rules.length).toBeGreaterThan(10);
    for (const rule of rules) {
      expect(rule, `signature uses the animation shorthand: ${rule}`).not.toMatch(/[^-]animation\s*:/);
    }
    // Comments stripped first: the block above documents the old axolotl
    // selector by name, and matching prose would fail this for the wrong reason.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code, "a signature is still scoped by [data-pet]")
      .not.toMatch(/\[data-pet="[a-z]+"\][^{]*\.dg-pet-sig/);
  });

  it("runs the signature block before both motion guards", () => {
    const first = css.indexOf(".dg-pet-sig {");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(first).toBeLessThan(css.indexOf('.dg-pet[data-motion="off"],'));
  });
});
