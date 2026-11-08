// Offline preview of real workspace components. RPCs are in-memory fixtures.
import { build } from 'rolldown';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd(), out = resolve(root, '.local'); mkdirSync(out, { recursive: true });
const entry = resolve(out, 'admin-workspace-preview-entry.jsx');
writeFileSync(entry, `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import AdminWorkspaceShortcuts from '../src/components/AdminWorkspaceShortcuts.jsx';
import AdminDraftRecovery from '../src/components/AdminDraftRecovery.jsx';
const original={classOverrides:{},enableFriends:true};
function Preview(){const [flags,setFlags]=useState(original),[role,setRole]=useState('superadmin'),[width,setWidth]=useState(1180),[message,setMessage]=useState('Preview only. No live data is read or changed.');
return <main className="admin-page" style={{maxWidth:width,margin:'auto',padding:20}}><header className="aw-preview-header"><p>TermFlow · actual workspace components · offline fixtures</p><h1>A calmer admin workspace.</h1><div><label>Container <select value={width} onChange={e=>setWidth(Number(e.target.value))}><option value="1180">Desktop</option><option value="820">Tablet</option><option value="390">Phone</option></select></label><label>Role <select value={role} onChange={e=>setRole(e.target.value)}>{['superadmin','monitor','schedule_editor','communications_editor','moderator'].map(r=><option key={r}>{r}</option>)}</select></label><button onClick={()=>setFlags(f=>({...f,classOverrides:{preview:{room:String(Date.now())}}}))}>Simulate a schedule edit</button><label><input type="checkbox" onChange={e=>window.__adminPreviewSaveFailure=e.target.checked}/> Simulate failed saves</label></div></header><div className="admin-workspace-tools"><AdminWorkspaceShortcuts key={role} userId="offline-workspace-preview" role={role} onCommand={id=>setMessage('Shortcut selected: '+id+' (no navigation in this offline preview).')}/><AdminDraftRecovery key={role} role={role} flags={flags} originalFlags={original} announcement={null} originalAnnouncement={null} onResume={(domain,payload)=>{setFlags(f=>({...f,...payload.flags}));setMessage('Saved '+domain+' draft resumed locally. Nothing was published.');}}/></div><p className="aw-preview-feedback" role="status">{message}</p></main>}
createRoot(document.getElementById('root')).render(<Preview/>);`);
const service = `
const originals={schedule:{flags:{classOverrides:{}}},communications:{flags:{},announcement:null},system:{flags:{enableFriends:true}}};
const drafts={communications:{draft_revision:1,payload:{flags:{quickLinks:[{label:'Sample campus link',url:'https://example.com'}]},announcement:null},base_payload:originals.communications,updated_at:new Date().toISOString()}};
export const supabase={rpc:async(name,args)=>{await new Promise(r=>setTimeout(r,450));const domain=args.p_domain;
if(name==='admin_load_publication')return{data:{domain,revision:0,payload:originals[domain]},error:null};
if(name==='admin_load_workspace_draft')return{data:drafts[domain]||null,error:null};
if(name==='admin_discard_workspace_draft'){delete drafts[domain];return{data:null,error:null};}
if(name==='admin_save_workspace_draft'){if(window.__adminPreviewSaveFailure)return{data:null,error:{message:'Sample connection problem. Your changes are not saved.'}};const row={draft_revision:Number(args.p_draft_revision)+1,payload:args.p_payload,base_payload:args.p_base,updated_at:new Date().toISOString()};drafts[domain]=row;return{data:row,error:null};}
throw new Error('Unexpected offline operation '+name);}};`;
const result = await build({ input: entry, platform: 'browser', transform: { jsx: { runtime: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' } },
  plugins: [{ name: 'offline-workspace', resolveId(id) { if (/(?:^|\/)supabase(?:\.js)?$/.test(id)) return '\0offline-workspace-service'; if (id.endsWith('.css')) return '\0offline-workspace-css'; }, load(id) { if (id === '\0offline-workspace-service') return service; if (id === '\0offline-workspace-css') return ''; } }],
  output: { file: resolve(out, 'admin-workspace-preview.js'), format: 'iife', codeSplitting: false },
});
const script = result.output.find(item => item.type === 'chunk').code;
const css = ['src/styles.css','src/styles/admin-publishing.css','src/styles/admin-workspace.css'].map(path => readFileSync(resolve(root,path),'utf8')).join('\n');
writeFileSync(resolve(out,'admin-workspace-preview.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TermFlow · Workspace UI preview</title><style>${css}\nbody{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui}.aw-preview-header{margin-bottom:20px}.aw-preview-header>p,.aw-preview-feedback{font-size:12px;color:var(--muted)}.aw-preview-header h1{font-size:28px}.aw-preview-header>div{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.aw-preview-header label{display:flex;gap:6px;align-items:center;font-size:12px}.aw-preview-header :is(button,select){font:inherit;padding:7px 9px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:7px}.admin-page{width:100%;box-sizing:border-box}</style></head><body class="dark"><div id="root"></div><script>${script.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('.local/admin-workspace-preview.html');
