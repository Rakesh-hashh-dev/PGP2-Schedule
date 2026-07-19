// Generates the PWA shortcut icons in public/ — brand tile + a distinct,
// color-coded lucide glyph per shortcut (see vite.config.js manifest.shortcuts).
//
// Usage:  node scripts/generate-shortcut-icons.mjs   (needs devDep `sharp`)
//
// Design notes:
// - Full-bleed background with the glyph inside the ~60% maskable safe zone,
//   so Android's circular shortcut mask never clips the artwork; icons are
//   declared `purpose: 'any maskable'` in the manifest.
// - The stroke gradient MUST be gradientUnits="userSpaceOnUse": lucide glyphs
//   contain zero-extent strokes (dots, straight lines) that vanish entirely
//   under the default objectBoundingBox gradient rules.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const SIZE = 192;

// Lucide 1.18 icon nodes (24x24 viewBox, stroke-width 2) — copied from
// node_modules/lucide-react/dist/esm/icons/*.mjs (calendar-check,
// calendar-days, megaphone, user-check, clipboard-list)
const ICONS = {
  glance: {
    accent: ["#CFF7FF", "#22D3EE"],
    nodes: [
      ["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }],
    ],
  },
  today: {
    accent: ["#EBD9FF", "#A855F7"],
    nodes: [
      ["path", { d: "M8 2v4" }],
      ["path", { d: "M16 2v4" }],
      ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }],
      ["path", { d: "M3 10h18" }],
      ["path", { d: "m9 16 2 2 4-4" }],
    ],
  },
  week: {
    accent: ["#EBD9FF", "#A855F7"],
    nodes: [
      ["path", { d: "M8 2v4" }],
      ["path", { d: "M16 2v4" }],
      ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }],
      ["path", { d: "M3 10h18" }],
      ["path", { d: "M8 14h.01" }],
      ["path", { d: "M12 14h.01" }],
      ["path", { d: "M16 14h.01" }],
      ["path", { d: "M8 18h.01" }],
      ["path", { d: "M12 18h.01" }],
      ["path", { d: "M16 18h.01" }],
    ],
  },
  announcements: {
    accent: ["#FFE9C7", "#F59E0B"],
    nodes: [
      ["path", { d: "M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" }],
      ["path", { d: "M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" }],
      ["path", { d: "M8 6v8" }],
    ],
  },
  attendance: {
    accent: ["#D3FFE8", "#34D399"],
    nodes: [
      ["path", { d: "m16 11 2 2 4-4" }],
      ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
      ["circle", { cx: "9", cy: "7", r: "4" }],
    ],
  },
  assignments: {
    accent: ["#CFE8FF", "#60A5FA"],
    nodes: [
      ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
      ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
      ["path", { d: "M12 11h4" }],
      ["path", { d: "M12 16h4" }],
      ["path", { d: "M8 11h.01" }],
      ["path", { d: "M8 16h.01" }],
    ],
  },
};

function glyphSvg(nodes) {
  return nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("\n      ");
}

function iconSvg({ accent, nodes }) {
  // Glyph box: 100px centered → well inside the 192*0.6 ≈ 115px safe zone
  const G = 100;
  const off = (SIZE - G) / 2;
  const scale = G / 24;
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#241046"/><stop offset="1" stop-color="#120726"/>
    </linearGradient>
    <linearGradient id="stroke" gradientUnits="userSpaceOnUse" x1="4" y1="2" x2="14" y2="23">
      <stop offset="0" stop-color="${accent[0]}"/><stop offset="1" stop-color="${accent[1]}"/>
    </linearGradient>
    <filter id="softglow" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <!-- sheen + vignette are radial so they read correctly whatever crop
         shape the launcher's maskable mask applies -->
    <radialGradient id="sheen" cx="0.32" cy="0.2" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.13"/>
      <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.03"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.72" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.32"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#tile)"/>
  <ellipse cx="${SIZE / 2}" cy="${SIZE / 2 + 6}" rx="52" ry="56" fill="${accent[1]}" opacity="0.35" filter="url(#softglow)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#sheen)"/>
  <g transform="translate(${off},${off}) scale(${scale})" fill="none" stroke="url(#stroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${glyphSvg(nodes)}
  </g>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)"/>
</svg>`;
}

for (const [name, def] of Object.entries(ICONS)) {
  const file = path.join(OUT, `shortcut-${name}.png`);
  // palette: true quantizes to 8-bit indexed — ~22KB → ~7KB with no visible
  // difference at launcher-icon size
  await sharp(Buffer.from(iconSvg(def))).png({ compressionLevel: 9, palette: true }).toFile(file);
  console.log("wrote", file);
}
