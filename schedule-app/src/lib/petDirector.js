// Visual state only. Never writes care, XP, storage, or timetable data.
export const RIGGED_PETS = new Set(['fox', 'mochi', 'ember', 'nimbus']);
export const ACTION_MS = 1800;
const PRIORITY = { idle: 10, context: 60, touch: 80, celebration: 90, care: 100 };
const IDLES = {
  fox: ['listen', 'tail-swish', 'peek', 'sniff'],
  mochi: ['breathe', 'sniff', 'stretch', 'doze'],
  ember: ['wing-stretch', 'proud', 'peek', 'breathe'],
  nimbus: ['hover', 'wing-stretch', 'listen', 'doze'],
};
const QUIET = new Set(['focused', 'sleepy', 'tired', 'cozy', 'weekend', 'rooting']);
const CONTEXT = { focused: 'listen', determined: 'proud', restless: 'peek', rooting: 'listen', sleepy: 'doze', tired: 'doze', cozy: 'breathe', weekend: 'stretch', relaxed: 'breathe' };
const MOMENTS = new Set(['celebrating', 'proud', 'birthday', 'festive', 'reunion', 'hyped']);
export function contextAction(mood) {
  return MOMENTS.has(mood) ? { action: 'celebrate', source: 'celebration' }
    : CONTEXT[mood] ? { action: CONTEXT[mood], source: 'context' } : null;
}
export function idlePool(petKey, mood) {
  const pool = IDLES[petKey] || ['breathe'];
  return QUIET.has(mood) ? pool.filter(a => ['listen', 'breathe', 'doze', 'sniff'].includes(a)) : pool;
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
      if (before.reaction && active.source === 'care' && active.action) return;
      if (before.reaction) { cancel(); emit({ action: '', source: 'idle' }); }
      if (state.autonomous && (before.mood !== state.mood || !before.enabled)) {
        const context = contextAction(state.mood);
        if (context && play(context.action, context.source)) return;
      }
      if (!active.action) schedule();
    },
    touch(part = 'head') {
      return play(part === 'tail' ? 'tail-swish' : part === 'wing' ? 'wing-stretch' : part === 'body' ? 'breathe' : 'nuzzle', 'touch');
    },
    stop() { state = { ...state, enabled: false }; cancel(); emit({ action: '', source: 'idle' }); },
  };
}
