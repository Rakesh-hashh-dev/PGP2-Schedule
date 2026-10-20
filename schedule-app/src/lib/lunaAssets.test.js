import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PETS } from "../components/greetingPets.jsx";
import assets from "./lunaAssets.json";

describe("Luna supplied animation assets", () => {
  it("preserves all nine states and the 114 source frames at 120ms each", () => {
    expect(Object.keys(assets.states)).toHaveLength(9);
    expect(Object.values(assets.states).reduce((n, state) => n + state.frames, 0)).toBe(114);
    for (const state of Object.values(assets.states)) expect(state.durationMs).toBe(state.frames * 120);
  });
  it("ships decodable transparent strips with the exact frame dimensions and a still pose", async () => {
    let bytes = 0;
    for (const state of Object.values(assets.states)) {
      const data = readFileSync(new URL(`../../public${state.file}`, import.meta.url));
      bytes += data.length;
      const info = await sharp(data).metadata();
      expect(info.width).toBe(assets.width * state.frames);
      expect(info.height).toBe(assets.height);
      expect(info.hasAlpha).toBe(true);
      const { channels } = await sharp(data).stats();
      expect(channels[3].min).toBe(0);
      expect(channels[3].max).toBe(255);
    }
    expect(bytes).toBeLessThan(1_200_000);
    const still = await sharp(readFileSync(new URL("../../public/pets/luna/still.webp", import.meta.url))).metadata();
    expect(still.width).toBe(assets.width);
    expect(still.height).toBe(assets.height);
    expect(still.hasAlpha).toBe(true);
  });
  // Luna was redrawn as vector art on 2026-10-20; the strips above stay on
  // disk for the sprite tooling but the pet no longer loads them.
  it("registers Luna as vector art that loads no raster frames", () => {
    const luna = PETS.find(pet => pet.key === "luna");
    expect(luna.art).toBeUndefined();
    const html = renderToStaticMarkup(createElement(luna.Svg));
    expect(html).toContain('class="pet-art"');
    expect(html).not.toContain("<image");
    expect(html).not.toContain("/pets/luna/");
  });
});
