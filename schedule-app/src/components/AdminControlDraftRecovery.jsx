import { useEffect,useRef,useState } from 'react';
import { createDraftAutosaver,discardWorkspaceDraft,loadWorkspaceDraft,saveWorkspaceDraft } from '../lib/adminDraftRecovery.js';
import { mergeAdminDraft,resolveDraftField,sameAdminDraft } from '../lib/adminDraftMerge.js';
import {useAdminNavigationGuard} from '../hooks/useAdminNavigationGuard.js';

export default function AdminControlDraftRecovery({section,value,original,base,readOnly,onResume,onSaved}) {
  const latest=useRef(null),saver=useRef(null);
  const [ready,setReady]=useState(false),[blocked,setBlocked]=useState(false),[saved,setSaved]=useState(null),[error,setError]=useState(''),[recovery,setRecovery]=useState(null),[reload,setReload]=useState(0);
  useEffect(()=>{latest.current={value,original,base,onResume,onSaved};},[value,original,base,onResume,onSaved]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      let draft=await loadWorkspaceDraft(section);
      if(!active)return;
      if(draft && !readOnly) { const included=mergeAdminDraft(draft.base_payload,draft.payload,latest.current.original); if(!included.conflicts.length && sameAdminDraft(included.value,latest.current.original)) {await discardWorkspaceDraft(section,Number(draft.draft_revision));draft=null;} }
      if(!active)return;
      setSaved(draft);setBlocked(!!draft);setReady(true);setError('');
      saver.current=createDraftAutosaver({initialRevision:Number(draft?.draft_revision||0),save:(item,revision)=>saveWorkspaceDraft(section,item.payload,item.base,item.baseRevision,revision),
        onSaved:result=>{if(active){setSaved(result);setError('');latest.current.onSaved(result);}},onError:failure=>{if(active)setError(failure.message);}});
    })().catch(failure=>{if(active)setError(failure.message);});
    return()=>{active=false;saver.current?.stop();};
  },[section,base,reload,readOnly]);
  const encoded=JSON.stringify(value),dirty=encoded!==JSON.stringify(original);
  useAdminNavigationGuard(dirty&&JSON.stringify(saved?.payload)!==encoded,`${section} settings`);
  useEffect(()=>{
    if(ready&&!blocked&&!readOnly&&dirty) saver.current?.update({payload:JSON.parse(encoded),base:latest.current.original,baseRevision:latest.current.base});
  },[ready,blocked,readOnly,dirty,encoded]);
  const discard=async()=>{try{await discardWorkspaceDraft(section,Number(saved.draft_revision));setReady(false);setReload(n=>n+1);}catch(failure){setError(failure.message);}};
  const resume=()=>setRecovery(mergeAdminDraft(saved.base_payload,saved.payload,original));
  const apply=()=>{onResume(recovery.value,original,base);setBlocked(false);setRecovery(null);};
  return <div className="ac-monitor-note admin-control-draft" aria-label="Private section draft">
    {error&&<p role="alert">{error}</p>}
    <span>{!ready?'Loading private draft…':blocked?'A saved private draft is available. Choose before autosaving new edits.':dirty&&JSON.stringify(saved?.payload)!==encoded?'Changes not yet saved':saved?.updated_at?`Saved privately ${new Date(saved.updated_at).toLocaleTimeString()}`:'Private autosave is ready.'}</span>
    {blocked&&<><button type="button" disabled={readOnly} onClick={resume}>Resume saved draft</button><button type="button" disabled={readOnly} onClick={discard}>Discard saved draft</button></>}
    {!blocked&&<button type="button" disabled={readOnly||!ready||!dirty} onClick={()=>{saver.current?.update({payload:value,base:original,baseRevision:base});void saver.current?.retry();}}>Save private draft now</button>}
    {error&&<button type="button" onClick={()=>{setReady(false);setReload(n=>n+1);}}>Reload draft metadata</button>}
    {recovery&&<div>{recovery.conflicts.map(conflict=><fieldset key={conflict.path}><legend>Conflict: {conflict.path||'Entire saved section'}</legend><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({saved:conflict.local,published:conflict.remote},null,2)}</pre>
      <button type="button" onClick={()=>setRecovery(current=>({...current,value:resolveDraftField(current.value,conflict.keys,conflict.local),conflicts:current.conflicts.filter(c=>c.path!==conflict.path)}))}>Use saved value</button>
      <button type="button" onClick={()=>setRecovery(current=>({...current,value:resolveDraftField(current.value,conflict.keys,conflict.remote),conflicts:current.conflicts.filter(c=>c.path!==conflict.path)}))}>Use published value</button>
    </fieldset>)}<button type="button" disabled={recovery.conflicts.length>0||readOnly} onClick={apply}>Apply recovered draft for review</button></div>}
  </div>;
}
