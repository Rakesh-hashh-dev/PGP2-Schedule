import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import { adopt, emptyPet, switchTo, care, xpOf, publicSummary, unlockedFor, DEVOTION_BASE_XP, DEVOTION_STEP } from "../lib/pet.js";
import { fromRow, toRow } from "../lib/petStorage.js";

// Ported from PR #22 with the pets themselves.
// Sable moved to Lv 16 (UNLOCKS) when the Griffin was retired.
const gates = { maple: 1, mochi: 1, inky: 2, nimbus: 3, ember: 4 };
const atTier = tier => ({ ...adopt(emptyPet(), "cat", "Study buddy"), grantedXp: DEVOTION_BASE_XP + tier * DEVOTION_STEP });

describe("devotion collection integration", () => {
  for (const [key, tier] of Object.entries(gates)) {
    it(`${key} unlocks at tier ${tier}, switches without spending XP and survives storage`, () => {
      expect(unlockedFor(atTier(tier - 1))).not.toContain(key);
      expect(switchTo(atTier(tier - 1), key).petKey).toBe("cat");
      const before = atTier(tier);
      const selected = switchTo(before, key);
      expect(selected.petKey).toBe(key);
      expect(xpOf(selected)).toBe(xpOf(before));
      expect(fromRow(toRow("test-user", selected)).petKey).toBe(key);
      expect(publicSummary(selected).key).toBe(key);
      expect(getPetByKey(key).key).toBe(key);
      for (const action of ["pet", "play", "treat"]) expect(care(selected, action).petKey).toBe(key);
    });

    it(`${key} has addressable eyes, expressions, optional accessories and unique gradient references`, () => {
      const pet = getPetByKey(key);
      const html = renderToStaticMarkup(<><pet.Svg /><pet.Svg /></>);
      expect(html).toMatch(/class="pet-art(?: [^"]*)?"/);
      for (const part of ["dg-pet-eyes", "dg-pet-pupils", "dg-pet-face", "dg-pet-head", "dg-pet-expression-joy", "dg-pet-expression-rest", "dg-pet-accessory"]) expect(html).toContain(part);
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
      // Each copy owns its coat gradient, two gaze-clipping sockets and two lid masks.
      expect([...html.matchAll(/<radialGradient\b/g)]).toHaveLength(2);
      // Per eye: a socket clip for the gaze plus a lid mask.
      expect([...html.matchAll(/<clipPath\b/g)]).toHaveLength(8);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(html).toContain(`url(#${id})`);
      expect(html).not.toMatch(/<image|<script|<foreignObject/);
    });
  }

  it("keeps the retired capybara alias on the axolotl; Mochi and the Lv 17 Capybara have their own keys", () => {
    expect(getPetByKey("capybara").key).toBe("axolotl");
    expect(PETS.find(pet => pet.key === "mochi").label).toBe("Mochi");
    expect(PETS.find(pet => pet.key === "capy").label).toBe("Capybara");
  });
});
