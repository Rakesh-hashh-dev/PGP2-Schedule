import { useEffect, useRef, useState } from 'react';
import { createPetDirector, RIGGED_PETS } from '../lib/petDirector.js';
import { usePetTransitions } from './usePetTransitions.js';
import { usePetBeat } from './usePetBeat.js';

export function usePetPerformance(mood, enabled, petKey, reaction, signatures = true, reactionId = 0, socialCue = null, paired = false, habitatCue = null) {
  const rigged = RIGGED_PETS.has(petKey);
  const beat = usePetBeat(mood, enabled && signatures && !rigged, petKey, reaction);
  const [pose, setPose] = useState({ action: '', source: 'idle', petKey });
  const transitions = usePetTransitions(pose.action, pose.replay, enabled);
  const director = useRef(null);
  const prepare = useRef(transitions.prepare);
  useEffect(() => { prepare.current = transitions.prepare; }, [transitions.prepare]);
  const sequence = useRef(0);
  const inputs = useRef({ mood, reaction, reactionId, paired, autonomous: signatures });
  useEffect(() => { inputs.current = { mood, reaction, reactionId, paired, autonomous: signatures }; }, [mood, reaction, signatures, reactionId, paired]);
  useEffect(() => {
    if (!rigged || !enabled) return undefined;
    const engine = createPetDirector({ petKey, onChange: next => { prepare.current(); setPose({ ...next, petKey, replay: sequence.current++ % 2 ? 'b' : 'a' }); } });
    director.current = engine;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => engine.update({ ...inputs.current, enabled: !document.hidden && !media?.matches });
    document.addEventListener('visibilitychange', sync);
    media?.addEventListener?.('change', sync);
    sync();
    return () => {
      director.current = null;
      engine.stop();
      document.removeEventListener('visibilitychange', sync);
      media?.removeEventListener?.('change', sync);
    };
  }, [rigged, enabled, petKey]);
  useEffect(() => { director.current?.update({ mood, reaction, reactionId, paired, autonomous: signatures }); }, [mood, reaction, signatures, reactionId, paired]);
  useEffect(() => { if (socialCue) director.current?.social(socialCue); }, [socialCue]);
  useEffect(() => { if (habitatCue) director.current?.habitat(habitatCue); else director.current?.cancelHabitat(); }, [habitatCue]);
  const action = rigged && enabled && pose.petKey === petKey ? pose.action : '';
  return {
    bind: transitions.attach,
    activity: action && pose.target ? { target:pose.target, behavior:pose.behavior, label:pose.label } : null,
    beat,
    action: action || undefined,
    source: action ? pose.source : undefined,
    replay: action ? pose.replay : undefined,
    touch(event) {
      if (!rigged || !enabled || event.button > 0) return;
      const part = event.target?.closest?.('[data-pet-part], [data-part]')?.dataset.petPart || event.target?.closest?.('[data-pet-part], [data-part]')?.dataset.part || 'head';
      director.current?.touch(part);
    },
    gesture(action) { return director.current?.gesture(action) || false; },
    greet() { if (rigged && enabled) director.current?.touch('head'); },
  };
}
