// Offline interactive preview of the real Diwali components. No account/network.
import { build } from 'rolldown';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd(); const out = resolve(root, '.local'); mkdirSync(out, { recursive: true });
const entry = resolve(out, 'diwali-preview-entry.jsx');
writeFileSync(entry, `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import DiwaliCelebration from '../src/components/DiwaliCelebration.jsx';
import DiwaliFireworks from '../src/components/DiwaliFireworks.jsx';
import DiwaliAmbience from '../src/components/DiwaliAmbience.jsx';
import {useDiwali} from '../src/hooks/useDiwali.js';
import {PETS} from '../src/components/greetingPets.jsx';
import {adopt,emptyPet} from '../src/lib/pet.js';
function Preview(){
 const [key,setKey]=useState('cat'),[width,setWidth]=useState('1100'),[motion,setMotion]=useState(true),[showPet,setShowPet]=useState(true);
 const now=new Date('2026-11-08T09:00:00Z'); const festival=useDiwali('offline-preview',now,{});
 const pet={...adopt(emptyPet(),key,'Mithai',now),petKey:key};
 return <><DiwaliAmbience enabled={festival.enabled} motion={motion}/><DiwaliFireworks enabled={festival.enabled && festival.prefs.fireworks} motion={motion}/><main style={{maxWidth:Number(width),margin:'auto',padding:16}}><header className="preview-head"><p>TermFlow · actual component preview · sample data</p><h1>Light up your day.</h1><div className="preview-controls"><label>Container <select value={width} onChange={e=>setWidth(e.target.value)}><option value="1100">Desktop</option><option value="820">Tablet</option><option value="390">Phone</option></select></label><label>Companion <select value={key} onChange={e=>setKey(e.target.value)}>{PETS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label><label><input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)} /> Motion</label><label><input type="checkbox" checked={showPet} onChange={e=>setShowPet(e.target.checked)} /> Companion</label></div></header><DiwaliCelebration festival={festival} name="Student" pet={pet} petsEnabled={showPet} petSettings={{motion}} now={now} onOpenBoard={()=>document.querySelector('#preview-feedback').textContent='The live app opens Campus Board with Celebrations selected.'}/><p id="preview-feedback" role="status">Try lighting the diya, changing the companion, turning the scarf off, and downloading a card.</p></main></>
} createRoot(document.getElementById('root')).render(<Preview/>);`);
const result = await build({ input: entry, platform: 'browser', transform: { jsx: { runtime: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' } },
  plugins: [{ name: 'offline-services', resolveId(id) { if (/(?:^|\/)supabase(?:\.js)?$/.test(id)) return '\0offline-service'; if (id.endsWith('.css')) return '\0offline-css'; }, load(id) { if (id === '\0offline-service') return 'export const supabase=null;'; if (id === '\0offline-css') return ''; } }],
  output: { file: resolve(out, 'diwali-preview.js'), format: 'iife', codeSplitting: false },
});
const script = result.output.find(item => item.type === 'chunk').code;
const css = ['src/styles.css','src/styles/pet.css','src/styles/pet-personality.css','src/styles/pet-art.css','src/styles/pet-rig.css','src/styles/luna.css','src/styles/diwali.css','src/styles/diwali-ambience.css'].map(path => readFileSync(resolve(root,path),'utf8')).join('\n');
writeFileSync(resolve(out,'diwali-preview.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TermFlow · Diwali implementation preview</title><style>${css}\nbody{isolation:isolate;background:#14121d;color:#eee8f4;font:14px/1.5 system-ui;margin:0;min-height:100vh}.preview-head{padding:16px 0}.preview-head>p{color:#b6a7c6;font-size:11px}.preview-head h1{font:32px Georgia,serif;margin:8px 0 18px}.preview-controls{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.preview-controls label{font-size:12px;display:flex;gap:6px;align-items:center}.preview-controls select{background:#30263c;color:white;border:1px solid #655270;border-radius:6px;padding:6px}#preview-feedback{font-size:12px;color:#bbacc9}</style></head><body class="dark theme-diwali"><div id="root"></div><script>${script.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('.local/diwali-preview.html');
