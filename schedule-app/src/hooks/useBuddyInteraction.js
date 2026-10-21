import { useCallback, useEffect, useRef, useState } from 'react';
import { createBuddyDirector } from '../lib/petBuddy.js';
export function useBuddyInteraction(mood, enabled, primary, buddy, reaction, reactionId, autonomous = true, familiarity = 0) {
  const pair = `${primary}:${buddy}`;
  const [cues,setCues] = useState({pair,primary:null,buddy:null});
  const engine = useRef(null);
  const inputs = useRef({mood,reaction,reactionId,autonomous,familiarity});
  useEffect(() => { inputs.current={mood,reaction,reactionId,autonomous,familiarity}; },[mood,reaction,reactionId,autonomous,familiarity]);
  useEffect(() => {
    if (!enabled || !primary || !buddy) return undefined;
    const director=createBuddyDirector({primary,buddy,onCue:(role,cue)=>setCues(previous=>({...previous,pair,[role]:cue}))});
    engine.current=director;
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync=()=>director.update({...inputs.current,enabled:!document.hidden && !media?.matches});
    document.addEventListener('visibilitychange',sync);media?.addEventListener?.('change',sync);sync();
    return ()=>{engine.current=null;director.stop();document.removeEventListener('visibilitychange',sync);media?.removeEventListener?.('change',sync);};
  },[enabled,primary,buddy,pair]);
  useEffect(()=>{engine.current?.update({mood,reaction,reactionId,autonomous,familiarity});},[mood,reaction,reactionId,autonomous,familiarity]);
  const greet = useCallback(() => { engine.current?.greet(); }, []);
  return { primary:enabled && cues.pair===pair ? cues.primary : null, buddy:enabled && cues.pair===pair ? cues.buddy : null, greet };
}
