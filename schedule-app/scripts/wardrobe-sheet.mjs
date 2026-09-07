import { createRequire } from "module";
import { mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, ".local/wardrobe-sheet.png");
mkdirSync(dirname(OUT), { recursive: true });

async function loadModules() {
  const { build } = await import("esbuild");
  const tmp = resolve(root, ".wardrobe-sheet.cjs");
  await build({
    entryPoints: [resolve(root, "scripts/wardrobe-bundle-entry.js")],
    bundle: true, format: "cjs", jsx: "automatic",
    external: ["react", "react-dom"], outfile: tmp, logLevel: "silent",
  });
  const mod = createRequire(import.meta.url)(tmp);
  rmSync(tmp, { force: true });
  return mod;
}

async function run() {
  const { PETS, PetHat, PetNeckwear, HATS, NECKWEAR } = await loadModules();

  const CELL = 96;
  const GAP = 14;
  const PAD = 20;

  const testPets = ["fox", "cat", "bunny", "panda"];
  const cols = 7;
  const totalItems = HATS.length + NECKWEAR.length;
  const rows = Math.ceil(totalItems / cols);

  const width = PAD * 2 + cols * (CELL + GAP) - GAP;
  const height = PAD * 2 + rows * (CELL + GAP + 24) - GAP;

  const composites = [];

  let idx = 0;
  for (const hat of HATS) {
    const petKey = testPets[idx % testPets.length];
    const petObj = PETS.find(p => p.key === petKey) || PETS[0];
    const PetSvg = petObj.Svg;

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAD + col * (CELL + GAP);
    const y = PAD + row * (CELL + GAP + 24);

    const petMarkup = renderToStaticMarkup(
      React.createElement(
        "svg",
        { xmlns: "http://www.w3.org/2000/svg", width: CELL, height: CELL, viewBox: "0 0 32 32" },
        React.createElement(PetSvg, null),
        React.createElement(PetHat, { hat: hat.key })
      )
    );

    const buf = await sharp(Buffer.from(petMarkup)).png().toBuffer();
    composites.push({ input: buf, left: x, top: y });

    const labelSvg = `<svg width="${CELL}" height="20" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CELL}" height="20" rx="4" fill="#e2e8f0" />
      <text x="${CELL / 2}" y="14" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#1e293b" text-anchor="middle">${hat.label}</text>
    </svg>`;
    composites.push({ input: Buffer.from(labelSvg), left: x, top: y + CELL + 4 });

    idx++;
  }

  for (const neck of NECKWEAR) {
    const petKey = testPets[idx % testPets.length];
    const petObj = PETS.find(p => p.key === petKey) || PETS[0];
    const PetSvg = petObj.Svg;

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAD + col * (CELL + GAP);
    const y = PAD + row * (CELL + GAP + 24);

    const petMarkup = renderToStaticMarkup(
      React.createElement(
        "svg",
        { xmlns: "http://www.w3.org/2000/svg", width: CELL, height: CELL, viewBox: "0 0 32 32" },
        React.createElement(PetSvg, null),
        React.createElement(PetNeckwear, { neck: neck.key })
      )
    );

    const buf = await sharp(Buffer.from(petMarkup)).png().toBuffer();
    composites.push({ input: buf, left: x, top: y });

    const labelSvg = `<svg width="${CELL}" height="20" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CELL}" height="20" rx="4" fill="#ccfbf1" />
      <text x="${CELL / 2}" y="14" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#0f766e" text-anchor="middle">${neck.label}</text>
    </svg>`;
    composites.push({ input: Buffer.from(labelSvg), left: x, top: y + CELL + 4 });

    idx++;
  }

  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 241, g: 245, b: 249, alpha: 1 },
    }
  });

  await base.composite(composites).png().toFile(OUT);
  console.log(`Wardrobe sheet generated: ${OUT}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
