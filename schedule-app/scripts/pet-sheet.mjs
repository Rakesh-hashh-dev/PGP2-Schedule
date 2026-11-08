// Renders the pet roster against every mood to one PNG contact sheet.
//
//   npm run pet-sheet            -> .local/pet-sheet.png
//   npm run pet-sheet -- --pet dog --out dog.png
//
// Why this exists: the companion's whole design lives in a browser that no
// test can see. Two of the three defects found while revamping the dog were
// invisible to the suite and obvious in a raster — an ear pivoting off the side
// of the head, and three pets whose moods were indistinguishable. The plan doc
// still marks Phases 1-5 "BUILT, unverified in browser"; this is the cheapest
// way to look at all 224 combinations at once.
//
// It is a STILL, so it shows posture, not timing: every mood's animation-duration
// change is invisible here by construction. What it does show is the four
// channels that survive a freeze — ear/wing droop, eye openness, body drop and
// lean — which is exactly the set that has to carry a mood at 40px anyway.
//
// The CSS is the source of truth: the mood knobs, per-pet gains and the ear
// transform-origins are all parsed out of styles.css rather than restated, so
// this can't quietly drift from what ships. Part pivots need real bounding
// boxes (CSS `transform-box: fill-box`), so each moving part is rasterized on
// its own once per pet and measured from its alpha channel.
//
// Uses the installed Vite 8 bundler to load JSX without an extra dependency.

import { createRequire } from "module";
import { bundlePets } from "./pet-bundle.mjs";
import { readFileSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = readFileSync(resolve(root, "src/styles.css"), "utf8");
const PERSONALITY_CSS = readFileSync(resolve(root, "src/styles/pet-personality.css"), "utf8");

// librsvg does not resolve CSS custom properties. Resolve only the display
// channels here, from the same mood rules the browser uses, for the still sheet.
function faceStyles(moods) {
  const channels = {
    "pet-face-base": ".dg-pet-eyes,.e", "pet-mouth-base": ".dg-pet-mouth-base",
    "pet-face-joy": ".dg-pet-expression-joy", "pet-face-rest": ".dg-pet-expression-rest",
    "pet-face-surprise": ".dg-pet-expression-surprise", "pet-face-brows": ".dg-pet-expression-brows",
    "pet-mouth-smile": ".dg-pet-expression-smile", "pet-mouth-yawn": ".dg-pet-expression-yawn",
    "pet-mouth-oh": ".dg-pet-expression-oh",
  };
  const values = block => Object.fromEntries([...block.matchAll(/--(pet-(?:face|mouth)-[a-z]+):\s*(inline|none)/g)].map(([, key, val]) => [key, val]));
  const defaults = values(PERSONALITY_CSS.match(/\.dg-pet \{([^}]+)\}/)?.[1] || "");
  const rules = [...PERSONALITY_CSS.matchAll(/\.dg-pet:where\(([^)]+)\)\s*\{([^}]+)\}/g)];
  return ".dg-pet-gesture,.dg-pet-expression-heart{display:none}" + moods.map(mood => {
    const state = { ...defaults };
    for (const [, selector, block] of rules) if (selector.includes(`[data-mood="${mood}"]`)) Object.assign(state, values(block));
    return Object.entries(channels).map(([key, selector]) => selector.split(",").map(cls => `.pet-mood-${mood} ${cls}`).join(",") + `{display:${state[key] || "none"}}`).join("");
  }).join("");
}

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(root, argOf("out", ".local/pet-sheet.png"));
const ONLY = argOf("pet", null);
const CELL = Number(argOf("cell", 64));

// ── Load the pets ───────────────────────────────────────────────
async function loadPets() {
  const tmp = resolve(root, ".pet-sheet.cjs");
  await bundlePets(root, tmp, "export { PETS } from '../src/components/greetingPets.jsx';");
  const { PETS } = createRequire(import.meta.url)(tmp);
  rmSync(tmp, { force: true });
  return PETS;
}

// ── Read the mood knobs out of the stylesheet ───────────────────
const num = (v, unit) => {
  const m = new RegExp(`^(-?[\\d.]+)${unit}?$`).exec(String(v).trim());
  return m ? Number(m[1]) : 0;
};

function moodKnobs() {
  const moods = new Map();
  const re = /\.dg-pet\[data-mood="([a-z]+)"\] \{([^}]*)\}/g;
  for (const [, mood, body] of CSS.matchAll(re)) {
    const knobs = moods.get(mood) || { droop: 0, drop: 0, lean: 0, eye: 1, pupil: 1 };
    const grab = (name) => new RegExp(`--pet-${name}:\\s*([^;]+);`).exec(body)?.[1];
    if (grab("ear-droop")) knobs.droop = num(grab("ear-droop"), "deg");
    if (grab("drop")) knobs.drop = num(grab("drop"), "px");
    if (grab("lean")) knobs.lean = num(grab("lean"), "deg");
    if (grab("eye-open")) knobs.eye = num(grab("eye-open"), "");
    if (grab("pupil")) knobs.pupil = num(grab("pupil"), "");
    moods.set(mood, knobs);
  }
  // "content" is the baseline and deliberately has no rules of its own.
  moods.set("content", { droop: 0, drop: 0, lean: 0, eye: 1, pupil: 1 });
  return moods;
}

