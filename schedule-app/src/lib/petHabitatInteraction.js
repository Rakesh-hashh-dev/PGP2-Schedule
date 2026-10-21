// Visual-only habitat choreography. No care, XP, cosmetics or persistence writes.
import { PET_PROFILES } from './petProfiles.js';
import { normalizeHabitat } from './petHabitat.js';
export const HABITAT_ACTION_MS = 4200;
export const HABITAT_TARGETS = ['plant', 'books', 'lantern', 'cushion', 'sky'];
const QUIET = new Set(['focused', 'rooting']);
const REST = new Set(['sleepy', 'tired', 'cozy']);
// Plant, books, lantern, sky: each identity keeps its own four gestures.
export const HABITAT_TRAITS = {
  cat:['groom','listen','tail-swish','listen'], fox:['sniff','peek','listen','listen'],
  dog:['hop','peek','tail-swish','listen'], bunny:['sniff','listen','hop','listen'],
  penguin:['waddle','proud','wing-stretch','breathe'], panda:['groom','stretch','breathe','breathe'],
  chick:['peek','peek','wing-stretch','breathe'], koala:['stretch','listen','breathe','listen'],
  otter:['groom','paw-wave','tail-swish','breathe'], rover:['scan','scan','scan','listen'],
  raccoon:['sniff','peek','tail-swish','peek'], axolotl:['gill-ripple','hover','tail-swish','hover'],
  spark:['hop','listen','charge','listen'], leafy:['unfurl','breathe','hover','hover'],
  cinder:['groom','proud','mane-shake','listen'], hoot:['peek','listen','wing-stretch','listen'],
  byte:['scan','scan','scan','peek'], pebble:['peek','stretch','breathe','breathe'],
  prickle:['sniff','breathe','curl','breathe'], luna:['listen','listen','tail-swish','listen'],
  frost:['listen','listen','tail-swish','listen'], unicorn:['hop','proud','tail-swish','breathe'],
  dragon:['proud','breathe','wing-stretch','hover'], hamster:['sniff','peek','peek','sniff'],
  sloth:['stretch','listen','breathe','listen'], capy:['stretch','breathe','breathe','breathe'],
  maple:['groom','listen','tail-swish','listen'], ember:['peek','proud','wing-stretch','breathe'],
  mochi:['sniff','stretch','breathe','breathe'], nimbus:['listen','listen','hover','hover'],
  sable:['sniff','groom','tail-swish','listen'], inky:['paw-wave','paw-wave','hover','hover'],
};
export function habitatResponse(petKey, target, mood = 'content') {
  const profile = PET_PROFILES[petKey];
  if (!profile || !HABITAT_TARGETS.includes(target)) return null;
  const gesture=HABITAT_TRAITS[petKey]?.[['plant','books','lantern','sky'].indexOf(target)] || 'listen';
  if (target === 'cushion') return { target, action:'doze', behavior:'rest', label:'settles onto the soft cushion.' };
  if (QUIET.has(mood) || REST.has(mood)) return { target, action:'listen', behavior:'watch', label:`quietly watches ${target === 'sky' ? 'the sky' : target === 'books' ? 'the books' : `the ${target}`}.` };
  if (target === 'plant') return petKey === 'leafy'
    ? { target, action:'unfurl', behavior:'tend', label:'tends the little plant, leaf by leaf.' }
    : { target, action:gesture, behavior:'inspect', label:profile.growth === 'circuit' ? 'scans the little plant.' : 'leans closer to the little plant.' };
  if (target === 'books') return { target, action:gesture, behavior:'inspect', label:profile.growth === 'circuit' ? 'scans the book stack.' : 'inspects the book stack.' };
  if (target === 'lantern') return petKey === 'nimbus'
    ? { target, action:'hover', behavior:'orbit', label:'circles the lantern in a soft little arc.' }
    : { target, action:gesture, behavior:'inspect', label:petKey === 'spark' ? 'answers the lantern with a little glow.' : 'admires the warm lantern.' };
  return { target, action:gesture, behavior:'watch', label:'takes a moment to watch the sky.' };
}
export function createHabitatDirector({ primary, buddy, onCue, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let state = { enabled:false, autonomous:true, mood:'content', reaction:null, habitat:normalizeHabitat() };
  let timers=[], sequence=0, previous='';
  const cancel=()=>{timers.forEach(clearTimer);timers=[];};
  const clear=()=>{cancel();onCue('primary',null);onCue('buddy',null);};
  const targets=()=>[...state.habitat.decor,'sky'];
  const schedule=(initial=false)=>{
    if (!state.enabled || !state.autonomous || state.reaction || QUIET.has(state.mood)) return;
    const resting=REST.has(state.mood);
    timers.push(setTimer(()=>{
      const pool=resting ? [state.habitat.decor.includes('cushion') ? 'cushion' : 'sky'] : targets().filter(target=>target!==previous);
      const weighted=pool.includes(state.favorite) ? [...pool,state.favorite,state.favorite]:pool;
      const target=weighted[Math.min(weighted.length-1,Math.floor(random()*weighted.length))] || 'sky';
      run(target,false);
    },initial && resting ? 4500 : 45000+random()*40000));
  };
  function run(target, deliberate) {
    if (!state.enabled || state.reaction || !targets().includes(target) || (!deliberate && (!state.autonomous || QUIET.has(state.mood)))) return false;
    const response=habitatResponse(primary,target,state.mood);
    if (!response) return false;
    clear();previous=target;
    const id=++sequence;
    onCue('primary',{...response,id:`habitat:${id}`,source:deliberate ? 'touch':'habitat'});
    if (buddy && PET_PROFILES[buddy]) timers.push(setTimer(()=>{
      const reply=target === 'cushion' ? habitatResponse(buddy,target,state.mood)
        : {target,action:'buddy-look',behavior:'watch',label:'shares a little discovery.'};
      onCue('buddy',{...reply,id:`habitat:${id}:buddy`,source:'habitat'});
    },550));
    timers.push(setTimer(()=>{onCue('primary',null);onCue('buddy',null);schedule();},HABITAT_ACTION_MS+650));
    return true;
  }
  return {
    update(next) {
      const old=state;state={...state,...next,habitat:normalizeHabitat(next.habitat ?? state.habitat)};
      if (!state.enabled || state.reaction) {clear();return;}
      if (!old.enabled || old.reaction || old.autonomous!==state.autonomous || old.mood!==state.mood || JSON.stringify(old.habitat)!==JSON.stringify(state.habitat)) {clear();schedule(true);}
    },
    interact(target) {return run(target,true);},
    stop() {state={...state,enabled:false};clear();},
  };
}
