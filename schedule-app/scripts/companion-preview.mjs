// Offline full-roster review using the application components and styles.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bundlePets } from './pet-bundle.mjs';
import { PET_PERSONALITIES, MOOD_ACTIONS } from '../src/lib/petPersonality.js';
import { adopt, emptyPet, unlockedFor } from '../src/lib/pet.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(root, '.local');
mkdirSync(out, { recursive: true });
const bundle = resolve(out, 'companion-preview.cjs');
await bundlePets(root, bundle, `export { PETS } from '../src/components/greetingPets.jsx'; export { default as PetHat } from '../src/components/PetHat.jsx'; export { default as PetNeckwear } from '../src/components/PetNeckwear.jsx'; export { default as PetSleepCue } from '../src/components/PetSleepCue.jsx'; export { default as PetPage } from '../src/components/PetPage.jsx';`);
const { PETS, PetHat, PetNeckwear, PetSleepCue, PetPage } = createRequire(import.meta.url)(bundle);
const el = React.createElement;
let serial = 0;
const render = node => renderToStaticMarkup(node, { identifierPrefix: `companion-${serial++}-` });
const css = ['src/styles.css', 'src/styles/pet-personality.css', 'src/styles/pet.css', 'src/styles/luna.css', 'src/styles/pet-art.css'].map(f => readFileSync(resolve(root, f), 'utf8')).join('\n');
const moods = ['content', ...new Set([...css.matchAll(/data-mood="([a-z]+)"/g)].map(m => m[1]))].filter((v, i, a) => a.indexOf(v) === i);
const actions = [...new Set([...Object.values(PET_PERSONALITIES).flat(), ...Object.values(MOOD_ACTIONS).flat(), 'luna-rest', 'luna-wait'])];
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const option = (value, label = value) => `<option value="${escape(value)}">${escape(label)}</option>`;
const mount = (pet, size, label) => `<div class="sample"><span class="dg-pet" tabindex="0" aria-label="${pet.label} ${label}" data-pet="${pet.key}" data-mood="content" data-motion="on" style="width:${size}px;height:${size}px;--pet-overlay-k:${size / 40}">${render(el(pet.Svg))}${render(el(PetHat, { hat: 'crown' }))}${render(el(PetNeckwear, { neck: 'scarf' }))}${render(el(PetSleepCue))}</span><small class="sample-label">${label} · ${size}px</small></div>`;
const cards = PETS.map(p => `<article class="companion-card" data-key="${p.key}"><button type="button" class="pet-name" data-select="${p.key}">${p.label}</button><div class="samples">${mount(p, 40, 'Greeting')}${mount(p, 160, 'Detail')}</div></article>`).join('');
const now = new Date(2026, 9, 14, 12);
const pages = Object.fromEntries(PETS.map(p => {
  let pet = { ...adopt(emptyPet(), 'cat', p.label, now), petKey: p.key, baseXp: 10000, cosmetics: { accessory: true, hat: 'crown', neck: 'scarf' } };
  pet = { ...pet, unlocked: unlockedFor(pet) };
  return [p.key, render(el(PetPage, { pet, now, petActions: {}, petContext: {}, petSettings: {}, onBack: () => {} }))];
}));
const extra = `
body{margin:0;padding:24px;background:#f5f2ec;color:#282633;font:14px/1.5 system-ui}
html[data-theme="dark"] body{background:#141725;color:#eeedf8}
h1{font-size:24px;margin:0 0 8px}p{max-width:900px}.review-toolbar{display:flex;flex-wrap:wrap;gap:12px;padding:16px;background:#fff;border:1px solid #d9d4cc;border-radius:16px;margin:20px 0}
.review-toolbar label{display:grid;gap:4px;font-size:12px}.review-toolbar select,.review-toolbar button{font:inherit;min-height:36px;border:1px solid #bfb9ae;border-radius:8px;background:#fff;color:#282633;padding:6px 10px}
.review-toolbar .check{display:flex;align-items:center;gap:6px}.review-toolbar input{accent-color:#6552b9}
.companion-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.companion-card{padding:16px 10px;border:1px solid #d9d4cc;border-radius:18px;background:#fff;min-width:0}
.pet-name{font:600 14px system-ui;border:0;background:transparent;color:inherit;cursor:pointer}.pet-name:hover{text-decoration:underline}
.samples{display:flex;gap:4px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:205px}.sample{display:grid;justify-items:center;gap:12px}.sample:first-child{width:40px}.sample:first-child .sample-label{width:48px;text-align:center;line-height:1.5}.sample-label{font:11px system-ui;color:#645f72}
.companion-card .dg-pet{flex-shrink:0;cursor:pointer}.dg-pet:focus-visible{outline:2px solid #8b78d1;outline-offset:5px}.companion-card .dg-pet::before,.companion-card .dg-pet::after{display:none}
.companion-card .dg-pet-hat,.companion-card .dg-pet-neck{display:none}.companion-card[data-outfit] .dg-pet-hat,.companion-card[data-outfit] .dg-pet-neck{display:block}
html[data-theme="dark"] .review-toolbar,html[data-theme="dark"] .companion-card{background:#202438;border-color:#3d4156}html[data-theme="dark"] .sample-label{color:#c0bacf}
#page-preview{margin-top:24px;padding:20px;border:1px solid #d9d4cc;border-radius:18px;overflow:hidden}#page-render{max-width:1100px;margin:auto}
[data-review-paused] .dg-pet,[data-review-paused] .dg-pet *{animation-play-state:paused!important}
@media(max-width:600px){body{padding:12px}.companion-grid{grid-template-columns:1fr 1fr}.samples{min-height:175px}.review-toolbar{gap:8px;padding:12px}.companion-card{padding:12px 6px}.samples{gap:6px}#page-preview{padding:8px}}
`;
const script = readFileSync(resolve(root, 'src/lib/petMotion.js'), 'utf8').replace('export function', 'function') + '\nstartPetMotionWatcher();\n' + readFileSync(resolve(root, 'scripts/companion-preview-client.js'), 'utf8');
const localAssets = body => body.replace(/href="(\/pets\/luna\/[^"<]+)"/g, (_, p) => `href="${pathToFileURL(resolve(root, 'public' + p)).href}"`);
const data = JSON.stringify({ pets: PETS.map(({ key, label }) => ({ key, label })), moods, actions, personalities: PET_PERSONALITIES, pages: Object.fromEntries(Object.entries(pages).map(([k,v]) => [k, localAssets(v)])) }).replace(/</g, '\\u003c');
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TermFlow companion artwork review</title><style>${css}\n${extra}</style></head><body>
<h1>Companion artwork review</h1><p>25 companions · editable vectors and Luna’s original sprite poses. Compare greeting scale with detail scale, then inspect moods, gestures, care and wardrobe on either theme. Click a companion to preview its application page.</p><p><small>Offline rendering with application components and CSS. Controls below only change this preview; page buttons do not save data.</small></p>
<div class="review-toolbar"><label>Theme<select id="theme">${option('light')}${option('dark')}</select></label><label>Detail size<select id="size">${[48,96,116,160].map(s => option(s, s+'px')).join('')}</select></label><label>Mood<select id="mood">${moods.map(m => option(m)).join('')}</select></label><label>Gesture<select id="beat">${option('', 'None')}${option('signature', 'Species gesture')}${actions.map(a => option(a)).join('')}</select></label><label>Care<select id="reaction">${option('', 'None')}${['pet','play','treat','leap'].map(a=>option(a)).join('')}</select></label><label class="check"><input id="outfit" type="checkbox">Crown + scarf</label><label class="check"><input id="motion" type="checkbox" checked>Motion</label><label class="check"><input id="signatures" type="checkbox" checked>Signatures</label><label class="check"><input id="paused" type="checkbox">Freeze frame</label><button id="replay" type="button">Replay</button></div>
<div class="companion-grid">${localAssets(cards)}</div><details id="page-preview"><summary>Application page · <span id="page-label">Cat</span></summary><div id="page-render"></div></details>
<script type="application/json" id="preview-data">${data}</script><script>${script}</script></body></html>`;
writeFileSync(resolve(out, 'companion-preview.html'), html);
const matrixCss = `body{padding:20px}.matrix-row{display:grid;grid-template-columns:80px repeat(${moods.length},48px);gap:4px;align-items:center;min-height:76px}.matrix-heading{min-height:100px}.matrix-heading span{font:10px system-ui;writing-mode:vertical-rl}.matrix-row .sample{width:48px;min-width:0}.matrix-row .sample-label,.matrix-row .dg-pet-hat,.matrix-row .dg-pet-neck,.matrix-row .dg-pet::before,.matrix-row .dg-pet::after{display:none}.matrix-row .dg-pet,.matrix-row .dg-pet *{animation-play-state:paused;animation-delay:-.55s}`;
const matrix = `<h1>Companion mood sheet · actual renderer</h1><p>All 25 companions × 22 moods at 48px. Frozen at 550ms. Offline application components and CSS.</p><div class="matrix-row matrix-heading"><b>Companion</b>${moods.map(m => `<span>${m}</span>`).join('')}</div>${PETS.map(p => `<div class="matrix-row"><b>${p.label}</b>${moods.map(m => mount(p, 48, m).replace('data-mood="content"', `data-mood="${m}"`)).join('')}</div>`).join('')}`;
writeFileSync(resolve(out, 'companion-mood-matrix.html'), `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${extra}\n${matrixCss}</style></head><body>${localAssets(matrix)}<pre id="report" hidden></pre><script>document.querySelector('#report').textContent=JSON.stringify({pets:document.querySelectorAll('.matrix-row:not(.matrix-heading)').length,tiles:document.querySelectorAll('.matrix-row .dg-pet').length,overflow:document.documentElement.scrollWidth>innerWidth,offAnimations:[...document.querySelectorAll('[data-motion="off"], [data-motion="off"] *')].filter(e=>getComputedStyle(e).animationName!=='none').length,reducedAnimations:matchMedia('(prefers-reduced-motion: reduce)').matches?[...document.querySelectorAll('.dg-pet, .dg-pet *')].filter(e=>getComputedStyle(e).animationName!=='none').length:null});</script></body></html>`);
rmSync(bundle, { force: true });
console.log(`Full-roster interactive preview: ${out}/companion-preview.html (${PETS.length} companions, ${moods.length} moods, ${actions.length} gestures)`);