function petGains() {
  const gains = new Map();
  for (const [, sel, val] of CSS.matchAll(/([^\n{]*)\{\s*--pet-mood-gain:\s*([\d.]+);\s*\}/g))
    for (const [, key] of sel.matchAll(/data-pet="([a-z]+)"/g)) gains.set(key, Number(val));
  return gains;
}

// Per-pet transform-origin overrides (the dog's floppy ears pivot at the crown).
function earOrigins() {
  const out = new Map();
  const re = /\.dg-pet\[data-pet="([a-z]+)"\] \.dg-pet-ear-(left|right) \{[^}]*transform-origin:\s*([^;}]+)/g;
  for (const [, pet, side, value] of CSS.matchAll(re)) {
    const [x, y] = value.trim().split(/\s+/);
    out.set(`${pet}:${side}`, [x, y]);
  }
  return out;
}

const ORIGIN_DEFAULT = {
  "ear-left": ["100%", "100%"], "ear-right": ["0", "100%"],
  "wing-left": ["100%", "100%"], "wing-right": ["0", "100%"],
};

// ── Isolate one element from a pet's markup, so it can be measured ──
function outerHTML(markup, className) {
  const at = markup.indexOf(`class="${className}`);
  if (at < 0) return null;
  const start = markup.lastIndexOf("<", at);
  const name = /^<([a-zA-Z]+)/.exec(markup.slice(start))[1];
  let i = start, depth = 0;
  while (i < markup.length) {
    const open = markup.indexOf(`<${name}`, i);
    const close = markup.indexOf(`</${name}>`, i);
    const selfEnd = markup.indexOf("/>", i);
    const tagEnd = markup.indexOf(">", i);
    if (open >= 0 && open < (close < 0 ? Infinity : close)) {
      const isSelf = selfEnd >= 0 && selfEnd < markup.indexOf(">", open) + 1;
      if (!isSelf) depth++;
      i = markup.indexOf(">", open) + 1;
      if (isSelf && depth === 0) return markup.slice(start, i);
      continue;
    }
    if (close >= 0) {
      depth--;
      i = close + `</${name}>`.length;
      if (depth === 0) return markup.slice(start, i);
      continue;
    }
    i = (tagEnd >= 0 ? tagEnd : markup.length) + 1;
  }
  return null;
}

const RASTER = 128;
async function bboxOf(markup, className) {
  const el = outerHTML(markup, className);
  if (!el) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${RASTER}" height="${RASTER}" viewBox="0 0 32 32">${el}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) return null;
  const k = 32 / RASTER;
  return { x: minX * k, y: minY * k, w: (maxX - minX) * k, h: (maxY - minY) * k };
}

const originPoint = (box, [ox, oy]) => [
  box.x + (String(ox).endsWith("%") ? (parseFloat(ox) / 100) * box.w : parseFloat(ox) || 0),
  box.y + (String(oy).endsWith("%") ? (parseFloat(oy) / 100) * box.h : parseFloat(oy) || 0),
];

