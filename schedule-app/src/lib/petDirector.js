// Visual state only. Never writes care, XP, storage, or timetable data.
import { PET_PROFILES } from './petProfiles.js';
export const RIGGED_PETS = new Set(Object.keys(PET_PROFILES));
export const ACTION_MS = 1800;
const PRIORITY = { idle: 10, buddy: 40, context: 60, touch: 80, celebration: 90, care: 100 };
const QUIET = new Set(['focused', 'sleepy', 'tired', 'cozy', 'weekend', 'rooting']);
const CONTEXT = { focused: 'listen', determined: 'proud', restless: 'peek', rooting: 'listen', sleepy: 'doze', tired: 'doze', cozy: 'breathe', weekend: 'stretch', relaxed: 'breathe' };
const MOMENTS = new Set(['celebrating', 'proud', 'birthday', 'festive', 'reunion', 'hyped']);
export function contextAction(mood) {
  return MOMENTS.has(mood) ? { action: 'celebrate', source: 'celebration' }
    : CONTEXT[mood] ? { action: CONTEXT[mood], source: 'context' } : null;
}
export function idlePool(petKey, mood) {
  const pool = PET_PROFILES[petKey]?.idles || ['breathe'];
  return QUIET.has(mood) ? pool.filter(a => ['listen', 'breathe', 'doze', 'sniff', 'scan'].includes(a)) : pool;
}
/** One action at a time. Interruptions discard the old action, never queue it. */
export function createPetDirector({ petKey, onChange, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let state = { mood: 'content', reaction: null, enabled: false, autonomous: true };
  let active = { action: '', source: 'idle' };
  let actionTimer, idleTimer, previous = '';
  const emit = next => { active = next; onChange(next); };
  const cancel = () => { clearTimer(actionTimer); clearTimer(idleTimer); };
  const schedule = () => {
    clearTimer(idleTimer);
    if (!state.enabled || state.reaction || !state.autonomous) return;
    idleTimer = setTimer(() => {
      const pool = idlePool(petKey, state.mood).filter(a => a !== previous);
      const candidates = pool.length ? pool : idlePool(petKey, state.mood);
      previous = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] || 'breathe';
      play(previous, 'idle');
    }, 18000 + random() * 28000);
  };
  function play(action, source) {
    if (!state.enabled || (state.reaction && source !== 'care')) return false;
    if (active.action && PRIORITY[source] < PRIORITY[active.source]) return false;
    if (active.action === action && active.source === source && source !== 'care') return false;
    cancel();
    emit({ action, source });
    actionTimer = setTimer(() => { emit({ action: '', source: 'idle' }); schedule(); }, ACTION_MS);
    return true;
  }
  return {
    update(next) {
      const before = state;
      state = { ...state, ...next };
      if (!state.enabled) { cancel(); emit({ action: '', source: 'idle' }); return; }
      if (state.reaction) {
        if (before.reaction !== state.reaction || before.reactionId !== state.reactionId || !before.enabled) play(state.reaction === 'leap' ? 'celebrate' : state.reaction, 'care');
        return;
      }
      if (!state.autonomous && active.action && ['idle','context','buddy','celebration'].includes(active.source)) { cancel(); emit({ action:'', source:'idle' }); }
      if (before.reaction && active.source === 'care' && active.action) return;
      if (before.reaction) { cancel(); emit({ action: '', source: 'idle' }); }
      if (state.autonomous && (before.mood !== state.mood || before.paired !== state.paired || !before.enabled)) {
        const context = contextAction(state.mood);
        if (context && !(state.paired && context.source === "celebration") && play(context.action, context.source)) return;
      }
      if (!active.action) schedule();
    },
    touch(part = 'head') {
      const target = part.startsWith('wing') ? 'wing-stretch' : part === 'tail' ? 'tail-swish' : part.startsWith('ear') ? 'listen' : part === 'body' ? 'breathe' : 'nuzzle';
      return play(target, 'touch');
    },
    social(cue) { return cue && ["buddy-look", "nuzzle", "paw-wave", "wing-stretch", "celebrate"].includes(cue.action) && ["buddy", "touch", "celebration"].includes(cue.source) ? play(cue.action, cue.source) : false; },
    gesture(action) { return idlePool(petKey, state.mood).includes(action) ? play(action, 'touch') : false; },
    stop() { state = { ...state, enabled: false }; cancel(); emit({ action: '', source: 'idle' }); },
  };
}
