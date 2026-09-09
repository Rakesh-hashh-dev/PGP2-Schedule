import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PETS, dayKey, getPetByKey } from "./greetingPets.jsx";
import PetHat from "./PetHat.jsx";
import PetNeckwear from "./PetNeckwear.jsx";
import { HATS, NECKWEAR, MOODS } from "../lib/pet.js";

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
  // The four premium companions are excluded on purpose: their staged
  // sequences are what reaching level 11-12, or devotion 4 and 8, buys, and a
  // signature on everything would flatten that back out.
  const PREMIUM = ["spark", "leafy", "nova", "cinder"];

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

// A mood is carried almost entirely by posture: the ears (or the wings, which
// rotate to the same droop) plus eye openness and the body drop. A pet with
// neither ears nor wings therefore has sixteen moods that look like one — which
// is exactly what shipped for the penguin, the chick and Rover. Eyes and drop
// alone are not enough; this asserts the rotating part exists.
describe("mood posture", () => {
  it("gives every pet a part that carries the droop", () => {
    for (const pet of PETS) {
      const html = renderToStaticMarkup(<pet.Svg />);
      const hasEars = html.includes("dg-pet-ear-left") && html.includes("dg-pet-ear-right");
      const hasWings = html.includes("dg-pet-wing-left") && html.includes("dg-pet-wing-right");
      expect(hasEars || hasWings, `${pet.key} has no ears or wings to droop`).toBe(true);
    }
  });

  it("backs the wing droop with the shared variable", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css, "wings no longer read --pet-wing-droop").toMatch(/--pet-wing-droop:/);
    expect(css.match(/@keyframes dgPetWing(Left|Right) \{[^}]*\}/g)?.join(""))
      .toContain("--pet-wing-droop");
  });
});

// A wearable in the registry with no art renders an empty swatch and an empty
// pet — no error, nothing in the console, just a hat that does nothing. Eight
// hats and five collars were added at once; this is the check that they all
// actually exist.
describe("wardrobe art", () => {
  it("draws every hat in the registry", () => {
    for (const hat of HATS) {
      const html = renderToStaticMarkup(<PetHat hat={hat.key} />);
      expect(html, `no art for the ${hat.key} hat`).toContain("<svg");
    }
  });

  it("draws every collar in the registry", () => {
    for (const neck of NECKWEAR) {
      const html = renderToStaticMarkup(<PetNeckwear neck={neck.key} />);
      expect(html, `no art for the ${neck.key} collar`).toContain("<svg");
    }
  });

  it("renders nothing for a key it does not know", () => {
    expect(renderToStaticMarkup(<PetHat hat="not-a-hat" />)).toBe("");
    expect(renderToStaticMarkup(<PetNeckwear neck="not-a-collar" />)).toBe("");
  });
});

// The premium companions have a staged flourish instead of a signature, and it
// used to be retimed by three moods out of seventeen through six long selector
// lists. Nova and Cinder shipped with classes nobody had added to those lists,
// so their orbits and flames ran at one speed no matter what mood the pet was
// in. Both are now scaled by `--pet-tempo`; these are the checks that keep it
// that way when the next companion is drawn.
describe("premium flourish timing", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  // The two premium sections only — the sleep cue and the signatures that
  // follow them are shared with the whole roster and retimed their own way.
  const premiumBlock = css.slice(
    css.indexOf("Spark & Leafy: the premium companions"),
    css.indexOf("/* Neckwear overlay."),
  );

  it("scales every flourish animation by the tempo", () => {
    // Reaction beats and the care taps are one-shots, not loops: they fire once
    // and are deliberately the same speed whatever the mood.
    const loops = [...premiumBlock.matchAll(/^\.dg-pet-[a-z-]+ \{[^}]*animation[^}]*infinite[^}]*\}/gm)];
    expect(loops.length).toBeGreaterThan(10);
    for (const [rule] of loops) {
      expect(rule, `flourish rule not scaled by --pet-tempo: ${rule.slice(0, 60)}`)
        .toContain("var(--pet-tempo)");
    }
  });

  it("gives every mood a tempo", () => {
    for (const mood of MOODS) {
      if (mood === "content") continue;  // the baseline, deliberately no rules
      const at = css.indexOf(`.dg-pet[data-mood="${mood}"] {`);
      const block = css.slice(at, css.indexOf("}", at));
      expect(block, `[data-mood="${mood}"] sets no --pet-tempo`).toContain("--pet-tempo");
    }
  });

  it("keeps the tempo pointing the same way as the pet's own idle", () => {
    // A mood that bobs slower must not run the flourish faster.
    const rows = MOODS.filter(m => m !== "content").map(mood => {
      const at = css.indexOf(`.dg-pet[data-mood="${mood}"] {`);
      const block = css.slice(at, css.indexOf("}", at));
      return {
        mood,
        bob: Number(/animation-duration:\s*([\d.]+)s/.exec(block)?.[1]),
        tempo: Number(/--pet-tempo:\s*([\d.]+)/.exec(block)?.[1]),
      };
    });
    for (const { mood, bob, tempo } of rows) {
      expect(Number.isFinite(bob) && Number.isFinite(tempo), `${mood} is missing a number`).toBe(true);
      // Within a factor of two of the bob's own ratio against the 2.9s base.
      const ratio = bob / 2.9;
      expect(tempo, `${mood}: tempo ${tempo} fights its ${bob}s idle`).toBeGreaterThan(ratio / 2);
      expect(tempo, `${mood}: tempo ${tempo} fights its ${bob}s idle`).toBeLessThan(ratio * 2);
    }
  });
});
