// Local, offline QA: actual SVGs and browser CSS, without login or saved data.
// node scripts/pet-preview.mjs -> .local/pet-preview.html + pet-page-preview.html
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const out = resolve(root, ".local");
mkdirSync(out, { recursive: true });
const bundle = resolve(out, "pet-preview.cjs");
await build({
  stdin: { contents: `export { PETS } from './src/components/greetingPets.jsx'; export { default as PetHat } from './src/components/PetHat.jsx'; export { default as PetNeckwear } from './src/components/PetNeckwear.jsx'; export { default as PetPage } from './src/components/PetPage.jsx';`, resolveDir: root, loader: "jsx" },
  outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
});
const { PETS: allPets, PetHat, PetNeckwear, PetPage } = require(bundle);
const only = process.argv[process.argv.indexOf("--pet") + 1];
const PETS = process.argv.includes("--pet") ? allPets.filter(p => p.key === only) : allPets;
const { PET_PERSONALITIES } = await import("../src/lib/petPersonality.js");
const { adopt, emptyPet, unlockedFor } = await import("../src/lib/pet.js");
const css = ["src/styles.css", "src/styles/pet-personality.css", "src/styles/pet.css", "src/styles/luna.css"]
  .map(path => readFileSync(resolve(root, path), "utf8")).join("\n");
const el = React.createElement;
const tile = (pet, mood, beat, outfit = false, motion = true) => `<div class="preview-tile"><span class="dg-pet" data-pet="${pet.key}" data-mood="${mood}" data-motion="${motion ? "on" : "off"}" ${beat ? `data-beat="${beat}"` : ""} ${outfit ? 'data-neck="scarf"' : ""} style="width:78px;height:78px;--pet-overlay-k:1.95">${renderToStaticMarkup(el(pet.Svg))}${outfit ? renderToStaticMarkup(el(PetHat, { hat: "crown" })) + renderToStaticMarkup(el(PetNeckwear, { neck: "scarf" })) : ""}</span><small>${pet.label} · ${beat || mood}${outfit ? " · outfit" : ""}</small></div>`;
const custom = PETS.filter(pet => ["hoot", "byte", "pebble", "prickle", "luna"].includes(pet.key));
const extraCss = `body{margin:0;padding:24px;background:#f5f2ec;color:#282633;font:14px system-ui}h1{font-size:22px}h2{font-size:16px;margin:24px 0 12px}.preview-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.preview-tile{display:grid;justify-items:center;align-content:center;gap:12px;background:#fff;border:1px solid #ddd8d0;border-radius:14px;padding:16px 8px;min-height:125px}.preview-tile small{text-align:center;font-size:11px}.preview-tile .dg-pet::before,.preview-tile .dg-pet::after{display:none}.preview-grid .dg-pet,.preview-grid .dg-pet *{animation-play-state:paused;animation-delay:-.55s}pre{display:none}@media(max-width:600px){.preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}body{padding:12px}}`;
const report = `<script>const report={pets:${PETS.length},tiles:document.querySelectorAll('.preview-tile').length,overflow:document.documentElement.scrollWidth>innerWidth,offAnimations:[...document.querySelectorAll('[data-motion="off"], [data-motion="off"] *')].filter(e=>getComputedStyle(e).animationName!=='none').length,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};report.reducedAnimations=report.reduced?[...document.querySelectorAll('.dg-pet,.dg-pet *')].filter(e=>getComputedStyle(e).animationName!=='none').length:null;report.luna=[...document.querySelectorAll('[data-pet="luna"]')].map(e=>({mood:e.dataset.mood,beat:e.dataset.beat,motion:e.dataset.motion,states:[...e.querySelectorAll(".luna-state")].filter(p=>getComputedStyle(p).display!=="none").map(p=>p.classList[1]),still:getComputedStyle(e.querySelector(".luna-still")).display!=="none"}));report.actions=[...document.querySelectorAll('[data-beat]')].map(e=>({pet:e.dataset.pet,beat:e.dataset.beat,body:getComputedStyle(e).animationName,parts:[...e.querySelectorAll('*')].map(p=>getComputedStyle(p).animationName).filter(n=>n!=='none')}));document.querySelector('#report').textContent=JSON.stringify(report);</script>`;
const localAssets = body => body.replace(/href="(\/pets\/luna\/[^"]+)"/g, (_, path) => `href="${pathToFileURL(resolve(root, "public" + path)).href}"`);
const html = body => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${extraCss}</style></head><body>${localAssets(body)}<pre id="report"></pre>${report}</body></html>`;
const previewName = process.argv.includes("--pet") ? `${only}-preview.html` : "pet-preview.html";
writeFileSync(resolve(out, previewName), html(`<h1>Companion variety · ${PETS.length} ${PETS.length === 1 ? "pet" : "pets"}</h1><h2>${process.argv.includes("--pet") ? "Faces and wardrobe" : "New companions · faces, wardrobe and icon scale"}</h2><div class="preview-grid">${(process.argv.includes("--pet") ? PETS : custom).map(p => ["content", "happy", "sleepy", "focused", "curious"].map(m => tile(p, m)).join("") + tile(p, "happy", null, true) + tile(p, "content", null, false, false)).join("")}</div><h2>Signature actions · frozen 550ms into each sequence</h2><div class="preview-grid">${PETS.map(p => tile(p, "content") + (p.key === "luna" ? [...PET_PERSONALITIES[p.key], "luna-rest", "luna-wait"] : PET_PERSONALITIES[p.key]).map(b => tile(p, "content", b)).join("") + tile(p, "happy") + tile(p, "sleepy") + tile(p, "happy", null, true, false)).join("")}</div>`));
const now = new Date(2026, 9, 7, 12);
let pet = { ...adopt(emptyPet(), "cat", "Professor Hoot", now), petKey: "hoot", baseXp: 5000, cosmetics: { accessory: true, hat: "crown", neck: "scarf" } };
pet = { ...pet, unlocked: unlockedFor(pet) };
writeFileSync(resolve(out, "pet-page-preview.html"), html(renderToStaticMarkup(el(PetPage, { pet, now, petActions: {}, petContext: {}, petSettings: {}, onBack: () => {} }))));
rmSync(bundle);
console.log(`Browser previews: ${out}/${previewName}, ${out}/pet-page-preview.html`);
