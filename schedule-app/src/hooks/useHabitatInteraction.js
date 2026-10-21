import { useCallback, useEffect, useRef, useState } from 'react';
import { createHabitatDirector } from '../lib/petHabitatInteraction.js';
export function useHabitatInteraction({ primary, buddy, habitat, mood, enabled, autonomous, reaction, reactionId }) {
  const identity=`${primary}:${buddy}`;
  const [cues,setCues]=useState({identity,primary:null,buddy:null});
  const [available,setAvailable]=useState(false);
  const engine=useRef(null);
  const inputs=useRef({habitat,mood,autonomous,reaction,reactionId});
  useEffect(()=>{inputs.current={habitat,mood,autonomous,reaction,reactionId};},[habitat,mood,autonomous,reaction,reactionId]);
  useEffect(()=>{
    if (!enabled || !primary) return undefined;
    const director=createHabitatDirector({primary,buddy,onCue:(role,cue)=>setCues(previous=>({...previous,identity,[role]:cue}))});
    engine.current=director;
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync=()=>{const allowed=!document.hidden && !media?.matches;setAvailable(allowed);director.update({...inputs.current,enabled:allowed});};
    document.addEventListener('visibilitychange',sync);media?.addEventListener?.('change',sync);sync();
    return ()=>{engine.current=null;director.stop();document.removeEventListener('visibilitychange',sync);media?.removeEventListener?.('change',sync);};
  },[primary,buddy,identity,enabled]);
  useEffect(()=>{engine.current?.update({habitat,mood,autonomous,reaction,reactionId});},[habitat,mood,autonomous,reaction,reactionId]);
  const interact=useCallback(target=>{engine.current?.interact(target);},[]);
  return {available:enabled && available && !reaction,primary:enabled && cues.identity===identity ? cues.primary:null,buddy:enabled && cues.identity===identity ? cues.buddy:null,interact};
}
