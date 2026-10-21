import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const result = await build({entryPoints:['scripts/habitat-preview.jsx'],bundle:true,write:false,outfile:'preview.js',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_SUPABASE_URL':'"https://preview.invalid"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"offline-preview"'},minify:true});
const css=['src/styles.css','src/styles/pet.css','src/styles/pet-personality.css','src/styles/pet-art.css','src/styles/pet-rig.css','src/styles/pet-habitat.css'].map(path=>readFileSync(path,'utf8')).join('\n');
mkdirSync('.local',{recursive:true});
writeFileSync('.local/habitat-preview.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TermFlow habitat preview</title><style>${css}\nhtml,body,#root{margin:0;min-height:100%;overflow:auto}body{background:var(--bg);font-family:var(--body)}</style></head><body><div id="root"></div><script>${result.outputFiles.find(f=>f.path.endsWith('.js'))?.text || result.outputFiles[0].text}</script></body></html>`);
console.log('.local/habitat-preview.html');