// ── Compose ─────────────────────────────────────────────────────
function posed(markup, boxes, knobs, gain) {
  let out = markup;
  const droop = knobs.droop * gain;
  const rot = { "ear-left": droop, "ear-right": -droop, "wing-left": droop * 0.6, "wing-right": -droop * 0.6 };
  for (const [part, deg] of Object.entries(rot)) {
    const box = boxes[part];
    if (!box || !deg) continue;
    const [cx, cy] = originPoint(box, boxes.origins[part]);
    out = out.replace(`class="dg-pet-${part.startsWith("ear") ? "ear " : "wing "}dg-pet-${part}"`,
      `class="x" transform="rotate(${deg.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`);
  }
  // Lids (PetEyes.jsx): eye-open below 1 slides the lid mask + line down.
  if (knobs.eye < 1) {
    out = out.replace(/class="(dg-pet-lid [^"]*)" data-lid-travel="([d.]+)"/g, (_, cls, travel) =>
      `class="${cls}" transform="translate(0 ${(Math.min(1, (1 - knobs.eye) * 1.6) * Number(travel)).toFixed(3)})"`);
  }
  // Pupil dilation; slits widen three times faster, horizontally only.
  const pupil = knobs.pupil ?? 1;
  if (pupil !== 1) {
    const slit = Math.min(1.9, Math.max(.45, 1 + (pupil - 1) * 3));
    out = out.replace(/<ellipse class="dg-pet-pupil" data-pupil="round" cx="([-d.]+)" cy="([-d.]+)"/g, (m, cx, cy) =>
      `<ellipse transform="translate(${cx} ${cy}) scale(${pupil}) translate(${-cx} ${-cy})" class="p" data-pupil="round" cx="${cx}" cy="${cy}"`);
    out = out.replace(/<path class="dg-pet-pupil" data-pupil="slit" fill="[^"]*" d="([^"]+)"/g, (m, d) => {
      const n = d.match(/-?[d.]+/g).map(Number);
      const cx = n[0], cy = (n[1] + n[5]) / 2;
      return m.replace('<path ', `<path transform="translate(${cx} ${cy}) scale(${slit} 1) translate(${-cx} ${-cy})" `);
    });
  }
  if (boxes.eyes && knobs.eye > 1) {
    const cx = boxes.eyes.x + boxes.eyes.w / 2, cy = boxes.eyes.y + boxes.eyes.h / 2;
    out = out.replace('class="dg-pet-eyes"',
      `class="e" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(1 ${knobs.eye}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)})"`);
  }
  const inner = out.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  // The whole-body channels, applied the way `.dg-pet svg` applies them:
  // translate for the drop, rotate about the feet for the lean.
  return `<g transform="translate(0 ${(knobs.drop * gain).toFixed(2)}) rotate(${(knobs.lean * gain).toFixed(2)} 16 30)">${inner}</g>`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function main() {
  const PETS = (await loadPets()).filter(p => !ONLY || ONLY.split(",").includes(p.key));
  const moods = moodKnobs();
  const gains = petGains();
  const origins = earOrigins();
  // Every mood the stylesheet knows, in ladder order; `--moods a,b,c` narrows it.
  const ALL = ["celebrating", "reunion", "proud", "birthday", "festive", "weekend", "excited", "focused",
    "restless", "determined", "playful", "happy", "hyped", "curious", "rooting", "content",
    "relaxed", "cozy", "tired", "sleepy", "bored", "missing"];
  const picked = argOf("moods", null)?.split(",");
  const order = (picked || ALL)
    .filter(m => moods.has(m));

  const LABEL = 74, HEAD = 22;
  const width = LABEL + order.length * CELL;
  const height = HEAD + PETS.length * CELL;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#f4f1ea"/>`,
    `<style>text{font-family:system-ui,sans-serif;font-size:7px;fill:#3a332c}${faceStyles(order)}</style>`];

  order.forEach((m, i) => {
    parts.push(`<text x="${LABEL + i * CELL + CELL / 2}" y="${HEAD - 8}" text-anchor="middle">${esc(m)}</text>`);
  });

  for (const [row, pet] of PETS.entries()) {
    const rasterFrames = new Map();
    if (pet.art === "sprite") {
      const assets = JSON.parse(readFileSync(resolve(root, "src/lib/lunaAssets.json"), "utf8"));
      for (const [key, state] of Object.entries(assets.states)) {
        const frame = await sharp(resolve(root, "public" + state.file))
          .extract({ left: 0, top: 0, width: assets.width, height: assets.height }).png().toBuffer();
        rasterFrames.set(key, `<svg viewBox="0 0 32 32"><image href="data:image/png;base64,${frame.toString("base64")}" width="32" height="32" preserveAspectRatio="xMidYMid meet" /></svg>`);
      }
    }
    const markup = pet.art === "sprite" ? rasterFrames.get("idle") : renderToStaticMarkup(React.createElement(pet.Svg));
    const boxes = { origins: {} };
    for (const part of ["ear-left", "ear-right", "wing-left", "wing-right"]) {
      boxes[part] = await bboxOf(markup, `dg-pet-${part.startsWith("ear") ? "ear " : "wing "}dg-pet-${part}`);
      const override = part.startsWith("ear") ? origins.get(`${pet.key}:${part.slice(4)}`) : null;
      boxes.origins[part] = override || ORIGIN_DEFAULT[part];
    }
    boxes.eyes = await bboxOf(markup, "dg-pet-eyes");
    const gain = gains.get(pet.key) ?? 1;
    const y = HEAD + row * CELL;
    parts.push(`<text x="4" y="${y + CELL / 2}">${esc(pet.label)}</text>`);
    order.forEach((mood, col) => {
      const x = LABEL + col * CELL;
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${row % 2 ? "#efeae0" : "#f4f1ea"}"/>`);
      parts.push(`<svg class="pet-mood-${mood}" x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" viewBox="0 0 32 32">${pet.art === "sprite"
        ? posed(rasterFrames.get(({ happy: "wait", proud: "wait", playful: "wait", focused: "think", bored: "think", curious: "review", restless: "review", tired: "rest", sleepy: "rest", cozy: "rest", missing: "rest", excited: "jump", celebrating: "jump", reunion: "jump", hyped: "jump", determined: "think", weekend: "rest", rooting: "wait", birthday: "jump", festive: "jump" })[mood] || "idle"), {}, { droop: 0, eye: 1, drop: 0, lean: 0, pupil: 1 }, 1)
        : posed(markup, boxes, moods.get(mood), gain)}</svg>`);
    });
  }
  parts.push("</svg>");

  mkdirSync(dirname(OUT), { recursive: true });
  await sharp(Buffer.from(parts.join(""))).png().toFile(OUT);
  console.log(`pet sheet: ${PETS.length} pets x ${order.length} moods -> ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
