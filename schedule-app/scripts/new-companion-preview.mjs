// Offline integration preview from the real registry and production CSS.
// Run: node scripts/new-companion-preview.mjs; open .local/new-companions.html.
// No authentication, application storage, external assets or API calls.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MOODS, GROWTH_STAGES, HATS, NECKWEAR } from "../src/lib/pet.js";
import { PET_PERSONALITIES } from "../src/lib/petPersonality.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(root, ".local");
mkdirSync(out, { recursive: true });
const bundle = resolve(out, "new-companions.cjs");
await build({
  stdin: { contents: `export { PETS } from './src/components/greetingPets.jsx'; export { default as PetHat } from './src/components/PetHat.jsx'; export { default as PetNeckwear } from './src/components/PetNeckwear.jsx'; export { default as PetSleepCue } from './src/components/PetSleepCue.jsx';`, resolveDir: root, loader: "jsx" },
  outfile: bundle, bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
});
const { PETS, PetHat, PetNeckwear, PetSleepCue } = createRequire(import.meta.url)(bundle);
const keys = ["maple", "ember", "mochi", "nimbus", "sable", "inky"];
const gates = { maple: 1, ember: 4, mochi: 1, nimbus: 3, sable: 4, inky: 2 };
const species = { maple: "Red panda", ember: "Baby dragon", mochi: "Capybara", nimbus: "Cloud spirit", sable: "Snow leopard", inky: "Octopus" };
const pets = keys.map(key => PETS.find(p => p.key === key));
const el = React.createElement;
let index = 0;
function art(pet, { size = 96, mood = "content", motion = "on", stage = "grown", hat = null, neck = null, beat, reaction, sig } = {}) {
  return renderToStaticMarkup(el("span", {
    className: "dg-pet", "data-pet": pet.key, "data-mood": mood, "data-stage": stage,
    "data-motion": motion, "data-neck": neck || undefined, "data-beat": beat,
    "data-reaction": reaction, "data-sig": sig,
    style: { width: size, height: size, "--pet-overlay-k": size / 40 },
    "aria-hidden": true,
  }, el(pet.Svg), el(PetHat, { hat }), el(PetNeckwear, { neck }), el(PetSleepCue)), { identifierPrefix: `preview${index++}` });
}
const css = ["src/styles.css", "src/styles/pet-personality.css", "src/styles/pet.css"].map(path => readFileSync(resolve(root, path), "utf8")).join("\n");
const cards = pets.map(pet => `<article><span class="badge">DEVOTION ${gates[pet.key]}</span><div class="hero-art">${art(pet, { size: 144, motion: "off" })}</div><h2>${pet.label}</h2><p>${species[pet.key]}</p><div class="sizes">${[17, 32, 64].map(size => art(pet, { size, motion: "off" })).join("")}</div></article>`).join("");
const tile = (pet, title, options) => `<div class="tile">${art(pet, options)}<small>${pet.label} · ${title}</small></div>`;
const moods = pets.map(pet => MOODS.map(mood => tile(pet, mood, { mood })).join("")).join("");
const stages = pets.map(pet => GROWTH_STAGES.map(stage => tile(pet, stage.label, { stage: stage.key, motion: "off" })).join("")).join("");
const actions = pets.map(pet => PET_PERSONALITIES[pet.key].map(beat => tile(pet, beat, { beat })).join("") + ["pet", "play", "treat"].map(reaction => tile(pet, reaction, { mood: "sleepy", reaction })).join("")).join("");
const outfits = pets.map(pet => HATS.map(hat => tile(pet, hat.label, { hat: hat.key, motion: "off" })).join("") + NECKWEAR.map(neck => tile(pet, neck.label, { neck: neck.key, motion: "off" })).join("")).join("");
const guards = pets.map(pet => tile(pet, "motion off", { motion: "off", beat: "wave", reaction: "play" }) + tile(pet, "signatures off", { sig: "off", beat: "wave" })).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TermFlow · New companions</title><style>${css}
body{margin:0;padding:32px;overflow:auto;background:#f3f1eb;color:#292137;font:14px system-ui}main{max-width:1100px;margin:auto}h1{font-size:34px;letter-spacing:-1.2px;margin:8px 0}header>p{color:#635b70;margin:8px 0 24px}.eyebrow{font-size:11px;letter-spacing:2px;color:#7564a3;font-weight:700}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{position:relative;text-align:center;border:1px solid #dfd9e8;border-radius:22px;padding:20px;background:#fff;overflow:hidden}.badge{font-size:9px;letter-spacing:1px;color:#78668e}.hero-art{height:170px;display:grid;place-items:center}article h2{font-size:22px;margin:4px 0}article p{color:#70667c;margin:6px 0}.sizes{display:flex;align-items:end;justify-content:center;gap:18px;min-height:72px;margin-top:12px}h3{font-size:21px;margin:30px 0 15px}.matrix{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.tile{display:grid;justify-items:center;gap:10px;padding:16px 4px;min-height:135px;border-radius:12px;background:#fff;border:1px solid #ddd7e7}.tile small{text-align:center;font-size:10px}.dg-pet:before,.dg-pet:after{display:none}.controls{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}button{padding:10px 16px;border:1px solid #b2a0c8;background:#fff;border-radius:9px;font:inherit;color:#443451;cursor:pointer}body.dark{background:#18121f;color:#f0eaf7}body.dark article,body.dark .tile{background:#2b2134;border-color:#584565}body.dark article p,body.dark header>p{color:#c8bdd6}body.dark .badge{color:#c1addf}@media(max-width:600px){body{padding:16px}.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}article{padding:14px 6px}.hero-art{height:150px}h1{font-size:28px}.matrix{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style></head><body><main><header><div class="eyebrow">TERMFLOW · COMPANION COLLECTION</div><h1>Six new study buddies.</h1><p>Native SVG artwork · shared care, expressions, growth and wardrobe</p></header><div class="cards">${cards}</div><div class="controls"><button id="theme">Toggle light / dark</button><button id="animate">Toggle hero motion</button></div><h3>All moods</h3><section class="matrix">${moods}</section><h3>Growth stages</h3><section class="matrix">${stages}</section><h3>Signature actions and care</h3><section class="matrix">${actions}</section><h3>Wardrobe fitting</h3><section class="matrix">${outfits}</section><h3>Motion guards</h3><section class="matrix">${guards}</section></main><script>document.querySelector('#theme').onclick=()=>document.body.classList.toggle('dark');document.querySelector('#animate').onclick=()=>document.querySelectorAll('.cards .hero-art .dg-pet').forEach(p=>p.dataset.motion=p.dataset.motion==='on'?'off':'on');</script></body></html>`;
writeFileSync(resolve(out, "new-companions.html"), html);
rmSync(bundle);
console.log(`Wrote ${out}/new-companions.html (${index} pet previews)`);
