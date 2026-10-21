import { PET_PROFILES } from './petProfiles.js';
const QUIET = new Set(['focused','rooting','sleepy','tired','cozy']);
const CELEBRATE = new Set(['celebrating','proud','birthday','festive','reunion','hyped']);
export function buddyGreeting(petKey) {
  const actions = PET_PROFILES[petKey]?.idles || [];
  return actions.includes('paw-wave') ? 'paw-wave' : actions.includes('wing-stretch') ? 'wing-stretch' : 'nuzzle';
}
export function buddyPlan(primary, buddy, kind = 'glance', familiarity = 0) {
  if (!PET_PROFILES[primary] || !PET_PROFILES[buddy]) return [];
  if (kind === 'celebrate') return [{ role:'primary',action:'celebrate',at:0 },{ role:'buddy',action:'celebrate',at:220 }];
  if (kind === 'greet' && familiarity >= 7) return [{role:'primary',action:buddyGreeting(primary),at:0},{role:'buddy',action:buddyGreeting(buddy),at:300},{role:'primary',action:'buddy-look',at:950},{role:'buddy',action:'buddy-look',at:1300}];
  if (kind === 'greet' && familiarity >= 3) return [{role:'primary',action:'buddy-look',at:0},{role:'buddy',action:buddyGreeting(buddy),at:220},{role:'primary',action:buddyGreeting(primary),at:600},{role:'buddy',action:'buddy-look',at:1400}];
  if (kind === 'greet') return [{ role:'primary',action:'buddy-look',at:0 },{ role:'buddy',action:buddyGreeting(buddy),at:260 },{ role:'primary',action:buddyGreeting(primary),at:650 }];
  return [{ role:'primary',action:'buddy-look',at:0 },{ role:'buddy',action:'buddy-look',at:340 }];
}
/** Coordinates visual cues only; care/XP remain owned by the app. */
export function createBuddyDirector({ primary, buddy, onCue, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let state = { enabled:false, autonomous:true, mood:'content', reaction:null, reactionId:0 };
  let timers = [], sequence = 0;
  const cancel = () => { timers.forEach(clearTimer); timers=[]; };
  const schedule = () => {
    if (!state.enabled || !state.autonomous || state.reaction || QUIET.has(state.mood)) return;
    timers.push(setTimer(() => run(random() < .5 ? 'glance' : 'greet'), 32000 + random()*32000));
  };
  function run(kind, deliberate = false) {
    if (!state.enabled || state.reaction || (!deliberate && (!state.autonomous || QUIET.has(state.mood)))) return false;
    cancel();
    const plan = buddyPlan(primary,buddy,QUIET.has(state.mood) ? 'glance' : kind,state.familiarity);
    if (!plan.length) return false;
    const source = kind === 'celebrate' ? 'celebration' : deliberate ? 'touch' : 'buddy';
    const id = ++sequence;
    for (const step of plan) {
      const send = () => onCue(step.role,{ id:`${id}:${step.at}`, action:step.action, source });
      if (step.at === 0) send(); else timers.push(setTimer(send,step.at));
    }
    timers.push(setTimer(schedule,2600));
    return true;
  }
  return {
    update(next) {
      const old=state;state={...state,...next};
      if (!state.enabled) { cancel();onCue('primary',null);onCue('buddy',null);return; }
      if (state.reaction) {
        if (old.reaction !== state.reaction || old.reactionId !== state.reactionId || !old.enabled) {
          cancel();
          if (state.autonomous && !QUIET.has(state.mood)) timers.push(setTimer(() => onCue('buddy',{id:`care:${++sequence}`,action:state.reaction === 'leap' ? 'celebrate' : 'buddy-look',source:'buddy'}),240));
        }
        return;
      }
      if (old.reaction || old.mood !== state.mood || old.autonomous !== state.autonomous || !old.enabled) {
        cancel();
        if (state.autonomous && CELEBRATE.has(state.mood)) run('celebrate');
        else schedule();
      }
    },
    greet() { return run('greet',true); },
    stop() { state={...state,enabled:false};cancel();onCue('primary',null);onCue('buddy',null); },
  };
}
